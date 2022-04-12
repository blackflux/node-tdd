import { expect } from 'chai';
import * as index from '../src/index.js';

describe('Testing index.js', () => {
  it('Testing exports', () => {
    expect(Object.keys(index)).to.deep.equal([
      'EnvManager',
      'LogRecorder',
      'RandomSeeder',
      'RequestRecorder',
      'TimeKeeper',
      'describe'
    ]);
  });
});
