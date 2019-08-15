const assert = require('assert');
const os = require('os');
const path = require('path');
const expect = require('chai').expect;
const desc = require('../src/index');

const dirPrefix = path.join(os.tmpdir(), 'tmp-');

desc('Testing dir', () => {
  desc('Testing Custom Before/After', ({ it, beforeEach, afterEach }) => {
    let beforeDir;

    beforeEach(({ dir }) => {
      assert(dir.startsWith(dirPrefix));
      beforeDir = dir;
    });

    afterEach(({ dir }) => {
      assert(dir.startsWith(dirPrefix));
    });

    it('Testing dir matched beforeEach dir', ({ dir }) => {
      expect(dir).to.equal(beforeDir);
    });
  });

  desc('Testing Defaults', ({ it }) => {
    it('Testing dir stars with prefix', ({ dir }) => {
      expect(dir.startsWith(dirPrefix)).to.equal(true);
    });
  });
});
