import assert from 'assert';
import crypto from 'crypto';
import { Buffer } from 'node:buffer';
import { expect } from 'chai';
import { describe } from '../../src/index.js';
import RandomSeeder from '../../src/modules/random-seeder.js';

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
        expect(crypto.randomUUID()).to.deep.equal('2942b215-a241-4108-84d4-d69b46d60704');
        expect(crypto.randomUUID()).to.deep.equal('b254d993-0840-4ffe-8857-f11021385fa4');
      });

      it('Testing Second', () => {
        expect(crypto.randomUUID()).to.deep.equal('2942b215-a241-4108-84d4-d69b46d60704');
        expect(crypto.randomUUID()).to.deep.equal('b254d993-0840-4ffe-8857-f11021385fa4');
      });
    });

    describe('Testing crypto.randomFillSync()', () => {
      it('Testing First', () => {
        const buffer = Buffer.alloc(16);
        crypto.randomFillSync(buffer);
        expect(buffer.toString('hex')).to.deep.equal('2942b215a241b10884d4d69b46d60704');
        crypto.randomFillSync(buffer);
        expect(buffer.toString('hex')).to.deep.equal('b254d9930840fffe8857f11021385fa4');
      });

      it('Testing Second', () => {
        const buffer = Buffer.alloc(16);
        crypto.randomFillSync(buffer);
        expect(buffer.toString('hex')).to.deep.equal('2942b215a241b10884d4d69b46d60704');
        crypto.randomFillSync(buffer);
        expect(buffer.toString('hex')).to.deep.equal('b254d9930840fffe8857f11021385fa4');
      });

      it('Testing First with Offset and Length', () => {
        const buffer = Buffer.alloc(16);
        crypto.randomFillSync(buffer, 4, 8);
        expect(buffer.toString('hex')).to.deep.equal('0000000006146e9ba205aae700000000');
        crypto.randomFillSync(buffer, 4, 8);
        expect(buffer.toString('hex')).to.deep.equal('0000000043d1f02caac9555600000000');
      });

      it('Testing Second with Offset and Length', () => {
        const buffer = Buffer.alloc(16);
        crypto.randomFillSync(buffer, 4, 8);
        expect(buffer.toString('hex')).to.deep.equal('0000000006146e9ba205aae700000000');
        crypto.randomFillSync(buffer, 4, 8);
        expect(buffer.toString('hex')).to.deep.equal('0000000043d1f02caac9555600000000');
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

    it('Testing Math.random()', () => {
      expect(Math.random()).to.equal(0.05960690161669788);
    });

    it('Testing Math.random() stable', () => {
      const count = 1000;
      let avg = 0;
      for (let idx = 0; idx < count; idx += 1) {
        avg += Math.random();
      }
      avg /= count;
      expect(avg).to.equal(0.4983554917758692);
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
      expect(crypto.randomUUID()).to.deep.equal('10c23ea5-f693-4ffc-a9af-266d01fd1087');
      expect(crypto.randomUUID()).to.deep.equal('10c23ea5-f693-4ffc-a9af-266d01fd1087');
    });
  });
});
