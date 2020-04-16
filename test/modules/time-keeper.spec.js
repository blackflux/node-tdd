const expect = require('chai').expect;
const { describe } = require('../../src/index');
const TimeKeeper = require('../../src/modules/time-keeper');

describe('Testing TimeKeeper', () => {
  it('Testing Basic freeze', () => {
    const iso = '1970-01-01T00:00:00.000Z';
    const timeKeeper = TimeKeeper({ unix: 0 });
    expect(timeKeeper.isInjected()).to.equal(false);
    expect(new Date().toISOString()).to.not.equal(iso);
    timeKeeper.inject();
    expect(timeKeeper.isInjected()).to.equal(true);
    expect(new Date().toISOString()).to.equal(iso);
    timeKeeper.release();
    expect(timeKeeper.isInjected()).to.equal(false);
    expect(new Date().toISOString()).to.not.equal(iso);
  });
});