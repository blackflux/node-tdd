const assert = require('assert');
const path = require('path');
const get = require('lodash.get');
const isEqual = require('lodash.isequal');
const fs = require('smart-fs');
const Joi = require('joi-strict');
const nock = require('nock');
const nockListener = require('./request-recorder/nock-listener');

const nockBack = nock.back;

const buildKey = (interceptor) => `${interceptor.method} ${interceptor.basePath}${interceptor.uri}`;

module.exports = (opts) => {
  Joi.assert(opts, Joi.object().keys({
    cassetteFolder: Joi.string(),
    stripHeaders: Joi.boolean(),
    strict: Joi.boolean(),
    heal: Joi.alternatives(Joi.boolean().allow(true), Joi.string())
  }), 'Invalid Options Provided');
  let nockDone = null;
  let cassetteFilePath = null;
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
      const hasCassette = fs.existsSync(cassetteFilePath);
      if (hasCassette) {
        const cassetteContent = fs.smartRead(cassetteFilePath);
        pendingMocks.push(...nock
          .define(cassetteContent)
          .map((e, idx) => ({
            key: buildKey(e.interceptors[0]),
            record: cassetteContent[idx]
          })));
      }

      nockBack.setMode(hasCassette ? 'lockdown' : 'record');
      nockBack.fixtures = opts.cassetteFolder;
      nockListener.subscribe('no match', (_, req) => {
        assert(hasCassette === true);
        if (opts.heal !== false) {
          const matchedKey = `${req.method} ${req.href}`;
          const idx = pendingMocks.findIndex((e) => e.key === matchedKey);
          if (idx !== -1) {
            const requestBody = get(req, ['_rp_options', 'body']);
            if (
              opts.heal === true
              || (() => {
                const identifierPath = opts.heal;
                const requestIdentifier = get(requestBody, identifierPath);
                if (requestIdentifier === undefined) {
                  return false;
                }
                const recordingBody = get(pendingMocks[idx], ['record', 'body']);
                const recordingIdentifier = get(recordingBody, identifierPath);
                return isEqual(recordingIdentifier, requestIdentifier);
              })()
            ) {
              expectedCassette.push({ ...pendingMocks[idx].record, body: requestBody });
              pendingMocks.splice(idx, 1);
            }
          }
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
      if (opts.heal !== false) {
        fs.smartWrite(cassetteFilePath, expectedCassette);
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
