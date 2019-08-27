const assert = require('assert');
const Joi = require('joi-strict');

module.exports = (opts) => {
  Joi.assert(opts, Joi.object().keys({
    logger: Joi.any(),
    verbose: Joi.boolean()
  }), 'Invalid Options Provided');
  const logger = opts.logger;
  let verbose = opts.verbose;
  let loggerOriginal = null;

  const logLevels = Object
    .entries(logger)
    .filter(([k, v]) => typeof v === 'function')
    .map(([k]) => k);
  assert(logLevels.length !== 0, 'Passed logger does not expose logging functionality');

  let logs;
  const reset = () => {
    logs = [];
    logLevels.forEach((level) => {
      logs[level] = [];
    });
  };

  return {
    inject: () => {
      assert(loggerOriginal === null);
      verbose = opts.verbose;
      loggerOriginal = logLevels
        .reduce((p, c) => Object.assign(p, { [c]: logger[c] }), {});
      reset();
      Object.keys(loggerOriginal).forEach((logLevel) => {
        logger[logLevel] = (...args) => {
          if (verbose === true) {
            loggerOriginal[logLevel](...args);
          }
          logs.push(...args);
          logs[logLevel].push(...args);
        };
      });
    },
    release: () => {
      assert(loggerOriginal !== null);
      Object.assign(logger, loggerOriginal);
      loggerOriginal = null;
    },
    verbose: (state) => {
      assert(typeof state === 'boolean');
      verbose = state;
    },
    levels: () => logLevels.slice(),
    get: (level = null) => {
      assert(level === null || logLevels.includes(level));
      return (level === null ? logs : logs[level]).slice();
    },
    reset
  };
};
