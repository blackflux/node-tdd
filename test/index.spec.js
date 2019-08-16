const expect = require('chai').expect;
const index = require('../src/index');

describe('Testing index.js', () => {
  it('Testing exports', () => {
    expect(Object.keys(index)).to.deep.equal([
      'desc',
      'EnvManager',
      'timeKeeper',
      'ConsoleRecorder'
    ]);
  });
});
