const assert = require('assert');
const tk = require('timekeeper');

module.exports = {
  freeze: (timestamp) => {
    assert(tk.isKeepingTime() === false);
    tk.freeze(new Date(timestamp * 1000));
  },
  unfreeze: () => {
    assert(tk.isKeepingTime());
    tk.reset();
  },
  isFrozen: () => tk.isKeepingTime()
};
