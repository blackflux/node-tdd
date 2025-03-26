import path from 'path';
import https from 'https';
import fs from 'smart-fs';
import get from 'lodash.get';
import axios from '@blackflux/axios';
import { expect } from 'chai';
import { describe } from '../../src/index.js';
import { NockRecord, spawnServer } from '../server.js';

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
    heal = undefined,
    method = 'POST'
  } = {}) => nockRecord(
    async () => {
      for (let idx = 0; idx < qs.length; idx += 1) {
        // eslint-disable-next-line no-await-in-loop
        const { data } = await axios({
          url: `${server.uri}?q=${qs[idx]}`,
          ...(method === 'GET' ? {} : { data: body }),
          responseType: 'json',
          method
        });
        expect(data).to.deep.equal({ data: String(qs[idx]) });
      }
    },
    {
      stripHeaders,
      strict,
      heal,
      modifiers: {
        'JSON.stringify': JSON.stringify
      }
    }
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
      `POST ${server.uri}/?q=2`
    ]);
    expect(unmatchedRecordings).to.deep.equal([
      `POST ${server.uri}/?q=1`
    ]);
    expect(expectedCassette.map((e) => e.path)).to.deep.equal(['/?q=2']);
    expect(cassetteFilePath).to.equal(path.join(tmpDir, cassetteFile));
  });

  describe('Testing strict mode', () => {
    it('Testing incorrect recording ordering error', async ({ capture }) => {
      await runTest({ qs: [1, 2] });
      const e = await capture(() => runTest({ strict: true, qs: [2, 1] }));
      expect(e.message).to.equal(`Out of Order Recordings: POST ${server.uri}/?q=2`);
    });

    it('Testing unmatched recording error', async ({ capture }) => {
      await runTest({ qs: [1, 2] });
      const e = await capture(() => runTest({ strict: true, qs: [1] }));
      expect(e.message).to.equal(`Unmatched Recordings: POST ${server.uri}/?q=2`);
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
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
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

    it('Testing unknown modifiers (top level)', async ({ capture }) => {
      prepareCassette({
        'response|jsonStringify|toBase64': {},
        'body|jsonStringify|toBase64': {
          payload: {
            key: 'value'
          }
        }
      });
      const err = await capture(() => validate({
        json: true,
        body: {
          payload: {
            key: 'value'
          }
        },
        response: {}
      }));
      expect(err.message).to.deep.equal('Unknown Modifier(s) detected: jsonStringify, toBase64');
    });

    it('Testing unknown modifiers (nested)', async ({ capture }) => {
      prepareCassette({
        response: {},
        body: {
          'payload|jsonStringify|toBase64': {
            key: 'value'
          }
        }
      });

      const err = await capture(() => validate({
        json: true,
        body: {
          payload: {
            key: 'value'
          }
        },
        response: {}
      }));
      expect(err.message).to.deep.equal('Unknown Modifier(s) detected: jsonStringify, toBase64');
    });
  });

  describe('Testing healing of recording', () => {
    let makeCassetteEntry;
    let runner;
    let mkRequest;

    beforeEach(({ capture }) => {
      makeCassetteEntry = (id) => ({
        scope: server.uri,
        method: 'POST',
        path: `/?q=${id}`,
        body: { id: 123, payload: '15543754-fe97-43b5-9b49-7ddcc6cc60c6' },
        status: 200,
        reqheaders: {
          accept: 'application/json, text/plain, */*',
          'content-type': 'application/json',
          'accept-encoding': 'gzip, compress, deflate, br',
          connection: 'close',
          'user-agent': 'axios/1.7.9',
          'content-length': '59'
        },
        response: { data: `${id}` },
        responseIsBinary: false
      });
      runner = async (heal, {
        method = 'POST',
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
              method: 'POST',
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
            heal, qs, body, stripHeaders, method
          }));
          expect(e.code).to.equal('ERR_NOCK_NO_MATCH');
        } else {
          await runTest({
            heal, qs, body, stripHeaders, method
          });
        }
        const content = fs.smartRead(cassettePath);
        if (heals) {
          expect(content[0].body.payload).to.not.equal(null);
          expect(content[0].path).to.equal(`/?q=${qs[0]}`);
          await runTest({ qs, body, method });
        } else {
          expect(get(content, [0, 'body', 'payload'], null)).to.equal(null);
        }
      };
      mkRequest = async () => axios({
        method: 'POST',
        url: server.uri
      });
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

    it('Testing body healing with modifiers', async () => {
      const cassette = {
        ...makeCassetteEntry(1),
        method: 'POST',
        reqheaders: {
          accept: 'application/json, text/plain, */*',
          'content-type': 'application/json',
          'user-agent': 'axios/1.7.9',
          'content-length': '^\\d+$',
          'accept-encoding': 'gzip, compress, deflate, br'
        },
        body: {
          'data|JSON.stringify': { a: 1 },
          'other|JSON.stringify': { a: 1 }
        }
      };
      await runner('body', {
        raises: false,
        heals: true,
        body: {
          data: '{"a":1}',
          other: '{"a":2}'
        },
        method: 'POST',
        qs: [1],
        cassetteContent: [cassette]
      });
      const cassettePath = path.join(tmpDir, cassetteFile);
      const content = fs.smartRead(cassettePath);
      expect(content[0].body).to.deep.equal({
        'data|JSON.stringify': { a: 1 },
        other: '{"a":2}'
      });
    });

    it('Testing body healing with null body', async () => {
      await runner('body', { body: null });
    });

    it('Testing body healing with missing body', async () => {
      await runner('body', {
        body: {},
        cassetteContent: [
          {
            scope: server.uri,
            method: 'POST',
            path: '/?q=1',
            status: 200,
            reqheaders: {},
            response: { data: '1' },
            responseIsBinary: false
          }
        ]
      });
    });

    it('Testing missing body error', async ({ capture }) => {
      const err = await capture(() => runner(false, {
        body: {},
        cassetteContent: [
          {
            scope: server.uri,
            method: 'POST',
            path: '/?q=1',
            status: 200,
            reqheaders: {},
            response: { data: '1' },
            responseIsBinary: false
          }
        ]
      }));
      expect(err.message).to.deep.equal('Recording body mismatch');
    });

    it('Testing body healing with mismatched request method', async () => {
      await runner('body', { raises: true, heals: false, method: 'PATCH' });
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
            },
            rawHeaders: [
              'content-length',
              '777'
            ]
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
            'accept-encoding': 'gzip, compress, deflate, br',
            connection: 'close',
            'content-length': '59',
            'user-agent': '^axios/\\d+\\.\\d+\\.\\d+$'
          },
          rawHeaders: [
            'content-length',
            '12',
            'Content-Type',
            'application/json'
          ]
        })
      ]);
    });

    it('Testing magic healing (no magic)', async () => {
      await runner('magic', { qs: [2] });
    });

    it('Testing prune', async () => {
      await runner('prune,record', { method: 'GET', qs: [1], raises: true });
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
            ...cassetteContent[1].headers,
            date: 'Thu, 01 Jan 1970 00:00:00 GMT',
            'transfer-encoding': 'chunked'
          },
          reqheaders: {
            accept: 'application/json, text/plain, */*',
            'content-type': 'application/json',
            host: server.host,
            'content-length': '59',
            'accept-encoding': 'gzip, compress, deflate, br',
            connection: 'close',
            'user-agent': 'axios/1.7.9'
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
            'content-length': '59',
            'accept-encoding': 'gzip, compress, deflate, br',
            connection: 'close',
            'user-agent': 'axios/1.7.9'
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
        method: 'POST',
        path: '/',
        reqheaders: {
          accept: 'application/json, text/plain, */*',
          host: server.host,
          'accept-encoding': 'gzip, compress, deflate, br',
          connection: 'close',
          'content-type': 'application/json',
          'user-agent': 'axios/1.7.9',
          'transfer-encoding': 'chunked'
        },
        response: {},
        responseIsBinary: false,
        scope: server.uri,
        status: 200
      }]);
    });

    it('Testing nock not found', async ({ capture }) => {
      const cassettePath = path.join(tmpDir, cassetteFile);
      fs.smartWrite(cassettePath, [
        makeCassetteEntry(1),
        makeCassetteEntry(3)
      ]);
      const e = await capture(() => runTest({
        heal: false,
        qs: [1, 2, 3]
      }));
      expect(e.code).to.equal('ERR_NOCK_NO_MATCH');
      expect(e.status).to.equal(500);
    });

    it('Testing record (https)', async ({ capture }) => {
      const cassettePath = path.join(tmpDir, cassetteFile);
      fs.smartWrite(cassettePath, []);

      const agentHTTPS = new https.Agent({
        rejectUnauthorized: false
      });
      await capture(() => nockRecord(() => axios({
        method: 'POST',
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
        method: 'POST',
        path: '/?q=1',
        reqheaders: {
          accept: 'application/json, text/plain, */*',
          'accept-encoding': 'gzip, compress, deflate, br',
          connection: 'close',
          'content-type': 'application/json',
          host: `${server2.host} @ axios/1.7.9`,
          'transfer-encoding': 'chunked',
          'user-agent': '^axios/.*$'
        },
        response: {
          data: '1'
        },
        responseIsBinary: false,
        scope: server2.uri,
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
      expect(e.code).to.equal('ERR_NOCK_NO_MATCH');

      const cassetteContent = fs.smartRead(cassettePath);
      const stubCassette = Object.assign(makeCassetteEntry(2), { response: {} });
      delete stubCassette.reqheaders.connection;
      expect(cassetteContent).to.deep.equal([
        makeCassetteEntry(1),
        stubCassette,
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
        method: 'POST',
        body: '',
        path: '/',
        reqheaders: {
          accept: 'application/json, text/plain, */*',
          'accept-encoding': 'gzip, compress, deflate, br',
          'content-type': 'application/json',
          'user-agent': 'axios/1.7.9'
        },
        response: {},
        responseIsBinary: false,
        scope: server.uri,
        status: 200
      }]);
    });

    it('Testing question mark not removed', async ({ fixture }) => {
      const cassettePath = path.join(tmpDir, cassetteFile);
      fs.smartWrite(cassettePath, fixture('post-questionmark'));
      const { expectedCassette } = await nockRecord(() => axios({
        method: 'POST',
        url: 'https://test.com/',
        data: 'NEW'
      }), { heal: 'magic' });
      expect(expectedCassette).to.deep.equal([{ ...fixture('post-questionmark')[0], body: 'NEW' }]);
    });

    it('Testing question mark not added', async ({ fixture }) => {
      const cassettePath = path.join(tmpDir, cassetteFile);
      fs.smartWrite(cassettePath, fixture('post'));
      const { expectedCassette } = await nockRecord(() => axios({
        method: 'POST',
        url: 'https://test.com/?',
        data: 'NEW'
      }), { heal: 'magic' });
      expect(expectedCassette).to.deep.equal([{ ...fixture('post')[0], body: 'NEW' }]);
    });

    it('Testing hex response not changed', async ({ fixture }) => {
      const cassettePath = path.join(tmpDir, cassetteFile);
      fs.smartWrite(cassettePath, fixture('gzip'));
      const { expectedCassette } = await nockRecord(() => axios({
        method: 'POST',
        url: 'https://test.com/',
        headers: {
          'content-type': 'application/x-www-form-urlencoded'
        },
        data: 'DATA'
      }), { heal: 'response,headers' });
      const expected = [{ ...fixture('gzip')[0] }];
      expected[0].rawHeaders[5] = '373'; // response header got healed
      expect(expectedCassette).to.deep.equal(expected);
    });

    // todo: make sure this doesn't throw
    //  -> https://github.com/nock/nock/issues/2826
    // it('Testing recording get with body throws', async ({ capture }) => {
    //   const err = await capture(() => nockRecord(async () => {
    //     await axios({
    //       url: server.uri,
    //       responseType: 'json',
    //       data: {}, // <- this body is causing the problem
    //       method: 'GET'
    //     });
    //   }, { heal: 'record' }));
    //   expect(err.message).to.equal('123123123123');
    // });
  });
});
