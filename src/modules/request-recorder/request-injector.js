const assert = require('assert');
const http = require('http');

let requestOriginal;
let lastArgs = null;
const lastWrite = [];
const reset = () => {
  lastArgs = null;
  lastWrite.length = 0;
};

const fn = (...requestArgs) => {
  reset();
  lastArgs = requestArgs;

  const result = requestOriginal(...requestArgs);
  const writeOriginal = result.write;
  result.write = (...writeArgs) => {
    lastWrite.push(writeArgs);
    return writeOriginal(...writeArgs);
  };
  return result;
};

module.exports = {
  inject: () => {
    assert(http.request !== fn, 'Inject Failure');
    requestOriginal = http.request;
    http.request = fn;
  },
  release: () => {
    assert(http.request === fn, 'Release Failure');
    http.request = requestOriginal;
    reset();
  },
  getLast: () => ({
    options: lastArgs.filter((e) => typeof e !== 'function').slice(-1)[0],
    body: lastWrite
  })
};
