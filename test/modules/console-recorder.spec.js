/* eslint-disable no-console */
const expect = require('chai').expect;
const { describe } = require('../../src/index');
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
  const consoleRecorder = ConsoleRecorder({ verbose });
  consoleRecorder.inject();
  const recorder = consoleRecorder.recorder;
  recorder.verbose(false);
  console.log('test-log1');
  recorder.verbose(verbose);
  console.log('test-log2');
  console.error('test-log3');
  consoleRecorder.release();
  expect(recorder.get()).to.deep.equal(['test-log1', 'test-log2', 'test-log3']);
  expect(recorder.get('log')).to.deep.equal(['test-log1', 'test-log2']);
  expect(recorder.get('error')).to.deep.equal(['test-log3']);
  expect(recorder.get('warn')).to.deep.equal([]);
  expect(recorder.get('info')).to.deep.equal([]);
  if (verbose === true) {
    expect(logs).to.deep.equal(['test-log2', 'test-log3']);
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
