import path from 'path';
import fs from 'smart-fs';
import { logger } from 'lambda-monitor-logger';
import { expect } from 'chai';
import awsSdkWrap from 'aws-sdk-wrap';
import { SendMessageBatchCommand, SQSClient } from '@aws-sdk/client-sqs';
import { describe } from '../../src/index.js';
import { NockRecord } from '../server.js';

const aws = awsSdkWrap({
  logger,
  services: {
    SQS: SQSClient,
    'SQS:CMD': {
      SendMessageBatchCommand
    }
  }
});

describe('Testing Response Healing', {
  useTmpDir: true,
  timestamp: 0,
  cryptoSeed: 'd28095c6-19f4-4dc2-a7cc-f7640c032967'
}, () => {
  const cassetteFile = 'file1.json';
  let tmpDir;
  let nockRecord;

  beforeEach(async ({ dir }) => {
    tmpDir = dir;
    nockRecord = NockRecord(tmpDir, cassetteFile);
  });

  it('Testing heal bad SQS response', async ({ fixture }) => {
    fs.smartWrite(path.join(tmpDir, cassetteFile), fixture('sqs-cassette-bad'));
    const r = await nockRecord(() => aws.sqs.sendMessageBatch({
      messages: [{ k: 1 }, { k: 2 }],
      queueUrl: process.env.QUEUE_URL
    }), { heal: 'magic' });
    const expected = fixture('sqs-cassette-bad-expected');
    expected[0].reqheaders['user-agent'] = r.expectedCassette[0].reqheaders['user-agent'];
    expect(r.expectedCassette[0].reqheaders['user-agent'].startsWith('aws-sdk-js/3.')).to.equal(true);
    expect(r.expectedCassette).to.deep.equal(expected);
  });

  it('Testing heal xml SQS response', async ({ fixture }) => {
    fs.smartWrite(path.join(tmpDir, cassetteFile), fixture('sqs-cassette-xml'));
    const r = await nockRecord(() => aws.sqs.sendMessageBatch({
      messages: [{ k: 1 }, { k: 2 }],
      queueUrl: process.env.QUEUE_URL
    }), { heal: 'magic' });
    const expected = fixture('sqs-cassette-xml-expected');
    expected[0].reqheaders['user-agent'] = r.expectedCassette[0].reqheaders['user-agent'];
    expect(r.expectedCassette[0].reqheaders['user-agent'].startsWith('aws-sdk-js/3.')).to.equal(true);
    expect(r.expectedCassette).to.deep.equal(expected);
  });
});
