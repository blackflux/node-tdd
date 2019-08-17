const assert = require('assert');
const os = require('os');
const path = require('path');
const expect = require('chai').expect;
const request = require('request-promise');
const uuid4 = require('uuid/v4');
const describe = require('../../src/util/desc');

const dirPrefix = path.join(os.tmpdir(), 'tmp-');

describe('Testing useTmpDir', () => {
  describe('Testing Custom Before/After', { useTmpDir: true }, () => {
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

  describe('Testing Defaults', { useTmpDir: true }, () => {
    it('Testing dir stars with prefix', ({ dir }) => {
      expect(dir.startsWith(dirPrefix)).to.equal(true);
    });
  });

  describe('Testing useTmpDir not set', () => {
    it('Testing dir is null', ({ dir }) => {
      expect(dir).to.equal(null);
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

describe('Testing environment variables', () => {
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
  const logger = ['log', 'info', 'error', 'warn'].reduce((p, c) => Object.assign(p, {
    // eslint-disable-next-line no-console
    [c]: (...args) => console[c](...args)
  }), {});

  it('Testing recorded logs', ({ getConsoleOutput }) => {
    expect(getConsoleOutput()).to.deep.equal([]);
    ['log', 'warn', 'error', 'info'].forEach((level) => {
      logger[level](level);
    });
    const result = getConsoleOutput();
    expect(result).to.deep.equal(['log', 'warn', 'error', 'info']);
    ['log', 'warn', 'error', 'info'].forEach((level) => {
      expect(result[level]).to.deep.equal([level]);
    });
  });

  it('Testing recording resets', ({ getConsoleOutput }) => {
    expect(getConsoleOutput()).to.deep.equal([]);
    logger.log('log');
    expect(getConsoleOutput()).to.deep.equal(['log']);
    expect(getConsoleOutput().error).to.deep.equal([]);
  });
});

describe('Testing random mocking', { cryptoSeed: 'ca8e7655-cd4f-47bf-a817-3b44f0f5b74e' }, () => {
  it('Testing random is mocked', () => {
    expect(uuid4()).to.deep.equal('f052644d-e485-4693-aef0-76267f1499ea');
    expect(uuid4()).to.deep.equal('ba8e46ec-d63d-4fb8-9189-23e2454f7172');
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
