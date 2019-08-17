const expect = require('chai').expect;
const { describe } = require('../../src/index');
const TimeKeeper = require('../../src/modules/time-keeper');

describe('Testing TimeKeeper', () => {
  it('Testing Basic freeze', () => {
    const iso = '1970-01-01T00:00:00.000Z';
    const timeKeeper = TimeKeeper();
    expect(timeKeeper.isFrozen()).to.equal(false);
    expect(new Date().toISOString()).to.not.equal(iso);
    timeKeeper.freeze(0);
    expect(timeKeeper.isFrozen()).to.equal(true);
    expect(new Date().toISOString()).to.equal(iso);
    timeKeeper.unfreeze();
    expect(timeKeeper.isFrozen()).to.equal(false);
    expect(new Date().toISOString()).to.not.equal(iso);
  });
});
