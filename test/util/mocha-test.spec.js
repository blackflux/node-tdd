const expect = require('chai').expect;
const describe = require('../../src/util/desc');
const { genCassetteName } = require('../../src/util/mocha-test');


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
