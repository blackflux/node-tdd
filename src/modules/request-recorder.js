const assert = require('assert');
const path = require('path');
const fs = require('smart-fs');
const nock = require('nock');

const nockBack = nock.back;

const buildKey = (interceptor) => `${interceptor.method} ${interceptor.basePath}${interceptor.uri}`;

module.exports = (cassetteFolder, stripHeaders) => {
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

      cassetteFilePath = path.join(cassetteFolder, cassetteFile);
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
      nockBack.fixtures = cassetteFolder;
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
        afterRecord: (recordings) => (stripHeaders === true ? recordings.map((r) => {
          const res = { ...r };
          delete res.rawHeaders;
          return res;
        }) : recordings)
      }, resolve));
    },
    release: (strict) => {
      assert(typeof strict === 'boolean');
      assert(nockDone !== null);
      nockDone();
      nockDone = null;
      if (strict !== false) {
        if (outOfOrderErrors.length !== 0) {
          throw new Error(`Out of Error Recordings: ${outOfOrderErrors.join(', ')}`);
        }
        if (pendingMocks.length !== 0) {
          throw new Error(`Unmatched Recordings: ${pendingMocks.map((e) => e.key).join(', ')}`);
        }
      }
    },
    shutdown: () => {
      const unexpectedFiles = fs.walkDir(cassetteFolder).filter((f) => !knownCassetteNames.includes(f));
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
