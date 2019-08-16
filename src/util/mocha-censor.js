const assert = require('assert');

const mocha = {
  it,
  describe,
  before,
  after,
  beforeEach,
  afterEach
};

module.exports = () => {
  let applied = null;
  return {
    apply: () => {
      assert(applied === null);
      applied = {};
      Object.keys(mocha).forEach((name) => {
        applied[name] = global[name];
        global[name] = () => {
          throw new Error(`Please use method "${name}" provided by node-tdd.`);
        };
      });
    },
    unapply: () => {
      assert(applied instanceof Object && !Array.isArray(applied));
      Object.keys(mocha).forEach((name) => {
        global[name] = applied[name];
      });
      applied = null;
    }
  };
};
module.exports.mocha = mocha;
