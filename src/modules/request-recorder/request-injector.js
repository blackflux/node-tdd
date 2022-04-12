import assert from 'assert';
import http from 'http';
import https from 'https';
import nockCommon from 'nock/lib/common.js';

let lastProtocol = null;
let lastOptions = null;
const lastBody = [];

const wrapper = (proto) => {
  let requestOriginal = null;
  const protocol = { http, https }[proto];

  const requestWrapper = (...args) => {
    lastProtocol = proto;
    lastOptions = nockCommon.normalizeClientRequestArgs(...args).options;
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
      lastBody.length = 0;
    },
    release: () => {
      assert(protocol.request === requestWrapper, 'Release Failure');
      protocol.request = requestOriginal;
      requestOriginal = null;
    }
  };
};

export default (() => {
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
