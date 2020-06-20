const assert = require('assert');
const { request } = require('http');
const path = require('path');
const fs = require('smart-fs');
const Joi = require('joi-strict');
const nock = require('nock');
const nockListener = require('./request-recorder/nock-listener');
const healSqsSendMessageBatch = require('./request-recorder/heal-sqs-send-message-batch');

const nockBack = nock.back;

const buildKey = (interceptor) => `${interceptor.method} ${interceptor.basePath}${interceptor.uri}`;

const tryParseJson = (value) => {
  try {
    return JSON.parse(value);
  } catch (e) {
    return value;
  }
};

module.exports = (opts) => {
  Joi.assert(opts, Joi.object().keys({
    cassetteFolder: Joi.string(),
    stripHeaders: Joi.boolean(),
    strict: Joi.boolean(),
    heal: Joi.alternatives(Joi.boolean(), Joi.string())
  }), 'Invalid Options Provided');
  let nockDone = null;
  let cassetteFilePath = null;
  const knownCassetteNames = [];
  const records = [];
  const outOfOrderErrors = [];
  const expectedCassette = [];
  const pendingMocks = [];
  const promises = [];

  const anyFlagPresent = (flags) => {
    assert(Array.isArray(flags) && flags.length !== 0);
    if (typeof opts.heal !== 'string') {
      return false;
    }
    const needleFlags = opts.heal.split(',');
    return flags.some((flag) => needleFlags.includes(flag));
  };

  return ({
    inject: async (cassetteFile) => {
      assert(nockDone === null);
      knownCassetteNames.push(cassetteFile);
      records.length = 0;
      outOfOrderErrors.length = 0;
      expectedCassette.length = 0;
      pendingMocks.length = 0;
      promises.length = 0;

      cassetteFilePath = path.join(opts.cassetteFolder, cassetteFile);
      const hasCassette = fs.existsSync(cassetteFilePath);
      if (hasCassette) {
        const cassetteContent = fs.smartRead(cassetteFilePath);
        pendingMocks.push(...nock
          .define(cassetteContent)
          .map((e, idx) => ({
            idx,
            key: buildKey(e.interceptors[0]),
            record: cassetteContent[idx]
          })));
      }

      nockBack.setMode(hasCassette ? 'lockdown' : 'record');
      nockBack.fixtures = opts.cassetteFolder;
      nockListener.subscribe('no match', (_, req, body) => {
        assert(hasCassette === true);
        if (anyFlagPresent(['magic', 'inject'])) {
          promises.push(new Promise((resolve) => {
            nock.enableNetConnect();
            request(req, (response) => {
              let responseBody = '';
              response.on('data', (chunk) => {
                responseBody += chunk;
              });
              response.on('end', () => {
                const r = {
                  scope: `${req.uri.protocol}//${req.uri.host}`,
                  method: req.method,
                  path: req.uri.path,
                  body: tryParseJson(body),
                  status: response.statusCode,
                  response: tryParseJson(responseBody),
                  responseIsBinary: false
                };
                if (opts.stripHeaders !== true) {
                  r.headers = response.headers;
                }
                expectedCassette.push(r);
                expectedCassette.push(...pendingMocks.map(({ record }) => record));
                resolve();
              });
            }).end();
          }));
        }
      });
      nockDone = await new Promise((resolve) => nockBack(cassetteFile, {
        before: (scope, scopeIdx) => {
          records.push({ ...scope });
          // eslint-disable-next-line no-param-reassign
          scope.filteringRequestBody = (body) => {
            if (anyFlagPresent(['magic', 'body'])) {
              const idx = pendingMocks.findIndex((m) => m.idx === scopeIdx);
              const requestBody = tryParseJson(body);
              pendingMocks[idx].record.body = requestBody === null ? 'null' : requestBody;
              return scope.body;
            }
            return body;
          };
          // eslint-disable-next-line no-param-reassign
          scope.filteringPath = (requestPath) => {
            if (anyFlagPresent(['magic', 'path'])) {
              const idx = pendingMocks.findIndex((m) => m.idx === scopeIdx);
              pendingMocks[idx].record.path = requestPath;
              return scope.path;
            }
            return requestPath;
          };
          return scope;
        },
        after: (scope, scopeIdx) => {
          scope.on('request', (req, interceptor, requestBodyString) => {
            const idx = pendingMocks.findIndex((e) => e.idx === scopeIdx);

            if (anyFlagPresent(['magic', 'response'])) {
              const responseBody = tryParseJson([
                healSqsSendMessageBatch
              ].reduce(
                (respBody, fn) => fn(requestBodyString, respBody, scope),
                interceptor.body
              ));
              // eslint-disable-next-line no-param-reassign
              interceptor.body = responseBody;
              pendingMocks[idx].record.response = responseBody;
            }

            expectedCassette.push(pendingMocks[idx].record);
            if (idx !== 0) {
              outOfOrderErrors.push(pendingMocks[idx].key);
            }
            pendingMocks.splice(idx, 1);
          });
        },
        afterRecord: (recordings) => JSON
          .stringify(opts.stripHeaders === true ? recordings.map((r) => {
            const res = { ...r };
            delete res.rawHeaders;
            return res;
          }) : recordings, null, 2)
      }, resolve));
    },
    release: async () => {
      assert(nockDone !== null);
      await Promise.all(promises);
      nockDone();
      nockDone = null;
      nockListener.unsubscribeAll('no match');
      if (opts.heal !== false) {
        fs.smartWrite(cassetteFilePath, expectedCassette, {
          keepOrder: outOfOrderErrors.length === 0 && pendingMocks.length === 0
        });
      }
      if (opts.strict !== false) {
        if (outOfOrderErrors.length !== 0) {
          throw new Error(`Out of Order Recordings: ${outOfOrderErrors.join(', ')}`);
        }
        if (pendingMocks.length !== 0) {
          throw new Error(`Unmatched Recordings: ${pendingMocks.map((e) => e.key).join(', ')}`);
        }
      }
    },
    shutdown: () => {
      const unexpectedFiles = fs.walkDir(opts.cassetteFolder).filter((f) => !knownCassetteNames.includes(f));
      if (unexpectedFiles.length !== 0) {
        throw new Error(`Unexpected file(s) in cassette folder: ${unexpectedFiles.join(', ')}`);
      }
    },
    get: () => ({
      records: records.slice(),
      outOfOrderErrors: outOfOrderErrors.slice(),
      unmatchedRecordings: pendingMocks.map((e) => e.key).slice(),
      expectedCassette: expectedCassette.slice(),
      cassetteFilePath
    })
  });
};
