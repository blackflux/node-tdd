import path from 'path';
import https from 'https';
import fs from 'smart-fs';
import get from 'lodash.get';
import axios from 'axios';
import { logger } from 'lambda-monitor-logger';
import { expect } from 'chai';
import AWS from 'aws-sdk';
import awsSdkWrap from 'aws-sdk-wrap';
import { describe } from '../../src/index.js';
import { spawnServer, NockRecord } from '../server.js';

const aws = awsSdkWrap({
  logger,
  services: {
    SQS: AWS.SQS
  }
});

describe('Testing RequestRecorder', { useTmpDir: true, timestamp: 0 }, () => {
  const cassetteFile = 'file1.json';
  let tmpDir;
  let server;
  let server2;
  let nockRecord;

  before(async () => {
    server = await spawnServer();
    server2 = await spawnServer('https');
  });
  after(async () => {
    await server.close();
    await server2.close();
  });

  beforeEach(async ({ dir }) => {
    tmpDir = dir;
    nockRecord = NockRecord(tmpDir, cassetteFile);
  });

  const runTest = ({
    qs = [1],
    body = {
      id: 123,
      payload: '15543754-fe97-43b5-9b49-7ddcc6cc60c6'
    },
    stripHeaders = undefined,
    strict = undefined,
    heal = undefined
  } = {}) => nockRecord(
    async () => {
      for (let idx = 0; idx < qs.length; idx += 1) {
        // eslint-disable-next-line no-await-in-loop
        const { data } = await axios({
          url: `${server.uri}?q=${qs[idx]}`,
          data: body,
          responseType: 'json'
        });
        expect(data).to.deep.equal({ data: String(qs[idx]) });
      }
    },
    { stripHeaders, strict, heal }
  );

  it('Testing headers captured', async () => {
    const { cassette } = await runTest();
    expect(cassette.length).to.equal(1);
    expect(cassette[0].status).to.equal(200);
    expect(cassette[0].rawHeaders).to.not.equal(undefined);
  });

  it('Testing headers stripped', async () => {
    const { cassette } = await runTest({ stripHeaders: true });
    expect(cassette.length).to.equal(1);
    expect(cassette[0].status).to.equal(200);
    expect(cassette[0].rawHeaders).to.equal(undefined);
  });

  it('Testing recorder output', async () => {
    await runTest({ qs: [1, 2] });
    const {
      cassette,
      records,
      outOfOrderErrors,
      unmatchedRecordings,
      expectedCassette,
      cassetteFilePath
    } = await runTest({ qs: [2] });
    expect(cassette.length).to.equal(2);
    expect(cassette).to.deep.equal(records);
    expect(outOfOrderErrors).to.deep.equal([
      `GET ${server.uri}/?q=2`
    ]);
    expect(unmatchedRecordings).to.deep.equal([
      `GET ${server.uri}/?q=1`
    ]);
    expect(expectedCassette.map((e) => e.path)).to.deep.equal(['/?q=2']);
    expect(cassetteFilePath).to.equal(path.join(tmpDir, cassetteFile));
  });

  describe('Testing strict mode', () => {
    it('Testing incorrect recording ordering error', async ({ capture }) => {
      await runTest({ qs: [1, 2] });
      const e = await capture(() => runTest({ strict: true, qs: [2, 1] }));
      expect(e.message).to.equal(`Out of Order Recordings: GET ${server.uri}/?q=2`);
    });

    it('Testing unmatched recording error', async ({ capture }) => {
      await runTest({ qs: [1, 2] });
      const e = await capture(() => runTest({ strict: true, qs: [1] }));
      expect(e.message).to.equal(`Unmatched Recordings: GET ${server.uri}/?q=2`);
    });
  });

  it('Testing shutdown finds unexpected file', async ({ capture }) => {
    fs.smartWrite(path.join(tmpDir, `${cassetteFile}_other.json`), []);
    const e = await capture(() => runTest());
    expect(e.message).to.equal('Unexpected file(s) in cassette folder: file1.json_other.json');
  });

  describe('Testing modifiers', { record: console }, () => {
    let prepareCassette;
    let validate;
    let defaultModifiers;
    beforeEach(() => {
      prepareCassette = (kwargs) => {
        const cassettePath = path.join(tmpDir, cassetteFile);
        fs.smartWrite(cassettePath, [{
          method: 'POST',
          path: '/',
          responseIsBinary: false,
          scope: server.uri,
          status: 200,
          ...kwargs
        }]);
      };
      validate = async ({
        body,
        response,
        modifiers = {},
        json = false
      }) => nockRecord(async () => {
        const { data } = await axios({
          method: 'POST',
          url: server.uri,
          data: body,
          responseType: json === true ? 'json' : undefined
        });
        expect(data).to.deep.equal(response);
      }, {
        stripHeaders: true,
        modifiers
      });
      defaultModifiers = {
        toBase64: (input) => Buffer.from(input).toString('base64'),
        jsonStringify: (input) => JSON.stringify(input)
      };
    });

    it('Testing modifiers (top level)', async ({ recorder }) => {
      prepareCassette({
        'response|jsonStringify|toBase64': {},
        'body|jsonStringify|toBase64': {
          payload: {
            key: 'value'
          }
        }
      });
      await validate({
        modifiers: defaultModifiers,
        body: 'eyJwYXlsb2FkIjp7ImtleSI6InZhbHVlIn19',
        response: 'e30='
      });
      expect(recorder.get()).to.deep.equal([]);
    });

    it('Testing modifiers (nested)', async ({ recorder }) => {
      prepareCassette({
        response: {
          'data|jsonStringify|toBase64': {}
        },
        body: {
          'payload|jsonStringify|toBase64': {
            key: 'value'
          }
        }
      });
      await validate({
        json: true,
        modifiers: defaultModifiers,
        body: { payload: 'eyJrZXkiOiJ2YWx1ZSJ9' },
        response: { data: 'e30=' }
      });
      expect(recorder.get()).to.deep.equal([]);
    });

    it('Testing unknown modifiers (top level)', async ({ recorder }) => {
      prepareCassette({
        'response|jsonStringify|toBase64': {},
        'body|jsonStringify|toBase64': {
          payload: {
            key: 'value'
          }
        }
      });
      await validate({
        json: true,
        body: undefined,
        response: ''
      });
      expect(recorder.get()).to.deep.equal([
        'Unknown Modifier(s) detected: jsonStringify, toBase64',
        'Unknown Modifier(s) detected: jsonStringify, toBase64'
      ]);
    });

    it('Testing unknown modifiers (nested)', async ({ recorder }) => {
      prepareCassette({
        response: {},
        body: {
          'payload|jsonStringify|toBase64': {
            key: 'value'
          }
        }
      });
      await validate({
        json: true,
        body: {
          'payload|jsonStringify|toBase64': {
            key: 'value'
          }
        },
        response: {}
      });
      expect(recorder.get()).to.deep.equal([
        'Unknown Modifier(s) detected: jsonStringify, toBase64'
      ]);
    });
  });

  describe('Testing healing of recording', () => {
    let makeCassetteEntry;
    let runner;
    let mkRequest;

    beforeEach(({ capture }) => {
      makeCassetteEntry = (id) => ({
        scope: server.uri,
        method: 'GET',
        path: `/?q=${id}`,
        body: { id: 123, payload: '15543754-fe97-43b5-9b49-7ddcc6cc60c6' },
        status: 200,
        reqheaders: {
          accept: 'application/json, text/plain, */*',
          'content-type': 'application/json',
          'user-agent': 'axios/0.26.1',
          'content-length': 59
        },
        response: { data: `${id}` },
        responseIsBinary: false
      });
      runner = async (heal, {
        method = 'GET',
        qs = [1],
        body = undefined,
        raises = false,
        heals = true,
        cassetteContent = null,
        stripHeaders = undefined
      } = {}) => {
        const cassettePath = path.join(tmpDir, cassetteFile);
        fs.smartWrite(
          cassettePath,
          cassetteContent === null
            ? [{
              scope: server.uri,
              method,
              path: '/?q=1',
              body: method === 'GET' ? '' : {
                id: 123,
                payload: null
              },
              status: 200,
              response: { data: String(qs[0]) },
              responseIsBinary: false
            }]
            : cassetteContent
        );
        if (raises) {
          const e = await capture(() => runTest({
            heal, qs, body, stripHeaders
          }));
          expect(e.message).to.match(/^Nock: No match for request/);
        } else {
          await runTest({
            heal, qs, body, stripHeaders
          });
        }
        const content = fs.smartRead(cassettePath);
        if (heals) {
          expect(content[0].body.payload).to.not.equal(null);
          expect(content[0].path).to.equal(`/?q=${qs[0]}`);
          await runTest({ qs, body });
        } else {
          expect(get(content, [0, 'body', 'payload'], null)).to.equal(null);
        }
      };
      mkRequest = async () => {
        await axios(server.uri);
      };
    });

    it('Testing without healing', async () => {
      await runner(false, { heals: false, raises: true });
    });

    it('Testing order healing', async () => {
      await runner(true, { heals: false, raises: true });
    });

    it('Testing body healing', async () => {
      await runner('body');
    });

    it('Testing body healing with null body', async () => {
      await runner('body', { body: null });
    });

    it('Testing body healing with mismatched request method', async () => {
      await runner('body', { raises: true, heals: false, method: 'POST' });
    });

    it('Testing body healing with mismatched request path', async () => {
      await runner('body', { qs: [2], raises: true, heals: false });
    });

    it('Testing path healing', async () => {
      await runner('path,body', { qs: [2] });
    });

    it('Testing heal headers', async () => {
      await runner('headers', {
        qs: [1],
        raises: false,
        heals: true,
        cassetteContent: [
          {
            ...makeCassetteEntry(1),
            reqheaders: {
              'content-type': 'other/type',
              'user-agent': '^axios/\\d+\\.\\d+\\.\\d+$'
            }
          }
        ]
      });

      const cassettePath = path.join(tmpDir, cassetteFile);
      const cassetteContent = fs.smartRead(cassettePath);
      expect(cassetteContent).to.deep.equal([
        Object.assign(makeCassetteEntry(1), {
          reqheaders: {
            accept: 'application/json, text/plain, */*',
            'content-type': 'application/json',
            host: server.host,
            'content-length': 59,
            'user-agent': '^axios/\\d+\\.\\d+\\.\\d+$'
          }
        })
      ]);
    });

    it('Testing magic healing (no magic)', async () => {
      await runner('magic', { qs: [2] });
    });

    it('Testing prune', async () => {
      await runner('prune,record', { qs: [1], raises: true });
    });

    describe('Testing magic healing', { cryptoSeed: 'd28095c6-19f4-4dc2-a7cc-f7640c032967' }, () => {
      it('Testing heal SQS response', async ({ fixture }) => {
        fs.smartWrite(path.join(tmpDir, cassetteFile), fixture('sqs-cassette-bad'));
        const r = await nockRecord(() => aws.sqs.sendMessageBatch({
          messages: [{ k: 1 }, { k: 2 }],
          queueUrl: process.env.QUEUE_URL
        }), { heal: 'magic' });
        const expected = fixture('sqs-cassette-expected');
        expected[0].reqheaders['user-agent'] = r.expectedCassette[0].reqheaders['user-agent'];
        expect(r.expectedCassette[0].reqheaders['user-agent'].startsWith('aws-sdk-nodejs/2.')).to.equal(true);
        expect(r.expectedCassette).to.deep.equal(expected);
      });
    });

    it('Testing record (with headers)', async () => {
      await runner('record', {
        qs: [1, 2, 3],
        raises: true,
        heals: true,
        cassetteContent: [
          makeCassetteEntry(1),
          makeCassetteEntry(3)
        ]
      });

      const cassettePath = path.join(tmpDir, cassetteFile);
      const cassetteContent = fs.smartRead(cassettePath);
      expect(cassetteContent).to.deep.equal([
        makeCassetteEntry(1),
        Object.assign(makeCassetteEntry(2), {
          headers: {
            connection: 'close',
            date: 'Thu, 01 Jan 1970 00:00:00 GMT',
            'transfer-encoding': 'chunked'
          },
          reqheaders: {
            accept: 'application/json, text/plain, */*',
            'content-type': 'application/json',
            host: server.host,
            'content-length': 59,
            'user-agent': 'axios/0.26.1'
          }
        }),
        makeCassetteEntry(3)
      ]);
    });

    it('Testing record (without headers)', async () => {
      await runner('record', {
        qs: [1, 2, 3],
        raises: true,
        heals: true,
        cassetteContent: [
          makeCassetteEntry(1),
          makeCassetteEntry(3)
        ],
        stripHeaders: true
      });

      const cassettePath = path.join(tmpDir, cassetteFile);
      const cassetteContent = fs.smartRead(cassettePath);
      expect(cassetteContent).to.deep.equal([
        makeCassetteEntry(1),
        Object.assign(makeCassetteEntry(2), {
          reqheaders: {
            accept: 'application/json, text/plain, */*',
            'content-type': 'application/json',
            host: server.host,
            'content-length': 59,
            'user-agent': 'axios/0.26.1'
          }
        }),
        makeCassetteEntry(3)
      ]);
    });

    it('Testing record (empty cassette)', async ({ capture }) => {
      const cassettePath = path.join(tmpDir, cassetteFile);
      fs.smartWrite(cassettePath, []);

      await capture(() => nockRecord(mkRequest, { stripHeaders: true, heal: 'record' }));

      const cassetteContent = fs.smartRead(cassettePath);
      expect(cassetteContent).to.deep.equal([{
        body: '',
        method: 'GET',
        path: '/',
        reqheaders: {
          accept: 'application/json, text/plain, */*',
          host: server.host,
          'user-agent': 'axios/0.26.1'
        },
        response: {},
        responseIsBinary: false,
        scope: server.uri,
        status: 200
      }]);
    });

    it('Testing record (https)', async ({ capture }) => {
      const cassettePath = path.join(tmpDir, cassetteFile);
      fs.smartWrite(cassettePath, []);

      const agentHTTPS = new https.Agent({
        rejectUnauthorized: false
      });
      await capture(() => nockRecord(() => axios({
        method: 'GET',
        url: `${server2.uri}/?q=1`,
        httpsAgent: agentHTTPS
      }), {
        stripHeaders: true,
        heal: 'record',
        reqHeaderOverwrite: {
          'user-agent': '^axios/.*$',
          host: ({ value, headers }) => `${value} @ ${headers['user-agent']}`
        }
      }));

      const cassetteContent = fs.smartRead(cassettePath);
      expect(cassetteContent).to.deep.equal([{
        body: '',
        method: 'GET',
        path: '/?q=1',
        reqheaders: {
          accept: 'application/json, text/plain, */*',
          host: `${server2.host} @ axios/0.26.1`,
          'user-agent': '^axios/.*$'
        },
        response: {
          data: '1'
        },
        responseIsBinary: false,
        scope: server2.uri.replace('https', 'http'),
        status: 200
      }]);
    });

    it('Testing stub', async ({ capture }) => {
      const cassettePath = path.join(tmpDir, cassetteFile);
      fs.smartWrite(cassettePath, [
        makeCassetteEntry(1),
        makeCassetteEntry(3)
      ]);
      const e = await capture(() => runTest({
        heal: 'stub',
        qs: [1, 2, 3]
      }));
      expect(e.message).to.match(/^Nock: No match for request/);

      const cassetteContent = fs.smartRead(cassettePath);
      expect(cassetteContent).to.deep.equal([
        makeCassetteEntry(1),
        Object.assign(makeCassetteEntry(2), { response: {} }),
        makeCassetteEntry(3)
      ]);
    });

    it('Testing delay', async () => {
      const cassettePath = path.join(tmpDir, cassetteFile);
      fs.smartWrite(cassettePath, [
        makeCassetteEntry(1),
        Object.assign(makeCassetteEntry(2), {
          delayBody: 500,
          delayConnection: 500
        })
      ]);
      const startTime = process.hrtime();
      await runTest({
        heal: false,
        qs: [1, 2]
      });
      const elapsed = process.hrtime(startTime);
      const elapsedSeconds = elapsed[0] + (elapsed[1] / 1e9);
      expect(elapsedSeconds).to.be.greaterThan(1);
    });

    it('Testing stub (empty cassette)', async ({ capture }) => {
      const cassettePath = path.join(tmpDir, cassetteFile);
      fs.smartWrite(cassettePath, []);

      await capture(() => nockRecord(mkRequest, { stripHeaders: true, heal: 'stub' }));

      const cassetteContent = fs.smartRead(cassettePath);
      expect(cassetteContent).to.deep.equal([{
        method: 'GET',
        path: '/',
        reqheaders: {
          accept: 'application/json, text/plain, */*',
          'user-agent': 'axios/0.26.1'
        },
        response: {},
        responseIsBinary: false,
        scope: server.uri,
        status: 200
      }]);
    });
  });
});
