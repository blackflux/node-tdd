import assert from 'assert';
import Joi from 'joi-strict';

const setEnvVar = (key, value) => {
  if ([null, undefined].includes(value)) {
    delete process.env[key];
  } else {
    assert(typeof value === 'string');
    process.env[key] = value;
  }
};

export default (opts) => {
  Joi.assert(opts, Joi.object().keys({
    envVars: Joi.object().pattern(Joi.string(), Joi.string()),
    allowOverwrite: Joi.boolean()
  }), 'Invalid Options Provided');
  const envVarsOverwritten = {};
  return {
    apply: () => {
      envVarsOverwritten.length = 0;
      Object.entries(opts.envVars).forEach(([key, value]) => {
        const envVar = key.replace(/^\^/, '');
        if (opts.allowOverwrite === true || key.startsWith('^')) {
          envVarsOverwritten[envVar] = process.env[envVar];
        } else {
          assert(process.env[envVar] === undefined, `Environment Variable Set: ${envVar}`);
        }
        setEnvVar(envVar, value);
      });
    },
    unapply: () => {
      Object.keys(opts.envVars).forEach((key) => {
        const envVar = key.replace(/^\^/, '');
        assert(typeof process.env[envVar] === 'string', `Environment Variable Set: ${envVar}`);
        setEnvVar(envVar, envVarsOverwritten[envVar]);
      });
    }
  };
};
