const assert = require('assert');
const os = require('os');
const path = require('path');
const expect = require('chai').expect;
const request = require('request-promise');
const desc = require('../../src/util/desc');

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

desc('Testing useNock', { useNock: true }, ({ it }) => {
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

desc('Testing environment variables', ({
  before, after, beforeEach, afterEach, it
}) => {
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

  desc('Testing environment variable overwrite', {
    envVars: { '^VAR': 'OTHER' }
  }, ({
    before: beforeInner,
    after: afterInner,
    beforeEach: beforeEachInner,
    afterEach: afterEachInner,
    it: itInner
  }) => {
    beforeInner(() => {
      assert(process.env.VAR === 'OTHER');
    });

    afterInner(() => {
      assert(process.env.VAR === 'VALUE');
    });

    beforeEachInner(() => {
      assert(process.env.VAR === 'OTHER');
    });

    afterEachInner(() => {
      assert(process.env.VAR === 'OTHER');
    });

    itInner('Testing environment variable overwritten', () => {
      expect(process.env.VAR).to.equal('OTHER');
    });
  });
});

desc('Testing freezing time', { timestamp: 123456789 }, ({ it, before, after }) => {
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

desc('Testing console recording', { recordConsole: true }, ({ it }) => {
  const logger = ['log', 'info', 'error', 'warn'].reduce((p, c) => Object.assign(p, {
    // eslint-disable-next-line no-console
    [c]: (...args) => console[c](...args)
  }), {});

  it('Testing recorded logs', ({ getLogs }) => {
    expect(getLogs()).to.deep.equal({
      defaultLogs: [],
      errorLogs: [],
      logs: []
    });
    logger.log('log');
    logger.warn('warn');
    logger.error('error');
    logger.info('info');
    expect(getLogs()).to.deep.equal({
      defaultLogs: ['log', 'info'],
      errorLogs: ['warn', 'error'],
      logs: ['log', 'warn', 'error', 'info']
    });
  });

  it('Testing recording resets', ({ getLogs }) => {
    expect(getLogs().logs).to.deep.equal([]);
    logger.log('log');
    expect(getLogs().logs).to.deep.equal(['log']);
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
