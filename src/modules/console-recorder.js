/* eslint-disable no-console */
const assert = require('assert');

const logLevels = ['log', 'info', 'error', 'warn'];

module.exports = (verbose) => {
  let consoleOriginal = null;
  let logs;
  return {
    inject: () => {
      assert(consoleOriginal === null);
      consoleOriginal = ['log', 'info', 'error', 'warn']
        .reduce((p, c) => Object.assign(p, { [c]: console[c] }), {});
      logs = [];
      logLevels.forEach((level) => {
        logs[level] = [];
      });
      Object.keys(consoleOriginal).forEach((logLevel) => {
        console[logLevel] = (...args) => {
          if (verbose === true) {
            consoleOriginal[logLevel](...args);
          }
          logs.push(...args);
          logs[logLevel].push(...args);
        };
      });
    },
    release: () => {
      assert(consoleOriginal !== null);
      Object.assign(console, consoleOriginal);
      consoleOriginal = null;
    },
    get: () => {
      const result = logs.slice();
      logLevels.forEach((level) => {
        result[level] = logs[level].slice();
      });
      return result;
    }
  };
};
