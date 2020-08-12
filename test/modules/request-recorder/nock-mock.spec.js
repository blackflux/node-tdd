const expect = require('chai').expect;
const nockCommon = require('nock/lib/common');

const nockMock = require('../../../src/modules/request-recorder/nock-mock');

describe('Testing nock-mock.js', () => {
  beforeEach(() => {
    nockMock.patch();
  });
  afterEach(() => {
    nockMock.unpatch();
  });

  it('Testing without timeout', async () => {
    await new Promise((resolve) => {
      let called = false;
      const r = nockCommon.setTimeout(() => {
        called = true;
      }, 0);
      expect(called).to.equal(true);
      expect(r).to.equal(undefined);
      resolve();
    });
  });

  it('Testing with timeout', async () => {
    await new Promise((resolve) => {
      let called = false;
      const r = nockCommon.setTimeout(() => {
        called = true;
        resolve();
      }, 1);
      expect(called).to.equal(false);
      expect(typeof r).to.equal('object');
    });
  });
});
