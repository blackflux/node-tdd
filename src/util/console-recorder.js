/* eslint-disable no-console */

module.exports = (verbose) => {
  const consoleOriginal = ['log', 'info', 'error', 'warn']
    .reduce((p, c) => Object.assign(p, { [c]: console[c] }), {});
  const logs = [];
  const defaultLogs = [];
  const errorLogs = [];
  return {
    inject: () => {
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
      Object.assign(console, consoleOriginal);
    },
    get: () => ({
      logs: logs.slice(),
      defaultLogs: defaultLogs.slice(),
      errorLogs: errorLogs.slice()
    })
  };
};
