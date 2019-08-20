const assert = require('assert');
const Joi = require('joi-strict');
const tk = require('timekeeper');

module.exports = (opts) => {
  Joi.assert(opts, Joi.object().keys({
    unix: Joi.number()
  }), 'Invalid Options Provided');
  return {
    inject: () => {
      assert(tk.isKeepingTime() === false);
      tk.freeze(new Date(opts.unix * 1000));
    },
    release: () => {
      assert(tk.isKeepingTime());
      tk.reset();
    },
    isInjected: () => tk.isKeepingTime()
  };
};
