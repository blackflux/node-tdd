const expect = require('chai').expect;
const index = require('../src/index');

describe('Testing Package', () => {
  it('Testing Addition', () => {
    expect(index(7, 9)).to.equal(16);
  });
});
