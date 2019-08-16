const path = require('path');
const fs = require('smart-fs');
const callsites = require('callsites');
const get = require('lodash.get');
const tmp = require('tmp');
const Joi = require('joi-strict');
const RequestRecorder = require('../modules/request-recorder');
const EnvManager = require('../modules/env-manager');
const TimeKeeper = require('../modules/time-keeper');
const ConsoleRecorder = require('../modules/console-recorder');
const RandomSeeder = require('../modules/random-seeder');
const MochaCensor = require('./mocha-censor');

const { mocha } = MochaCensor;

const getParents = (test) => {
  const names = [];
  let cTest = test;
  while (cTest !== undefined) {
    names.splice(0, 0, cTest.title);
    cTest = cTest.parent;
  }
  return names;
};

const genCassetteName = (test) => getParents(test)
  .filter((e) => !!e)
  .map((e) => e
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^\w/, (c) => c.toLowerCase())
    .replace(/-([a-zA-Z])/g, (_, char) => char.toUpperCase()))
  .concat(['recording.json'])
  .join('_');

module.exports = (suiteName, optsOrTests, testsOrNull = null) => {
  const opts = testsOrNull === null ? {} : optsOrTests;
  const tests = testsOrNull === null ? optsOrTests : testsOrNull;

  const testFile = path.resolve(callsites()[1].getFileName());
  const envVarFile = `${testFile}.env.yml`;

  Joi.assert(opts, Joi.object().keys({
    useTmpDir: Joi.boolean().optional(),
    useNock: Joi.boolean().optional(),
    envVars: Joi.object().optional().unknown(true).pattern(Joi.string(), Joi.string()),
    timestamp: Joi.number().optional().min(0),
    recordConsole: Joi.boolean().optional(),
    cryptoSeed: Joi.string().optional()
  }), 'Bad Options Provided');
  const useTmpDir = get(opts, 'useTmpDir', false);
  const useNock = get(opts, 'useNock', false);
  const envVars = get(opts, 'envVars', null);
  const timestamp = get(opts, 'timestamp', null);
  const recordConsole = get(opts, 'recordConsole', false);
  const cryptoSeed = get(opts, 'cryptoSeed', null);

  let dir = null;
  let requestRecorder = null;
  let envManagerFile = null;
  let envManagerDesc = null;
  let timeKeeper = null;
  let consoleRecorder = null;
  let randomSeeder = null;

  const getArgs = () => ({
    dir,
    ...(consoleRecorder === null ? {} : { getConsoleOutput: consoleRecorder.get })
  });
  let beforeCb = () => {};
  let afterCb = () => {};
  let beforeEachCb = () => {};
  let afterEachCb = () => {};

  const censor = MochaCensor();

  mocha.describe(suiteName, () => {
    censor.apply();

    // eslint-disable-next-line func-names
    mocha.before(function () {
      return (async () => {
        if (getParents(this.test).length === 3 && fs.existsSync(envVarFile)) {
          envManagerFile = EnvManager(fs.smartRead(envVarFile), false);
          envManagerFile.apply();
        }
        if (envVars !== null) {
          envManagerDesc = EnvManager(envVars, false);
          envManagerDesc.apply();
        }
        if (timestamp !== null) {
          timeKeeper = TimeKeeper();
          timeKeeper.freeze(timestamp);
        }
        if (cryptoSeed !== null) {
          randomSeeder = RandomSeeder();
          randomSeeder.seed(cryptoSeed);
        }
        await beforeCb();
      })();
    });

    mocha.after(async () => {
      if (randomSeeder !== null) {
        randomSeeder.release();
        randomSeeder = null;
      }
      if (timeKeeper !== null) {
        timeKeeper.unfreeze();
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
      await afterCb();
    });

    // eslint-disable-next-line func-names
    mocha.beforeEach(function () {
      return (async () => {
        if (useTmpDir === true) {
          tmp.setGracefulCleanup();
          dir = tmp.dirSync({ keep: false, unsafeCleanup: true }).name;
        }
        if (useNock === true) {
          requestRecorder = RequestRecorder(`${testFile}__cassettes/`);
          await requestRecorder.inject(genCassetteName(this.currentTest));
        }
        if (recordConsole === true) {
          consoleRecorder = ConsoleRecorder(true);
          consoleRecorder.inject();
        }
        await beforeEachCb(getArgs());
      })();
    });

    mocha.afterEach(async () => {
      if (consoleRecorder !== null) {
        consoleRecorder.release();
        consoleRecorder = null;
      }
      if (requestRecorder !== null) {
        requestRecorder.release();
        requestRecorder = null;
      }
      if (dir !== null) {
        dir = null;
      }
      await afterEachCb(getArgs());
    });

    tests({
      before: (fn) => {
        beforeCb = fn;
      },
      after: (fn) => {
        afterCb = fn;
      },
      beforeEach: (fn) => {
        beforeEachCb = fn;
      },
      afterEach: (fn) => {
        afterEachCb = fn;
      },
      it: (testName, fn) => mocha.it(testName, () => fn(getArgs()))
    });
    censor.unapply();
  });
};
