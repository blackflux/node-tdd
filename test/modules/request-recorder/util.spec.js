import { expect } from 'chai';
import { nullAsString } from '../../../src/modules/request-recorder/util.js';

describe('Testing request-recorder/util.js', () => {
  it('Testing null is String', async () => {
    expect(nullAsString(null)).to.equal('null');
  });
});
