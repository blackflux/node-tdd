import { expect } from 'chai';
import { describe } from '../../src/index.js';
import TimeKeeper from '../../src/modules/time-keeper.js';

describe('Testing TimeKeeper', () => {
  it('Testing Basic freeze (unix)', () => {
    const iso = '1970-01-01T00:00:00.000Z';
    const timeKeeper = TimeKeeper({ timestamp: Date.parse(iso) });
    expect(timeKeeper.isInjected()).to.equal(false);
    expect(new Date().toISOString()).to.not.equal(iso);
    timeKeeper.inject();
    expect(timeKeeper.isInjected()).to.equal(true);
    expect(new Date().toISOString()).to.equal(iso);
    timeKeeper.release();
    expect(timeKeeper.isInjected()).to.equal(false);
    expect(new Date().toISOString()).to.not.equal(iso);
  });

  it('Testing Basic freeze (string)', () => {
    const iso = '1970-01-01T00:00:00.000Z';
    const timeKeeper = TimeKeeper({ timestamp: iso });
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
