import assert from 'assert';
import crypto from 'crypto';
import get from 'lodash.get';
import Joi from 'joi-strict';

const libs = { Math, crypto };

export default (opts) => {
  Joi.assert(opts, Joi.object().keys({
    seed: Joi.string(),
    reseed: Joi.boolean()
  }), 'Invalid Options Provided');
  let original = null;

  const byteToHex = [];
  for (let i = 0; i < 256; i += 1) {
    byteToHex[i] = (i + 0x100).toString(16).slice(1);
  }

  return {
    inject: () => {
      assert(original === null);

      original = {
        crypto: {
          randomBytes: crypto.randomBytes,
          randomFillSync: crypto.randomFillSync,
          randomUUID: crypto.randomUUID
        },
        Math: {
          random: Math.random
        }
      };
      const executionCounts = {};

      crypto.randomBytes = (size, cb) => {
        // randomization is seeded "per key"
        const stack = new Error().stack.split('\n');
        const subStack = stack.slice(stack.findIndex((e) => e.indexOf('/node_modules/') !== -1));
        const stackOrigin = get(subStack, [subStack.findIndex((e) => e.indexOf('/node_modules/') === -1) - 1], '');
        const originFile = get(stackOrigin.match(/^.*?\([^)]+?\/node_modules\/([^)]+):\d+:\d+\)$/), [1], '');
        const key = `${originFile}@${size}`;

        executionCounts[key] = opts.reseed === true ? null : (executionCounts[key] || 0) + 1;
        let result = crypto
          .createHash('sha256')
          .update(opts.seed)
          .update(opts.reseed === true ? 'null' : key)
          .update(String(executionCounts[key]))
          .digest();
        while (result.length < size) {
          result = Buffer.concat([result, crypto.createHash('sha256').update(result).digest()]);
        }

        result = result.slice(0, size);
        return cb ? cb(null, result) : result;
      };
      crypto.randomFillSync = (buffer, offset, size) => {
        const o = offset || 0;
        const s = size || buffer.byteLength;
        crypto.randomBytes(s, (err, res) => {
          res.copy(buffer, o, 0, s);
        });
        return buffer;
      };
      crypto.randomUUID = () => {
        const rnds = crypto.randomBytes(16);

        // Per 4.4, set bits for version and `clock_seq_hi_and_reserved`
        // eslint-disable-next-line no-bitwise
        rnds[6] = (rnds[6] & 0x0f) | 0x40;
        // eslint-disable-next-line no-bitwise
        rnds[8] = (rnds[8] & 0x3f) | 0x80;

        return `${
          byteToHex[rnds[0]]
        }${
          byteToHex[rnds[1]]
        }${
          byteToHex[rnds[2]]
        }${
          byteToHex[rnds[3]]
        }-${
          byteToHex[rnds[4]]
        }${
          byteToHex[rnds[5]]
        }-${
          byteToHex[rnds[6]]
        }${
          byteToHex[rnds[7]]
        }-${
          byteToHex[rnds[8]]
        }${
          byteToHex[rnds[9]]
        }-${
          byteToHex[rnds[10]]
        }${
          byteToHex[rnds[11]]
        }${
          byteToHex[rnds[12]]
        }${
          byteToHex[rnds[13]]
        }${
          byteToHex[rnds[14]]
        }${
          byteToHex[rnds[15]]
        }`;
      };
      Math.random = () => crypto.randomBytes(4).readUInt32LE() / 0xffffffff;
    },
    release: () => {
      assert(original !== null);
      Object.entries(original).forEach(([lib, v]) => {
        Object.entries(v).forEach(([method, org]) => {
          libs[lib][method] = org;
        });
      });
      original = null;
    },
    isInjected: () => original !== null
  };
};
