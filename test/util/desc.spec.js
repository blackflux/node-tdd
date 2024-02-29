import crypto from 'crypto';
import assert from 'assert';
import os from 'os';
import path from 'path';
import axios from 'axios';
import fancyLog from 'fancy-log';
import { expect } from 'chai';
import LRU from 'lru-cache-ext';
import describe from '../../src/util/desc.js';

const dirPrefix = path.join(os.tmpdir(), 'tmp-');

describe('Testing { describe }', () => {
  before(() => {
    assert(process.env.VAR === 'VALUE');
  });

  after(() => {
    assert(process.env.VAR === undefined);
  });

  beforeEach(() => {
    assert(['VALUE', 'OTHER'].includes(process.env.VAR));
  });

  afterEach(() => {
    assert(['VALUE', 'OTHER'].includes(process.env.VAR));
  });

  it('Testing environment variable set', () => {
    expect(process.env.VAR).to.equal('VALUE');
  });

  describe('Testing environment variable overwrite', {
    envVars: { '^VAR': 'OTHER' }
  }, () => {
    before(() => {
      assert(process.env.VAR === 'OTHER');
    });

    after(() => {
      assert(process.env.VAR === 'VALUE');
    });

    beforeEach(() => {
      assert(process.env.VAR === 'OTHER');
    });

    afterEach(() => {
      assert(process.env.VAR === 'OTHER');
    });

    it('Testing environment variable overwritten', () => {
      expect(process.env.VAR).to.equal('OTHER');
    });
  });

  describe('Testing useTmpDir', () => {
    describe('Testing Custom Before/After', { useTmpDir: true }, () => {
      let beforeDir;

      beforeEach(({ dir }) => {
        assert(dir.startsWith(dirPrefix));
        beforeDir = dir;
      });

      afterEach(({ dir }) => {
        assert(dir.startsWith(dirPrefix));
        assert(dir === beforeDir);
      });

      it('Testing dir matched beforeEach dir', ({ dir }) => {
        expect(dir).to.equal(beforeDir);
      });
    });

    describe('Testing Defaults', { useTmpDir: true }, () => {
      it('Testing dir stars with prefix', ({ dir }) => {
        expect(dir.startsWith(dirPrefix)).to.equal(true);
      });
    });

    describe('Testing useTmpDir not set', () => {
      it('Testing dir is null', ({ dir }) => {
        expect(dir).to.equal(undefined);
      });
    });
  });

  describe('Testing useNock', { useNock: true }, () => {
    it('Testing useNock empty recording', () => {});

    it('Testing useNock record request', async () => {
      const result = await axios({
        url: 'http://ip-api.com/json',
        method: 'GET',
        responseType: 'json'
      });
      expect(result.headers.date).to.equal('Sun, 19 Nov 2017 02:02:30 GMT');
    });
  });

  describe('Testing freezing time', { timestamp: 123456789 }, () => {
    before(() => {
      assert(Math.floor(new Date() / 1000) === 123456789);
    });

    after(() => {
      assert(Math.floor(new Date() / 1000) > 123456789);
    });

    it('Testing time is frozen', () => {
      expect(Math.floor(new Date() / 1000)).to.equal(123456789);
    });
  });

  describe('Testing logger recording', { record: fancyLog }, () => {
    it('Testing recorded logs', ({ recorder }) => {
      const logLevels = Object.keys(fancyLog);
      expect(recorder.get()).to.deep.equal([]);
      logLevels.forEach((level) => {
        fancyLog[level](level);
      });
      expect(recorder.get()).to.deep.equal(logLevels);
      logLevels.forEach((level) => {
        expect(recorder.get(level)).to.deep.equal([level]);
      });
      recorder.reset();
      expect(recorder.get()).to.deep.equal([]);
      logLevels.forEach((level) => {
        expect(recorder.get(level)).to.deep.equal([]);
      });
    });

    it('Testing recording resets', ({ recorder }) => {
      expect(recorder.get()).to.deep.equal([]);
      fancyLog.info('info');
      expect(recorder.get()).to.deep.equal(['info']);
      expect(recorder.get('error')).to.deep.equal([]);
    });
  });

  describe('Testing random mocking', { cryptoSeed: 'ca8e7655-cd4f-47bf-a817-3b44f0f5b74e' }, () => {
    it('Testing random is mocked', () => {
      expect(crypto.randomUUID()).to.deep.equal('b23876ba-9014-4c17-8ee3-b274076a958b');
      expect(crypto.randomUUID()).to.deep.equal('c534e03d-e086-481d-9d89-c9ab07570e99');
    });
  });

  describe('Testing random mocking with reseed', {
    cryptoSeed: 'ca8e7655-cd4f-47bf-a817-3b44f0f5b74e',
    cryptoSeedReseed: true
  }, () => {
    it('Testing random is mocked', () => {
      expect(crypto.randomUUID()).to.deep.equal('6d4bcc06-8547-4e9e-8b87-80bd9ab25e62');
      expect(crypto.randomUUID()).to.deep.equal('6d4bcc06-8547-4e9e-8b87-80bd9ab25e62');
    });
  });

  describe('Testing async done callback', () => {
    it('Test done is a function', (done) => {
      expect(typeof done).to.equal('function');
      done();
    });
  });

  describe('Testing fixture', () => {
    it('Test fixture loaded', ({ fixture }) => {
      expect(fixture('data')).to.deep.equal({});
    });

    it('Test script fixture loaded', async ({ fixture }) => {
      expect(await fixture('code')).to.deep.equal({ key: 'value' });
    });

    it('Test fixture not found', async ({ fixture, capture }) => {
      const e = await capture(() => fixture('unknown'));
      expect(String(e)).to.equal('AssertionError [ERR_ASSERTION]: fixture "unknown" not found or ambiguous');
    });
  });

  describe('Testing capture', () => {
    it('Test capture captures error', async ({ capture }) => {
      const error = new Error();
      const e = await capture(() => {
        throw error;
      });
      expect(e).to.equal(error);
    });

    it('Test capture throws when no error captured', async ({ capture }) => {
      const err = await new Promise((resolve) => {
        capture(() => {}).catch((e) => resolve(e));
      });
      expect(String(err)).to.equal('AssertionError [ERR_ASSERTION]: expected [Function] to throw an error');
    });
  });

  // eslint-disable-next-line func-names
  describe('Testing timeout', { timeout: 2345 }, function () {
    // eslint-disable-next-line mocha/no-setup-in-describe
    assert(typeof this.timeout === 'function');
    // eslint-disable-next-line mocha/no-setup-in-describe
    assert(this.timeout() === 2345);

    // eslint-disable-next-line func-names
    before(function () {
      assert(typeof this.timeout === 'function');
      assert(this.timeout() === 2345);
    });

    // eslint-disable-next-line func-names
    after(function () {
      assert(typeof this.timeout === 'function');
      assert(this.timeout() === 2345);
    });

    // eslint-disable-next-line func-names
    beforeEach(function () {
      assert(typeof this.timeout === 'function');
      assert(this.timeout() === 2345);
    });

    // eslint-disable-next-line func-names
    afterEach(function () {
      assert(typeof this.timeout === 'function');
      assert(this.timeout() === 2345);
    });

    // eslint-disable-next-line func-names
    it('Test timeout is set', function () {
      assert(typeof this.timeout === 'function');
      expect(this.timeout()).to.equal(2345);
    });
  });

  describe('Testing Before/After', () => {
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

  describe('Testing Clear Cache', () => {
    let cache;

    before(() => {
      cache = new LRU({ ttl: 100, max: 100 });
    });

    it('First', () => {
      expect(cache.has('a')).to.equal(false);
      cache.set('a', 1);
    });

    it('Second', () => {
      expect(cache.has('a')).to.equal(false);
      cache.set('a', 1);
    });
  });
});
