import assert from 'assert';
import LRU from 'lru-cache-ext';

const getMocks = (obj) => {
  const result = [];
  const keys = [];
  let o = obj;
  while (o instanceof Object) {
    keys.push(...Object.getOwnPropertyNames(o));
    o = Object.getPrototypeOf(o);
  }
  for (let i = 0; i < keys.length; i += 1) {
    const k = keys[i];
    const v = LRU.prototype[k];
    if (typeof v !== 'function') {
      // eslint-disable-next-line no-continue
      continue;
    }
    result.push({
      obj,
      key: k,
      value: v
    });
  }
  return result;
};

export default () => {
  let injected = false;
  const mocks = [
    ...getMocks(LRU.prototype)
  ];
  const caches = [];

  return {
    inject: () => {
      assert(injected === false);
      mocks.forEach(({ obj, key, value }) => {
        try {
          // eslint-disable-next-line no-param-reassign,func-names
          obj[key] = function (...args) {
            caches.push(this);
            return value.call(this, ...args);
          };
        } catch (e) { /* ignored */ }
      });
      injected = true;
    },
    release: () => {
      assert(injected === true);
      mocks.forEach(({ obj, key, value }) => {
        try {
          // eslint-disable-next-line no-param-reassign
          obj[key] = value;
        } catch (e) { /* ignored */ }
      });
      caches.splice(0).forEach((c) => c.clear());
      injected = false;
    },
    isInjected: () => injected
  };
};
