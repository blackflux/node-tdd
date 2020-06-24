const assert = require('assert');
const http = require('http');
const https = require('https');
const common = require('nock/lib/common');

let lastProtocol = null;
let lastOptions = null;
let lastBody = null;

const wrapper = (proto) => {
  let requestOriginal = null;
  const protocol = { http, https }[proto];

  const requestWrapper = (...args) => {
    lastProtocol = proto;
    lastOptions = common.normalizeClientRequestArgs(...args).options;
    lastBody = lastOptions.body;
    const result = requestOriginal(...args);
    const writeOriginal = result.write;
    result.write = (...chunks) => {
      if (lastBody === undefined) {
        lastBody = [];
      }
      if (Array.isArray(lastBody)) {
        lastBody.push(...chunks);
      }
      return writeOriginal(...chunks);
    };
    return result;
  };

  return {
    inject: () => {
      assert(protocol.request !== requestWrapper, 'Inject Failure');
      requestOriginal = protocol.request;
      protocol.request = requestWrapper;
    },
    release: () => {
      assert(protocol.request === requestWrapper, 'Release Failure');
      protocol.request = requestOriginal;
      lastProtocol = null;
      lastOptions = null;
      lastBody = null;
    }
  };
};

module.exports = (() => {
  const httpWrapper = wrapper('http');
  const httpsWrapper = wrapper('https');
  return {
    inject: () => {
      httpWrapper.inject();
      httpsWrapper.inject();
    },
    release: () => {
      httpWrapper.release();
      httpsWrapper.release();
    },
    getLast: () => ({
      protocol: lastProtocol,
      options: lastOptions,
      body: lastBody
    })
  };
})();
