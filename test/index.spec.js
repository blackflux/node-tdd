const assert = require('assert');
const os = require('os');
const path = require('path');
const expect = require('chai').expect;
const request = require('request-promise');
const desc = require('../src/index');

const dirPrefix = path.join(os.tmpdir(), 'tmp-');

desc('Testing useTmpDir', () => {
  desc('Testing Custom Before/After', { useTmpDir: true }, ({ beforeEach, afterEach, it }) => {
    let beforeDir;

    beforeEach(({ dir }) => {
      assert(dir.startsWith(dirPrefix));
      beforeDir = dir;
    });

    afterEach(({ dir }) => {
      assert(dir === null);
    });

    it('Testing dir matched beforeEach dir', ({ dir }) => {
      expect(dir).to.equal(beforeDir);
    });
  });

  desc('Testing Defaults', { useTmpDir: true }, ({ it }) => {
    it('Testing dir stars with prefix', ({ dir }) => {
      expect(dir.startsWith(dirPrefix)).to.equal(true);
    });
  });

  desc('Testing useTmpDir not set', ({ it }) => {
    it('Testing dir is null', ({ dir }) => {
      expect(dir).to.equal(null);
    });
  });
});

desc('Testing useNock', { useNock: true }, () => {
  it('Testing useNock empty recording', () => {});

  it('Testing useNock record request', async () => {
    const result = await request({
      uri: 'http://ip-api.com/json',
      method: 'GET',
      json: true,
      resolveWithFullResponse: true
    });
    expect(result.headers.date).to.equal('Sun, 19 Nov 2017 02:02:30 GMT');
  });
});

desc('Testing Before/After', ({
  before, after, beforeEach, afterEach, it
}) => {
  const state = [];

  before(() => {
    state.push('before');
  });

  after(() => {
    state.push('after');
    assert(state.join('-') === 'before-beforeEach-testOne-afterEach-beforeEach-testTwo-afterEach-after');
  });

  beforeEach(() => {
    state.push('beforeEach');
  });

  afterEach(() => {
    state.push('afterEach');
  });

  it('Test one', () => {
    state.push('testOne');
  });

  it('Test two', () => {
    state.push('testTwo');
  });
});
