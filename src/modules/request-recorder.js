const assert = require('assert');
const path = require('path');
const fs = require('smart-fs');
const get = require('lodash.get');
const nock = require('nock');

const nockBack = nock.back;

module.exports = (cassetteFolder, stripHeaders) => {
  let nockDone = null;
  const records = [];
  const outOfOrderErrors = [];
  const pendingMocks = [];

  return ({
    inject: async (cassetteFile) => {
      assert(nockDone === null);
      records.length = 0;
      outOfOrderErrors.length = 0;

      const cassetteFileAbs = path.join(cassetteFolder, cassetteFile);
      const hasCassette = fs.existsSync(cassetteFileAbs);
      pendingMocks.splice(0, pendingMocks.length, ...(hasCassette
        ? nock.load(cassetteFileAbs).map((e) => get(e, ['interceptors', 0, '_key'])) : []));

      nockBack.setMode(hasCassette ? 'lockdown' : 'record');
      nockBack.fixtures = cassetteFolder;
      nockDone = await new Promise((resolve) => nockBack(cassetteFile, {
        before: (r) => {
          records.push(r);
          return r;
        },
        after: (scope) => {
          scope.on('request', (req, interceptor) => {
            const matchedKey = get(interceptor, ['_key']);
            if (matchedKey === pendingMocks[0]) {
              pendingMocks.splice(0, 1);
            } else {
              pendingMocks.splice(pendingMocks.indexOf(matchedKey), 1);
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
          throw new Error(`Unmatched Recordings: ${pendingMocks.join(', ')}`);
        }
      }
    },
    get: () => ({
      records: records.slice(),
      outOfOrderErrors: outOfOrderErrors.slice(),
      unmatchedRecordings: pendingMocks.slice()
    })
  });
};
