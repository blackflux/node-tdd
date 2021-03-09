const expect = require('chai').expect;
const util = require('../../../src/modules/request-recorder/util');

describe('Testing request-recorder/util.js', () => {
  it('Testing null is String', async () => {
    expect(util.nullAsString(null)).to.equal('null');
  });
});
