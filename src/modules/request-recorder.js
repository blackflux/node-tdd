const assert = require('assert');
const path = require('path');
const get = require('lodash.get');
const isEqual = require('lodash.isequal');
const fs = require('smart-fs');
const Joi = require('joi-strict');
const minimist = require('minimist');
const nock = require('nock');
const nockListener = require('./request-recorder/nock-listener');

const nockBack = nock.back;

const buildKey = (interceptor) => `${interceptor.method} ${interceptor.basePath}${interceptor.uri}`;

module.exports = (opts) => {
  Joi.assert(opts, Joi.object().keys({
    cassetteFolder: Joi.string(),
    stripHeaders: Joi.boolean(),
    strict: Joi.boolean(),
    argv: Joi.object().optional()
  }), 'Invalid Options Provided');
  let nockDone = null;
  let cassetteFilePath = null;
  let cassetteContent;
  let cassetteContentParsed;
  let isCassetteAltered = false;
  const knownCassetteNames = [];
  const records = [];
  const outOfOrderErrors = [];
  const expectedCassette = [];
  const pendingMocks = [];

  return ({
    inject: async (cassetteFile) => {
      assert(nockDone === null);
      knownCassetteNames.push(cassetteFile);
      records.length = 0;
      outOfOrderErrors.length = 0;
      expectedCassette.length = 0;
      pendingMocks.length = 0;

      cassetteFilePath = path.join(opts.cassetteFolder, cassetteFile);
      cassetteContent = undefined;
      cassetteContentParsed = undefined;
      isCassetteAltered = false;
      const hasCassette = fs.existsSync(cassetteFilePath);
      if (hasCassette) {
        cassetteContent = fs.smartRead(cassetteFilePath);
        cassetteContentParsed = nock
          .define(cassetteContent)
          .map((e, idx) => ({
            key: buildKey(e.interceptors[0]),
            record: cassetteContent[idx]
          }));
        pendingMocks.push(...cassetteContentParsed);
      }

      nockBack.setMode(hasCassette ? 'lockdown' : 'record');
      nockBack.fixtures = opts.cassetteFolder;
      nockListener.subscribe('no match', ({ interceptors }, req) => {
        assert(hasCassette === true);
        const argv = get(opts, 'argv', minimist(process.argv.slice(2)));
        if (argv['nock-heal'] !== undefined) {
          const identifierPath = argv['nock-heal'];
          const requestBody = get(req, ['_rp_options', 'body']);
          const requestIdentifier = get(requestBody, identifierPath);
          const keys = interceptors.map((interceptor) => buildKey(interceptor));
          cassetteContent
            .filter((rec, idx) => keys.includes(cassetteContentParsed[idx].key))
            .forEach((e) => {
              const recordingBody = get(e, 'body');
              const recordingIdentifier = get(recordingBody, identifierPath);
              if (
                identifierPath === true
                || (recordingIdentifier !== undefined && isEqual(recordingIdentifier, requestIdentifier))
              ) {
                e.body = requestBody;
                isCassetteAltered = true;
              }
            });
        }
      });
      nockDone = await new Promise((resolve) => nockBack(cassetteFile, {
        before: (r) => {
          records.push(r);
          return r;
        },
        after: (scope) => {
          scope.on('request', (req, interceptor) => {
            const matchedKey = buildKey(interceptor);
            const idx = pendingMocks.findIndex((e) => e.key === matchedKey);
            expectedCassette.push(pendingMocks[idx].record);
            pendingMocks.splice(idx, 1);
            if (idx !== 0) {
              outOfOrderErrors.push(matchedKey);
            }
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
    release: () => {
      assert(nockDone !== null);
      nockDone();
      nockDone = null;
      nockListener.unsubscribeAll('no match');
      if (isCassetteAltered === true) {
        fs.smartWrite(cassetteFilePath, cassetteContent);
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
