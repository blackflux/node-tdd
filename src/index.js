const path = require('path');
const callsite = require('callsite');
const get = require('lodash.get');
const tmp = require('tmp');
const nockBack = require('nock').back;
const Joi = require('joi-strict');

const genCassetteName = (test) => {
  const names = [];
  let cTest = test;
  while (cTest !== undefined) {
    names.splice(0, 0, cTest.title);
    cTest = cTest.parent;
  }
  return names
    .filter((e) => !!e)
    .map((e) => e
      .replace(/[^a-zA-Z0-9_\-\\]+/g, '-')
      .replace(/^\w/, (c) => c.toLowerCase())
      .replace(/-([a-z])/g, (_, char) => char.toUpperCase()))
    .concat(['recording.json'])
    .join('_');
};

module.exports = (suiteName, optsOrTests, testsOrNull = null) => {
  const opts = testsOrNull === null ? {} : optsOrTests;
  const tests = testsOrNull === null ? optsOrTests : testsOrNull;

  const testFile = path.resolve(callsite()[1].getFileName());

  Joi.assert(opts, Joi.object().keys({
    useTmpDir: Joi.boolean().optional(),
    useNock: Joi.boolean().optional()
  }), 'Bad Options Provided');
  const useTmpDir = get(opts, 'useTmpDir', false);
  const useNock = get(opts, 'useNock', false);

  let dir = null;
  let nockDone = null;

  const getArgs = () => ({ dir });
  let beforeEachCb = () => {};
  let afterEachCb = () => {};

  describe(suiteName, () => {
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
        await beforeEachCb(getArgs());
      })();
    });

    afterEach(async () => {
      if (dir !== null) {
        dir = null;
      }
      if (nockDone !== null) {
        nockDone();
        nockDone = null;
      }
      await afterEachCb(getArgs());
    });

    tests({
      it: (testName, fn) => it(testName, () => fn(getArgs())),
      beforeEach: (fn) => {
        beforeEachCb = fn;
      },
      afterEach: (fn) => {
        afterEachCb = fn;
      }
    });
  });
};
