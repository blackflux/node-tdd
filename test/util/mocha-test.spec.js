import { expect } from 'chai';
import describe from '../../src/util/desc.js';
import { genCassetteName } from '../../src/util/mocha-test.js';

describe('Testing mocha-test.js', () => {
  it('Testing genCassetteName', ({ dir }) => {
    const result = genCassetteName({
      title: 'Test Left 1, Right 5',
      parent: {
        title: 'Test Suite'
      }
    });
    expect(result).to.equal('testSuite_testLeft1Right5_recording.json');
  });
});
