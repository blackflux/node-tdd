const nockCommon = require('nock/lib/common');

const fns = ['setInterval', 'setTimeout'];
const originals = fns.reduce((p, c) => Object.assign(p, {
  [c]: nockCommon[c]
}), {});

module.exports = {
  patch: () => {
    fns.forEach((fn) => {
      nockCommon[fn] = (...args) => {
        if (args[1] === 0) {
          return args[0](...args.slice(2));
        }
        return originals[fn](...args);
      };
    });
  },
  unpatch: () => {
    fns.forEach((fn) => {
      nockCommon[fn] = originals[fn];
    });
  }
};
