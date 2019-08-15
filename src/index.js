const get = require('lodash.get');
const tmp = require('tmp');
const Joi = require('joi-strict');

module.exports = (suiteName, optsOrTests, testsOrNull = null) => {
  const opts = testsOrNull === null ? {} : optsOrTests;
  const tests = testsOrNull === null ? optsOrTests : testsOrNull;

  Joi.assert(opts, Joi.object().keys({
    useTmpDir: Joi.boolean().optional()
  }), 'Bad Options Provided');
  const useTmpDir = get(opts, 'useTmpDir', false);

  let dir = null;
  const getArgs = () => ({ dir });
  let beforeEachCb = () => {};
  let afterEachCb = () => {};

  describe(suiteName, () => {
    before(() => {
      tmp.setGracefulCleanup();
    });

    beforeEach(async () => {
      if (useTmpDir === true) {
        dir = tmp.dirSync({ keep: false, unsafeCleanup: true }).name;
      }
      await beforeEachCb(getArgs());
    });

    afterEach(async () => {
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
