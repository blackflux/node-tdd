const assert = require('assert');
const tk = require('timekeeper');

module.exports = () => ({
  freeze: (unix) => {
    assert(tk.isKeepingTime() === false);
    tk.freeze(new Date(unix * 1000));
  },
  unfreeze: () => {
    assert(tk.isKeepingTime());
    tk.reset();
  },
  isFrozen: () => tk.isKeepingTime()
});
