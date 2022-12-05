import assert from 'assert';
import path from 'path';
import fs from 'smart-fs';
import callsites from 'callsites';
import get from 'lodash.get';
import { fileURLToPath } from 'url';
import minimist from 'minimist';
import tmp from 'tmp';
import Joi from 'joi-strict';
import RequestRecorder from '../modules/request-recorder.js';
import EnvManager from '../modules/env-manager.js';
import TimeKeeper from '../modules/time-keeper.js';
import LogRecorder from '../modules/log-recorder.js';
import RandomSeeder from '../modules/random-seeder.js';
import CacheClearer from '../modules/cache-clearer.js';
import { getParents, genCassetteName } from './mocha-test.js';

const mocha = {
  it,
  specify,
  describe,
  context,
  before,
  after,
  beforeEach,
  afterEach
};

const desc = (suiteName, optsOrTests, testsOrNull = null) => {
  const opts = testsOrNull === null ? {} : optsOrTests;
  const tests = testsOrNull === null ? optsOrTests : testsOrNull;

  const filenameOrUrl = callsites()[1].getFileName();
  const testFile = path.resolve(
    filenameOrUrl.startsWith('file://')
      ? fileURLToPath(filenameOrUrl)
      // eslint-disable-next-line @blackflux/rules/c8-prevent-ignore
      /* c8 ignore next */
      : filenameOrUrl
  );
  const resolve = (name) => path.join(
    path.dirname(testFile),
    name.replace(/\$FILENAME/g, path.basename(testFile))
  );

  Joi.assert(opts, Joi.object().keys({
    useTmpDir: Joi.boolean().optional(),
    useNock: Joi.boolean().optional(),
    nockFolder: Joi.string().optional(),
    nockModifiers: Joi.object().optional().pattern(Joi.string(), Joi.function()),
    nockStripHeaders: Joi.boolean().optional(),
    nockReqHeaderOverwrite: Joi.object().optional()
      .pattern(Joi.string(), Joi.alternatives(Joi.function(), Joi.string())),
    fixtureFolder: Joi.string().optional(),
    envVarsFile: Joi.string().optional(),
    envVars: Joi.object().optional().unknown(true).pattern(Joi.string(), Joi.string()),
    clearCache: Joi.boolean().optional(),
    timestamp: Joi.alternatives(
      Joi.number().integer().min(0),
      Joi.date().iso()
    ).optional(),
    record: Joi.any().optional(),
    cryptoSeed: Joi.string().optional(),
    cryptoSeedReseed: Joi.when('cryptoSeed', {
      is: Joi.string(),
      then: Joi.boolean().optional(),
      otherwise: Joi.forbidden()
    }),
    timeout: Joi.number().optional().min(0)
  }), 'Bad Options Provided');
  const useTmpDir = get(opts, 'useTmpDir', false);
  const useNock = get(opts, 'useNock', false);
  const nockFolder = resolve(get(opts, 'nockFolder', '$FILENAME__cassettes'));
  const nockModifiers = get(opts, 'nockModifiers', {});
  const nockStripHeaders = get(opts, 'nockStripHeaders', false);
  const nockReqHeaderOverwrite = get(opts, 'nockReqHeaderOverwrite', {});
  const fixtureFolder = resolve(get(opts, 'fixtureFolder', '$FILENAME__fixtures'));
  const envVarsFile = resolve(get(opts, 'envVarsFile', '$FILENAME.env.yml'));
  const envVars = get(opts, 'envVars', null);
  const clearCache = get(opts, 'clearCache', true);
  const timestamp = get(opts, 'timestamp', null);
  const record = get(opts, 'record', false);
  const cryptoSeed = get(opts, 'cryptoSeed', null);
  const cryptoSeedReseed = get(opts, 'cryptoSeedReseed', false);
  const timeout = get(opts, 'timeout', null);
  const nockHeal = get(minimist(process.argv.slice(2)), 'nock-heal', false);

  let dir = null;
  let requestRecorder = null;
  let cacheClearer = null;
  let envManagerFile = null;
  let envManagerDesc = null;
  let timeKeeper = null;
  let logRecorder = null;
  let randomSeeder = null;

  const getArgs = () => ({
    capture: async (fn) => {
      try {
        await fn();
      } catch (e) {
        return e;
      }
      throw new assert.AssertionError({ message: 'expected [Function] to throw an error' });
    },
    fixture: (name) => {
      const filepath = fs.guessFile(path.join(fixtureFolder, name));
      if (filepath === null) {
        throw new assert.AssertionError({ message: `fixture "${name}" not found or ambiguous` });
      }
      return fs.smartRead(filepath);
    },
    ...(dir === null ? {} : { dir }),
    ...(logRecorder === null ? {} : {
      recorder: {
        verbose: logRecorder.verbose,
        get: logRecorder.get,
        reset: logRecorder.reset
      }
    })
  });
  let beforeCb = () => {};
  let afterCb = () => {};
  let beforeEachCb = () => {};
  let afterEachCb = () => {};

  // eslint-disable-next-line func-names
  mocha.describe(suiteName, function () {
    return (async () => {
      if (timeout !== null) {
        this.timeout(timeout);
      }

      // eslint-disable-next-line func-names
      mocha.before(function () {
        return (async () => {
          if (clearCache !== false) {
            cacheClearer = CacheClearer();
          }
          if (getParents(this.test).length === 3 && fs.existsSync(envVarsFile)) {
            envManagerFile = EnvManager({ envVars: fs.smartRead(envVarsFile), allowOverwrite: false });
            envManagerFile.apply();
          }
          if (envVars !== null) {
            envManagerDesc = EnvManager({ envVars, allowOverwrite: false });
            envManagerDesc.apply();
          }
          if (timestamp !== null) {
            timeKeeper = TimeKeeper({ timestamp });
            timeKeeper.inject();
          }
          if (cryptoSeed !== null) {
            randomSeeder = RandomSeeder({ seed: cryptoSeed, reseed: cryptoSeedReseed });
            randomSeeder.inject();
          }
          if (useNock === true) {
            requestRecorder = RequestRecorder({
              cassetteFolder: `${nockFolder}/`,
              stripHeaders: nockStripHeaders,
              reqHeaderOverwrite: nockReqHeaderOverwrite,
              strict: true,
              heal: nockHeal,
              modifiers: nockModifiers
            });
          }
          await beforeCb.call(this);
        })();
      });

      // eslint-disable-next-line func-names
      mocha.after(function () {
        return (async () => {
          if (requestRecorder !== null) {
            requestRecorder.shutdown();
            requestRecorder = null;
          }
          if (randomSeeder !== null) {
            randomSeeder.release();
            randomSeeder = null;
          }
          if (timeKeeper !== null) {
            timeKeeper.release();
            timeKeeper = null;
          }
          if (envManagerDesc !== null) {
            envManagerDesc.unapply();
            envManagerDesc = null;
          }
          if (envManagerFile !== null) {
            envManagerFile.unapply();
            envManagerFile = null;
          }
          await afterCb.call(this);
        })();
      });

      // eslint-disable-next-line func-names
      mocha.beforeEach(function () {
        return (async () => {
          if (cacheClearer !== null) {
            cacheClearer.inject();
          }
          if (useTmpDir === true) {
            tmp.setGracefulCleanup();
            dir = tmp.dirSync({ keep: false, unsafeCleanup: true }).name;
          }
          if (useNock === true) {
            await requestRecorder.inject(genCassetteName(this.currentTest));
          }
          if (record !== false) {
            logRecorder = LogRecorder({
              verbose: process.argv.slice(2).includes('--verbose'),
              logger: record
            });
            logRecorder.inject();
          }
          await beforeEachCb.call(this, getArgs());
        })();
      });

      // eslint-disable-next-line func-names
      mocha.afterEach(function () {
        return (async () => {
          await afterEachCb.call(this, getArgs());
          if (logRecorder !== null) {
            logRecorder.release();
            logRecorder = null;
          }
          if (requestRecorder !== null) {
            await requestRecorder.release();
          }
          if (dir !== null) {
            dir = null;
          }
          if (cacheClearer !== null) {
            cacheClearer.release();
          }
        })();
      });

      const globalsPrev = Object.keys(mocha)
        .reduce((p, key) => Object.assign(p, { [key]: global[key] }));
      global.it = (testName, fn) => mocha.it(
        testName,
        fn.length === 0 || /^[^(=]*\({/.test(fn.toString())
          // eslint-disable-next-line func-names
          ? function () {
            return fn.call(this, getArgs());
          }
          // eslint-disable-next-line func-names
          : function (done) {
            return fn.call(this, done);
          }
      );
      global.specify = global.it;
      global.describe = desc;
      global.context = global.describe;
      global.before = (fn) => {
        beforeCb = fn;
      };
      global.after = (fn) => {
        afterCb = fn;
      };
      global.beforeEach = (fn) => {
        beforeEachCb = fn;
      };
      global.afterEach = (fn) => {
        afterEachCb = fn;
      };
      await tests.call(this);
      Object.entries(globalsPrev).forEach(([k, v]) => {
        global[k] = v;
      });
    })();
  });
};
export default desc;
