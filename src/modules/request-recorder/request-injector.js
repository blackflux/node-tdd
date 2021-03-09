const assert = require('assert');
const http = require('http');
const https = require('https');
const common = require('nock/lib/common');

let lastProtocol = null;
let lastOptions = null;
const lastBody = [];

const wrapper = (proto) => {
  let requestOriginal = null;
  const protocol = { http, https }[proto];

  const requestWrapper = (...args) => {
    lastProtocol = proto;
    lastOptions = common.normalizeClientRequestArgs(...args).options;
    lastBody.length = 0;
    const result = requestOriginal.call(protocol, ...args);
    const writeOriginal = result.write;
    result.write = (chunk, encoding, callback) => {
      lastBody.push(chunk.toString());
      return writeOriginal.call(result, chunk, encoding, callback);
    };
    return result;
  };

  return {
    inject: () => {
      assert(protocol.request !== requestWrapper, 'Inject Failure');
      requestOriginal = protocol.request;
      protocol.request = requestWrapper;
      lastProtocol = null;
      lastOptions = null;
    },
    release: () => {
      assert(protocol.request === requestWrapper, 'Release Failure');
      protocol.request = requestOriginal;
      requestOriginal = null;
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
      body: lastBody.length === 0 ? undefined : lastBody.join('')
    })
  };
})();
