import assert from 'assert';
import http from 'http';
import https from 'https';
import path from 'path';
import fs from 'smart-fs';
import Joi from 'joi-strict';
import nock from 'nock';
import get from 'lodash.get';
import cloneDeep from 'lodash.clonedeep';
import nockCommon from 'nock/lib/common.js';
import compareUrls from '../util/compare-urls.js';
import EnvManager from './env-manager.js';
import nockListener from './request-recorder/nock-listener.js';
import nockMock from './request-recorder/nock-mock.js';
import healSqs from './request-recorder/heal-sqs.js';
import applyModifiers from './request-recorder/apply-modifiers.js';
import requestInjector from './request-recorder/request-injector.js';
import updateAndRestoreModifiers from './request-recorder/update-and-restore-modifiers.js';
import healResponseHeaders from './request-recorder/heal-response-headers.js';
import {
  buildKey,
  tryParseJson,
  nullAsString,
  rewriteHeaders,
  convertHeaders
} from './request-recorder/util.js';

const nockBack = nock.back;
const nockRecorder = nock.recorder;

export default (opts) => {
  Joi.assert(opts, Joi.object().keys({
    cassetteFolder: Joi.string(),
    stripHeaders: Joi.boolean(),
    reqHeaderOverwrite: Joi.object().pattern(
      Joi.string().case('lower'),
      Joi.alternatives(Joi.string(), Joi.function())
    ),
    envVarsFileRecording: Joi.string().optional(),
    strict: Joi.boolean(),
    heal: Joi.alternatives(Joi.boolean(), Joi.string()),
    modifiers: Joi.object().pattern(
      Joi.string(),
      Joi.alternatives(Joi.function(), Joi.link('#modifiers'))
    )
  }), 'Invalid Options Provided');
  let cassetteFilePath = null;
  let envManagerFile = null;
  let nockDone = null;
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

  const overwriteHeaders = (key, value, headers) => {
    if (key in opts.reqHeaderOverwrite) {
      return typeof opts.reqHeaderOverwrite[key] === 'function'
        ? opts.reqHeaderOverwrite[key]({ key, value, headers })
        : opts.reqHeaderOverwrite[key];
    }
    return value;
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

      if (!hasCassette && typeof opts.envVarsFileRecording === 'string' && fs.existsSync(opts.envVarsFileRecording)) {
        envManagerFile = EnvManager({ envVars: fs.smartRead(opts.envVarsFileRecording), allowOverwrite: true });
        envManagerFile.apply();
      }

      nockBack.setMode(hasCassette ? 'lockdown' : 'record');
      nockBack.fixtures = opts.cassetteFolder;
      nockMock.patch();
      nockListener.subscribe('no match', (req) => {
        assert(hasCassette === true);

        // convert 404 response code to 500
        const destroyOriginal = req.destroy;
        req.destroy = (err) => {
          if (err?.status === 404 && err?.statusCode === 404 && err?.code === 'ERR_NOCK_NO_MATCH') {
            // eslint-disable-next-line no-param-reassign
            err.statusCode = 500;
            // eslint-disable-next-line no-param-reassign
            err.status = 500;
          }
          return destroyOriginal.call(req, err);
        };

        const { protocol, options, body } = requestInjector.getLast();
        if (anyFlagPresent(['record'])) {
          expectedCassette.push(async () => {
            nockRecorder.rec({
              output_objects: true,
              dont_print: true,
              enable_reqheaders_recording: true
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
              headers: opts.stripHeaders === true ? undefined : rewriteHeaders(record.rawHeaders),
              rawHeaders: undefined,
              reqheaders: rewriteHeaders(record.reqheaders, overwriteHeaders)
            }));
          });
        } else if (anyFlagPresent(['stub'])) {
          const host = options.host || options.hostname;
          const port = get(options, 'port', { http: 80, https: 443 }[protocol]);
          const scope = `${protocol}://${host}:${port}`;
          expectedCassette.push({
            scope,
            method: options.method,
            path: options.path,
            body: tryParseJson(body),
            status: 200,
            reqheaders: rewriteHeaders(options.headers, overwriteHeaders),
            response: {},
            responseIsBinary: false
          });
        }
      });
      nockDone = await new Promise((resolve) => {
        nockBack(cassetteFile, {
          before: (scope, scopeIdx) => {
            records.push(cloneDeep(scope));
            applyModifiers(scope, opts.modifiers);
            // eslint-disable-next-line no-param-reassign
            scope.reqheaders = rewriteHeaders(
              scope.reqheaders,
              (k, valueRecording) => (valueRequest) => {
                const match = nockCommon.matchStringOrRegexp(
                  valueRequest,
                  /^\^.*\$$/.test(valueRecording) ? new RegExp(valueRecording) : valueRecording
                );

                if (!match && anyFlagPresent(['magic', 'headers'])) {
                  const idx = pendingMocks.findIndex((m) => m.idx === scopeIdx);
                  // overwrite existing headers
                  pendingMocks[idx].record.reqheaders[k] = valueRequest;
                  return true;
                }

                return match;
              }
            );
            // eslint-disable-next-line no-param-reassign
            scope.filteringRequestBody = (body) => {
              const idx = pendingMocks.findIndex((m) => m.idx === scopeIdx);
              const record = pendingMocks[idx].record;
              if (record?.body === null) {
                return scope.body;
              }
              if (anyFlagPresent(['magic', 'body'])) {
                const requestBody = nullAsString(tryParseJson(body));
                updateAndRestoreModifiers(record, 'body', scope.body, requestBody);
                return scope.body;
              }
              return body;
            };
            // eslint-disable-next-line no-param-reassign
            scope.filteringPath = (requestPath) => {
              if (anyFlagPresent(['magic', 'path'])) {
                const idx = pendingMocks.findIndex((m) => m.idx === scopeIdx);
                if (!compareUrls(pendingMocks[idx].record.path, requestPath)) {
                  pendingMocks[idx].record.path = requestPath;
                }
                if (compareUrls(pendingMocks[idx].record.path, scope.path)) {
                  pendingMocks[idx].record.path = scope.path;
                }
                return scope.path;
              }
              return requestPath;
            };
            return scope;
          },
          after: (scope, scopeIdx) => {
            scope.on('request', (req, interceptor, requestBodyString) => {
              const idx = pendingMocks.findIndex((e) => e.idx === scopeIdx);

              // https://github.com/nock/nock/blob/79ee0429050af929c525ae21a326d22796344bfc/lib/interceptor.js#L616
              if (Number.isInteger(pendingMocks[idx]?.record?.delayConnection)) {
                interceptor.delayConnection(pendingMocks[idx].record.delayConnection);
              }
              if (Number.isInteger(pendingMocks[idx]?.record?.delayBody)) {
                interceptor.delayBody(pendingMocks[idx].record.delayBody);
              }

              const hasSentBody = requestBodyString !== undefined;
              // eslint-disable-next-line no-underscore-dangle
              const hasRecordBody = interceptor._requestBody !== undefined;
              if (hasSentBody !== hasRecordBody) {
                if (anyFlagPresent(['magic', 'body'])) {
                  pendingMocks[idx].record.body = nullAsString(tryParseJson(requestBodyString));
                } else {
                  // eslint-disable-next-line no-param-reassign
                  interceptor.errorMessage = 'Recording body mismatch';
                }
              }

              if (anyFlagPresent(['magic', 'headers'])) {
                // add new headers
                const reqheaders = {
                  ...rewriteHeaders(req.headers),
                  ...rewriteHeaders(pendingMocks[idx].record.reqheaders)
                };
                pendingMocks[idx].record.reqheaders = rewriteHeaders(reqheaders, overwriteHeaders);

                // heal response headers
                const newHeaders = healResponseHeaders(interceptor);
                if (newHeaders.length === 0) {
                  delete pendingMocks[idx].record.rawHeaders;
                } else {
                  pendingMocks[idx].record.rawHeaders = newHeaders;
                }
                // eslint-disable-next-line no-param-reassign
                interceptor.rawHeaders = newHeaders; // ensure response handled correctly
              }

              if (
                anyFlagPresent(['magic', 'response'])
                && !Object.keys(pendingMocks[idx].record).some((k) => k.startsWith('response|'))
              ) {
                const responseBody = tryParseJson([
                  healSqs,
                  (_, b) => (b instanceof Buffer ? b.toString('hex') : b)
                ].reduce(
                  (respBody, fn) => fn(requestBodyString, respBody, scope, req),
                  interceptor.body
                ));
                const interceptorBody = tryParseJson(interceptor.body);
                // eslint-disable-next-line no-param-reassign
                interceptor.body = responseBody;
                updateAndRestoreModifiers(pendingMocks[idx].record, 'response', interceptorBody, responseBody);
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
            rawHeaders: opts.stripHeaders === true ? undefined : convertHeaders(r.rawHeaders),
            reqheaders: rewriteHeaders(r.reqheaders, overwriteHeaders)
          })), null, 2)
        }, resolve);
      });
      requestInjector.inject();
    },
    release: async () => {
      assert(nockDone !== null);
      requestInjector.release();

      for (let idx = 0; idx < expectedCassette.length; idx += 1) {
        if (typeof expectedCassette[idx] === 'function') {
          // eslint-disable-next-line no-await-in-loop
          expectedCassette.splice(idx, 1, ...await expectedCassette[idx]());
          idx -= 1;
        }
      }

      nockDone();
      nockDone = null;
      nockListener.unsubscribeAll('no match');
      nockMock.unpatch();

      if (envManagerFile !== null) {
        envManagerFile.unapply();
        envManagerFile = null;
      }

      if (opts.heal !== false) {
        fs.smartWrite(
          cassetteFilePath,
          anyFlagPresent(['prune'])
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
      const unexpectedFiles = fs
        .walkDir(opts.cassetteFolder)
        .filter((f) => !knownCassetteNames.includes(f))
        .filter((f) => !['.DS_Store'].includes(f));
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
