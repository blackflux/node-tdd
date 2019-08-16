const assert = require('assert');
const nockBack = require('nock').back;

module.exports = (testFolder) => {
  let nockDone = null;

  return ({
    inject: async (testName) => {
      assert(nockDone === null);
      nockBack.setMode('record');
      nockBack.fixtures = testFolder;
      nockDone = await new Promise((resolve) => nockBack(testName, {}, resolve));
    },
    release: () => {
      assert(nockDone !== null);
      nockDone();
      nockDone = null;
    }
  });
};
