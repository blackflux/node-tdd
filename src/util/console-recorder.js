/* eslint-disable no-console */
const assert = require('assert');

module.exports = (verbose) => {
  let consoleOriginal = null;
  const logs = [];
  const defaultLogs = [];
  const errorLogs = [];
  return {
    inject: () => {
      assert(consoleOriginal === null);
      consoleOriginal = ['log', 'info', 'error', 'warn']
        .reduce((p, c) => Object.assign(p, { [c]: console[c] }), {});
      logs.length = 0;
      defaultLogs.length = 0;
      errorLogs.length = 0;
      Object.keys(consoleOriginal).forEach((logLevel) => {
        console[logLevel] = (...args) => {
          if (verbose === true) {
            consoleOriginal[logLevel](...args);
          }
          logs.push(...args);
          (['log', 'info'].includes(logLevel) ? defaultLogs : errorLogs).push(...args);
        };
      });
    },
    release: () => {
      assert(consoleOriginal !== null);
      Object.assign(console, consoleOriginal);
      consoleOriginal = null;
    },
    get: () => ({
      logs: logs.slice(),
      defaultLogs: defaultLogs.slice(),
      errorLogs: errorLogs.slice()
    })
  };
};
