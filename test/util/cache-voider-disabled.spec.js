import LRU from 'lru-cache-ext';
import { expect } from 'chai';
import describe from '../../src/util/desc.js';

describe('Testing Cache Reset Disabled', { voidCache: false }, () => {
  let cache;
  before(() => {
    cache = new LRU({ ttl: 100, max: 100 });
  });

  it('First', () => {
    expect(cache.has('a')).to.equal(false);
    cache.set('a', 1);
  });

  it('Second', () => {
    expect(cache.has('a')).to.equal(true);
  });
});
