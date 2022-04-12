import nockCommon from 'nock/lib/common.js';

import { expect } from 'chai';
import nockMock from '../../../src/modules/request-recorder/nock-mock.js';

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
