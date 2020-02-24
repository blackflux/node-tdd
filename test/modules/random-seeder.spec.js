const assert = require('assert');
const expect = require('chai').expect;
const crypto = require('crypto');
const uuid4 = require('uuid/v4');
const { describe } = require('../../src/index');
const RandomSeeder = require('../../src/modules/random-seeder');

describe('Testing RandomSeeder', () => {
  describe('Testing RandomSeeder Not Reseeded', () => {
    let seeder;
    beforeEach(() => {
      seeder = RandomSeeder({ seed: 'test', reseed: false });
      seeder.inject();
    });

    afterEach(() => {
      seeder.release();
    });

    describe('Testing Random Consistent', () => {
      it('Testing First', () => {
        expect(uuid4()).to.deep.equal('85123163-cdd6-4a8c-9e47-aa0a7a0f6a91');
        expect(uuid4()).to.deep.equal('8d1831fe-751b-4aa1-80df-7f6c546e37c7');
      });

      it('Testing Second', () => {
        expect(uuid4()).to.deep.equal('85123163-cdd6-4a8c-9e47-aa0a7a0f6a91');
        expect(uuid4()).to.deep.equal('8d1831fe-751b-4aa1-80df-7f6c546e37c7');
      });
    });

    it('Testing Callback', (done) => {
      crypto.randomBytes(8, (err, resp) => {
        expect(err).to.equal(null);
        expect(resp.toString('hex')).to.equal('06146e9ba205aae7');
        done();
      });
    });

    it('Testing Long Random', (done) => {
      crypto.randomBytes(456, (err, resp) => {
        expect(err).to.equal(null);
        expect(resp.length).to.equal(456);
        expect(resp.toString('hex')).to.equal(
          '53d2261938c5fa990ca7f754bb6bc5d4fae96ba417200fe629b133e971c26d95b03bea12dd19c6467c52ef594b772a4f5773a5a55366'
          + '4895cffcf710660c1121ef93fd1f85a6fc9206bc8cdc758a7bd999ddb3b62348316d6012ebccd41da63ed69ef4f2fdf7fe0650c3c8'
          + 'ee43aa932db3139effc04fc48d85dc38193aaa8f76948fe454b3ff7489d912a497aa30a52b6662c81a7fb5c72e4312c56c0b027486'
          + 'e779f276daecf86cec380c3ce1550d944226c433a3059932d1cb031256fec498b6c48b8024ff65812b834ef37341493c252fc72ae4'
          + 'f780f3294be685a31b0f5c89ae3b1c6381a0f38b04b3bafcda2966a790005d287dd98cb0719dd7a6dbca9c15609f1aeff56b5455e0'
          + '7b5abcdffd2ad710112ea6864250a26617e1b94c53c17fd9b8192482dc60ef87d3207b707aaa944366283a6a81f6096dd59b7cc059'
          + '60663474bffd071cf79e5d914a3c3814a3fec33ae3754c6bd5ac574801244327e18e49872e7e8e9c3c8e20f4e746dfa5c7fae4c25a'
          + 'bc32031fbfdbf50c2e5d04934b64a4062ee0e3fb2667b6cceddd6a03ade2f08c84381314d77773ce75a6addf677acd4c4ec305b190'
          + '458461d78f65df1c582a11e360723d3f4a93efd9f9f86c809a40ed0d45a445'
        );
        done();
      });
    });
  });

  describe('Testing RandomSeeder Reseeded', () => {
    let seeder;
    beforeEach(() => {
      seeder = RandomSeeder({ seed: 'test', reseed: true });
      assert(seeder.isInjected() === false);
      seeder.inject();
      assert(seeder.isInjected() === true);
    });

    afterEach(() => {
      assert(seeder.isInjected() === true);
      seeder.release();
      assert(seeder.isInjected() === false);
    });

    it('Testing Random Consistent Reseeded', () => {
      expect(uuid4()).to.deep.equal('f5442998-b332-4abd-86e2-78bb848420f6');
      expect(uuid4()).to.deep.equal('f5442998-b332-4abd-86e2-78bb848420f6');
    });
  });
});
