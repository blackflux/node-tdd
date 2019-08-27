/* eslint-disable no-console */
const assert = require('assert');
const Joi = require('joi-strict');

const logLevels = ['log', 'info', 'error', 'warn'];

module.exports = (opts) => {
  Joi.assert(opts, Joi.object().keys({
    verbose: Joi.boolean()
  }), 'Invalid Options Provided');
  let verbose = opts.verbose;
  let consoleOriginal = null;

  let logs;
  const reset = () => {
    logs = [];
    logLevels.forEach((level) => {
      logs[level] = [];
    });
  };

  return {
    inject: () => {
      assert(consoleOriginal === null);
      verbose = opts.verbose;
      consoleOriginal = logLevels
        .reduce((p, c) => Object.assign(p, { [c]: console[c] }), {});
      reset();
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
    recorder: {
      verbose: (state) => {
        assert(consoleOriginal !== null);
        assert(typeof state === 'boolean');
        verbose = state;
      },
      get: (level = null) => {
        assert(consoleOriginal !== null);
        assert(level === null || logLevels.includes(level));
        return (level === null ? logs : logs[level]).slice();
      },
      reset: () => {
        assert(consoleOriginal !== null);
        reset();
      }
    }
  };
};
