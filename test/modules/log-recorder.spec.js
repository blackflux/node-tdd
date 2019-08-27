/* eslint-disable no-console */
const expect = require('chai').expect;
const { describe } = require('../../src/index');
const LogRecorder = require('../../src/modules/log-recorder');

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
  const logRecorder = LogRecorder({ verbose, logger: console });
  expect(logRecorder.levels())
    .to.deep.contain('log', 'debug', 'info', 'warn', 'error', 'dir');
  logRecorder.inject();
  logRecorder.verbose(false);
  console.log('test-log1');
  logRecorder.verbose(verbose);
  console.log('test-log2');
  console.error('test-log3');
  logRecorder.release();
  expect(logRecorder.get()).to.deep.equal(['test-log1', 'test-log2', 'test-log3']);
  expect(logRecorder.get('log')).to.deep.equal(['test-log1', 'test-log2']);
  expect(logRecorder.get('error')).to.deep.equal(['test-log3']);
  expect(logRecorder.get('warn')).to.deep.equal([]);
  expect(logRecorder.get('info')).to.deep.equal([]);
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
