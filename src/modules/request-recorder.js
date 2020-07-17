const assert = require('assert');
const http = require('http');
const https = require('http');
const path = require('path');
const fs = require('smart-fs');
const Joi = require('joi-strict');
const nock = require('nock');
const cloneDeep = require('lodash.clonedeep');
const nockListener = require('./request-recorder/nock-listener');
const healSqsSendMessageBatch = require('./request-recorder/heal-sqs-send-message-batch');
const applyModifiers = require('./request-recorder/apply-modifiers');
const { buildKey, tryParseJson, convertHeaders } = require('./request-recorder/util');
const requestInjector = require('./request-recorder/request-injector');

const nockBack = nock.back;
const nockRecorder = nock.recorder;

module.exports = (opts) => {
  Joi.assert(opts, Joi.object().keys({
    cassetteFolder: Joi.string(),
    stripHeaders: Joi.boolean(),
    strict: Joi.boolean(),
    heal: Joi.alternatives(Joi.boolean(), Joi.string()),
    modifiers: Joi.object().pattern(Joi.string(), Joi.function())
  }), 'Invalid Options Provided');
  let nockDone = null;
  let cassetteFilePath = null;
  const knownCassetteNames = [];
  const records = [];
  const outOfOrderErrors = [];
  const expectedCassette = [];
  const pendingMocks = [];

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
      nockListener.subscribe('no match', () => {
        assert(hasCassette === true);
        const { protocol, options, body } = requestInjector.getLast();
        if (anyFlagPresent(['record'])) {
          expectedCassette.push(async () => {
            nockRecorder.rec({
              output_objects: true,
              dont_print: true,
              enable_reqheaders_recording: false
            });
            await new Promise((resolve) => {
              options.protocol = `${protocol}:`;
              const r = { http, https }[protocol].request(options, (response) => {
                response.on('data', () => {});
                response.on('end', resolve);
              });
              if (body !== undefined) {
                r.write(body);
              }
              r.end();
            });
            const recorded = nockRecorder.play();
            nockRecorder.clear();
            return recorded.map((record) => Object.assign(record, {
              headers: opts.stripHeaders === true ? undefined : convertHeaders(record.rawHeaders),
              rawHeaders: undefined
            }));
          });
        } else if (anyFlagPresent(['stub'])) {
          expectedCassette.push({
            scope: `${protocol}://${options.host}:${options.port}`,
            method: options.method,
            path: options.path,
            body: tryParseJson(body),
            status: 200,
            response: {},
            responseIsBinary: false
          });
        }
      });
      nockDone = await new Promise((resolve) => nockBack(cassetteFile, {
        before: (scope, scopeIdx) => {
          records.push(cloneDeep(scope));
          applyModifiers(scope, opts.modifiers);
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
        afterRecord: (recordings) => JSON.stringify(recordings.map((r) => ({
          ...r,
          body: tryParseJson(r.body),
          rawHeaders: opts.stripHeaders === true ? undefined : r.rawHeaders
        })), null, 2)
      }, resolve));
      requestInjector.inject();
    },
    release: async () => {
      assert(nockDone !== null);
      requestInjector.release();
      nockDone();
      nockDone = null;
      nockListener.unsubscribeAll('no match');

      for (let idx = 0; idx < expectedCassette.length; idx += 1) {
        if (typeof expectedCassette[idx] === 'function') {
          // eslint-disable-next-line no-await-in-loop
          expectedCassette.splice(idx, 1, ...await expectedCassette[idx]());
          idx -= 1;
        }
      }

      if (opts.heal !== false) {
        fs.smartWrite(
          cassetteFilePath,
          anyFlagPresent(['magic', 'prune'])
            ? expectedCassette
            : [...expectedCassette, ...pendingMocks.map(({ record }) => record)],
          { keepOrder: outOfOrderErrors.length === 0 && pendingMocks.length === 0 }
        );
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
