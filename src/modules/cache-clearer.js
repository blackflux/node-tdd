import assert from 'assert';
import LRU from 'lru-cache-ext';

const getFns = (obj) => {
  const result = [];
  const properties = [];
  let o = obj;
  while (o instanceof Object) {
    properties.push(...Object.getOwnPropertyNames(o));
    o = Object.getPrototypeOf(o);
  }
  for (let i = 0; i < properties.length; i += 1) {
    const key = properties[i];
    const value = LRU.prototype[key];
    if (typeof value !== 'function') {
      // eslint-disable-next-line no-continue
      continue;
    }
    result.push({ obj, key, value });
  }
  return result;
};

export default () => {
  let injected = false;
  const fns = [
    ...getFns(LRU.prototype)
  ];
  const caches = [];

  return {
    inject: () => {
      assert(injected === false);
      fns.forEach(({ obj, key, value }) => {
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
      fns.forEach(({ obj, key, value }) => {
        try {
          // eslint-disable-next-line no-param-reassign
          obj[key] = value;
        } catch (e) { /* ignored */ }
      });
      caches.splice(0).forEach((c) => c.clear());
      injected = false;
    }
  };
};
