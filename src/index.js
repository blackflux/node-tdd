const tmp = require('tmp');

module.exports = (suiteName, tests) => {
  let dir = null;
  const getArgs = () => ({ dir });
  let beforeEachCb = () => {};
  let afterEachCb = () => {};

  describe(suiteName, () => {
    before(() => {
      tmp.setGracefulCleanup();
    });

    beforeEach(async () => {
      dir = tmp.dirSync({ keep: false, unsafeCleanup: true }).name;
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
