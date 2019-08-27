const assert = require('assert');
const os = require('os');
const path = require('path');
const expect = require('chai').expect;
const request = require('request-promise');
const uuid4 = require('uuid/v4');
const describe = require('../../src/util/desc');

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
        assert(dir === undefined);
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
      const result = await request({
        uri: 'http://ip-api.com/json',
        method: 'GET',
        json: true,
        resolveWithFullResponse: true
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

  describe('Testing console recording', { recordConsole: true }, () => {
    let logger;
    before(() => {
      logger = ['log', 'info', 'error', 'warn'].reduce((p, c) => Object.assign(p, {
        // eslint-disable-next-line no-console
        [c]: (...args) => console[c](...args)
      }), {});
    });
    beforeEach(({ recorder }) => {
      recorder.verbose(false);
    });

    it('Testing recorded logs', ({ recorder }) => {
      expect(recorder.get()).to.deep.equal([]);
      ['log', 'warn', 'error', 'info'].forEach((level) => {
        logger[level](level);
      });
      expect(recorder.get()).to.deep.equal(['log', 'warn', 'error', 'info']);
      ['log', 'warn', 'error', 'info'].forEach((level) => {
        expect(recorder.get(level)).to.deep.equal([level]);
      });
      recorder.reset();
      expect(recorder.get()).to.deep.equal([]);
      ['log', 'warn', 'error', 'info'].forEach((level) => {
        expect(recorder.get(level)).to.deep.equal([]);
      });
    });

    it('Testing recording resets', ({ recorder }) => {
      expect(recorder.get()).to.deep.equal([]);
      logger.log('log');
      expect(recorder.get()).to.deep.equal(['log']);
      expect(recorder.get('error')).to.deep.equal([]);
    });
  });

  describe('Testing random mocking', { cryptoSeed: 'ca8e7655-cd4f-47bf-a817-3b44f0f5b74e' }, () => {
    it('Testing random is mocked', () => {
      expect(uuid4()).to.deep.equal('f052644d-e485-4693-aef0-76267f1499ea');
      expect(uuid4()).to.deep.equal('ba8e46ec-d63d-4fb8-9189-23e2454f7172');
    });
  });

  describe('Testing async done callback', () => {
    it('Test done is a function', (done) => {
      expect(typeof done).to.equal('function');
      done();
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
      try {
        await capture(() => {});
      } catch (e) {
        expect(String(e)).to.equal('AssertionError [ERR_ASSERTION]: expected [Function] to throw an error');
      }
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
});
