const assert = require('assert');
const http = require('http');
const common = require('nock/lib/common');

let requestOriginal = null;
let lastRequestOptions = null;

const requestWrapper = (...args) => {
  lastRequestOptions = common.normalizeClientRequestArgs(...args).options;
  return requestOriginal(...args);
};

module.exports = {
  inject: () => {
    assert(http.request !== requestWrapper, 'Inject Failure');
    requestOriginal = http.request;
    http.request = requestWrapper;
  },
  release: () => {
    assert(http.request === requestWrapper, 'Release Failure');
    http.request = requestOriginal;
    requestOriginal = null;
    lastRequestOptions = null;
  },
  getLastOptions: () => lastRequestOptions
};
