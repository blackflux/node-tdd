import nockCommon from 'nock/lib/common.js';

const fns = ['setInterval', 'setTimeout', 'deleteHeadersField'];
const originals = fns.reduce((p, c) => Object.assign(p, {
  [c]: nockCommon[c]
}), {});

export default {
  patch: () => {
    fns.forEach((fn) => {
      nockCommon[fn] = (...args) => {
        if (fn === 'deleteHeadersField') {
          return undefined;
        }
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
