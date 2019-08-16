const path = require('path');
const fs = require('smart-fs');
const callsite = require('callsite');
const get = require('lodash.get');
const tmp = require('tmp');
const nockBack = require('nock').back;
const Joi = require('joi-strict');
const EnvManager = require('./env-manager');
const timeKeeper = require('./time-keeper');
const ConsoleRecorder = require('./console-recorder');
const RandomSeeder = require('./random-seeder');

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

  const testFile = path.resolve(callsite()[1].getFileName());
  const envVarFile = `${testFile}.env.yml`;

  Joi.assert(opts, Joi.object().keys({
    useTmpDir: Joi.boolean().optional(),
    useNock: Joi.boolean().optional(),
    envVars: Joi.object().optional().unknown(true).pattern(Joi.string(), Joi.string()),
    timestamp: Joi.number().optional().min(0),
    recordConsole: Joi.boolean().optional(),
    seed: Joi.string().optional()
  }), 'Bad Options Provided');
  const useTmpDir = get(opts, 'useTmpDir', false);
  const useNock = get(opts, 'useNock', false);
  const envVars = get(opts, 'envVars', null);
  const timestamp = get(opts, 'timestamp', null);
  const recordConsole = get(opts, 'recordConsole', false);
  const seed = get(opts, 'seed', null);

  let dir = null;
  let nockDone = null;
  let envManagerFile = null;
  let envManagerDesc = null;
  let consoleRecorder = null;
  let randomSeeder = null;

  const getArgs = () => ({ dir, ...(consoleRecorder === null ? {} : { getLogs: consoleRecorder.get }) });
  let beforeCb = () => {};
  let afterCb = () => {};
  let beforeEachCb = () => {};
  let afterEachCb = () => {};

  describe(suiteName, () => {
    // eslint-disable-next-line func-names
    before(function () {
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
          timeKeeper.freeze(timestamp);
        }
        if (seed !== null) {
          randomSeeder = RandomSeeder();
          randomSeeder.seed(seed);
        }
        await beforeCb();
      })();
    });

    after(async () => {
      if (randomSeeder !== null) {
        randomSeeder.release();
        randomSeeder = null;
      }
      if (timeKeeper.isFrozen()) {
        timeKeeper.unfreeze();
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
    beforeEach(function () {
      return (async () => {
        if (useTmpDir === true) {
          tmp.setGracefulCleanup();
          dir = tmp.dirSync({ keep: false, unsafeCleanup: true }).name;
        }
        if (useNock === true) {
          nockBack.setMode('record');
          nockBack.fixtures = `${testFile}__cassettes/`;
          nockDone = await new Promise((resolve) => nockBack(genCassetteName(this.currentTest), {}, resolve));
        }
        if (recordConsole === true) {
          consoleRecorder = ConsoleRecorder(true);
          consoleRecorder.inject();
        }
        await beforeEachCb(getArgs());
      })();
    });

    afterEach(async () => {
      if (consoleRecorder !== null) {
        consoleRecorder.release();
        consoleRecorder = null;
      }
      if (nockDone !== null) {
        nockDone();
        nockDone = null;
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
      it: (testName, fn) => it(testName, () => fn(getArgs()))
    });
  });
};
