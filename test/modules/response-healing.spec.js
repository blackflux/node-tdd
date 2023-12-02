import path from 'path';
import fs from 'smart-fs';
import { logger } from 'lambda-monitor-logger';
import { expect } from 'chai';
import awsSdkWrap from 'aws-sdk-wrap';
import {
  SQSClient,
  SendMessageBatchCommand,
  GetQueueUrlCommand,
  GetQueueAttributesCommand,
  ListQueueTagsCommand,
  CreateQueueCommand,
  ListQueuesCommand,
  TagQueueCommand,
  SetQueueAttributesCommand
} from '@aws-sdk/client-sqs';
import objectScan from 'object-scan';
import { describe } from '../../src/index.js';
import { NockRecord } from '../server.js';
import reqHeaderOverwrite from '../req-header-overwrite.js';

const aws = awsSdkWrap({
  logger,
  services: {
    SQS: SQSClient,
    'SQS:CMD': {
      SendMessageBatchCommand,
      GetQueueUrlCommand,
      GetQueueAttributesCommand,
      ListQueueTagsCommand,
      CreateQueueCommand,
      ListQueuesCommand,
      TagQueueCommand,
      SetQueueAttributesCommand
    }
  }
});

const fixtureFolder = `${fs.filename(import.meta.url)}__fixtures`;
const files = fs
  .walkDir(fixtureFolder)
  .filter((f) => !f.endsWith('.json__expected.json'));

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

  // eslint-disable-next-line mocha/no-setup-in-describe
  files.forEach((f) => {
    it(`Testing ${f}`, async ({ fixture }) => {
      const { fn, params, cassette } = fixture(f);
      fs.smartWrite(path.join(tmpDir, cassetteFile), cassette);
      const func = fn.split('.').reduce((p, v) => p[v], aws);
      objectScan(['**'], {
        filterFn: ({ value, parent, property }) => {
          if (value === '$queueUrl') {
            // eslint-disable-next-line no-param-reassign
            parent[property] = process.env.QUEUE_URL;
          }
        }
      })(params);
      const r = await nockRecord(() => func(...params), { heal: 'magic', reqHeaderOverwrite });
      const outFile = path.join(fixtureFolder, `${f}__expected.json`);
      const overwritten = fs.smartWrite(outFile, r.expectedCassette);
      expect(overwritten).to.deep.equal(false);
    });
  });
});
