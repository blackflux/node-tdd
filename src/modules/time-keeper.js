const assert = require('assert');
const Joi = require('joi-strict');
const tk = require('timekeeper');

module.exports = (opts) => {
  Joi.assert(opts, Joi.object().keys({
    timestamp: Joi.alternatives(
      Joi.number().integer().min(0),
      Joi.date().iso()
    )
  }), 'Invalid Options Provided');
  return {
    inject: () => {
      assert(tk.isKeepingTime() === false);
      tk.freeze(
        Number.isInteger(opts.timestamp)
          ? new Date(opts.timestamp * 1000)
          : new Date(opts.timestamp)
      );
    },
    release: () => {
      assert(tk.isKeepingTime());
      tk.reset();
    },
    isInjected: () => tk.isKeepingTime()
  };
};
