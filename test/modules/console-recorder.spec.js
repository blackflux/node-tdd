/* eslint-disable no-console */
const expect = require('chai').expect;
const ConsoleRecorder = require('../../src/modules/console-recorder');

const testConsole = (verbose) => {
  const logs = [];
  const consoleLogOriginal = console.log;
  const consoleErrorOriginal = console.error;
  console.log = (...args) => {
    logs.push(...args);
  };
  console.error = (...args) => {
    logs.push(...args);
  };
  const consoleRecorder = ConsoleRecorder(verbose);
  consoleRecorder.inject();
  console.log('test-log1');
  console.log('test-log2');
  console.error('test-log3');
  consoleRecorder.release();
  const result = consoleRecorder.get();
  expect(result).to.deep.equal(['test-log1', 'test-log2', 'test-log3']);
  expect(result.log).to.deep.equal(['test-log1', 'test-log2']);
  expect(result.error).to.deep.equal(['test-log3']);
  expect(result.warn).to.deep.equal([]);
  expect(result.info).to.deep.equal([]);
  if (verbose === true) {
    expect(logs).to.deep.equal(['test-log1', 'test-log2', 'test-log3']);
  } else {
    expect(logs).to.deep.equal([]);
  }
  console.log = consoleLogOriginal;
  console.error = consoleErrorOriginal;
};

describe('Testing ConsoleRecorder', () => {
  it('Testing Logging Silent', () => {
    testConsole(false);
  });

  it('Testing Logging Verbose', () => {
    testConsole(true);
  });
});
