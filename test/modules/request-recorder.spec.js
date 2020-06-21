const path = require('path');
const http = require('http');
const fs = require('smart-fs');
const expect = require('chai').expect;
const get = require('lodash.get');
const request = require('request-promise');
const { logger } = require('lambda-monitor-logger');
const aws = require('aws-sdk-wrap')({ logger });
const { describe } = require('../../src/index');
const RequestRecorder = require('../../src/modules/request-recorder');

const spawnServer = async () => {
  const listener = (req, resp) => {
    resp.writeHead(200);
    resp.write(JSON.stringify({ data: req.url.split('=')[1] }));
    resp.end();
  };
  const server = http.createServer(listener);
  await new Promise((resolve) => server.listen(resolve));
  return {
    uri: `http://localhost:${server.address().port}`,
    close: () => new Promise((resolve) => server.close(resolve))
  };
};

describe('Testing RequestRecorder', { useTmpDir: true, timestamp: 0 }, () => {
  const cassetteFile = 'file1.json';
  let tmpDir;
  let server;

  before(async () => {
    server = await spawnServer();
  });
  after(async () => {
    await server.close();
  });

  beforeEach(async ({ dir }) => {
    tmpDir = dir;
  });

  const nockRecord = async (fn, {
    stripHeaders = false,
    strict = false,
    heal = false
  }) => {
    const filePath = path.join(tmpDir, cassetteFile);

    const requestRecorder = RequestRecorder({
      cassetteFolder: tmpDir,
      stripHeaders,
      strict,
      heal
    });
    await requestRecorder.inject(path.basename(filePath));

    try {
      await fn();
    } finally {
      await requestRecorder.release();
      requestRecorder.shutdown();
    }

    return { cassette: fs.smartRead(filePath), ...requestRecorder.get() };
  };

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
        expect(await request({
          uri: `${server.uri}?q=${qs[idx]}`,
          body,
          json: true
        }))
          .to.deep.equal({ data: String(qs[idx]) });
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

  describe('Testing healing of recording', () => {
    let makeCassetteEntry;
    let runner;

    beforeEach(({ capture }) => {
      makeCassetteEntry = (id) => ({
        scope: server.uri,
        method: 'GET',
        path: `/?q=${id}`,
        body: { id: 123, payload: '15543754-fe97-43b5-9b49-7ddcc6cc60c6' },
        status: 200,
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
              body: {
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
          expect(e.message).to.match(/^Error: Nock: No match for request/);
        } else {
          await runTest({
            heal, qs, body, stripHeaders
          });
        }
        const content = fs.smartRead(cassettePath);
        if (heals) {
          expect(content[0].body.payload).to.not.equal(null);
          expect(content[0].path).to.equal(`/?q=${qs[0]}`);
          await runTest({ qs, body, stripHeaders });
        } else {
          expect(get(content, [0, 'body', 'payload'], null)).to.equal(null);
        }
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

    it('Testing magic healing (no magic)', async () => {
      await runner('magic', { qs: [2] });
    });

    it('Testing prune', async () => {
      await runner('prune,record', { qs: [1], raises: true, heals: true });
    });

    describe('Testing magic healing', { cryptoSeed: 'd28095c6-19f4-4dc2-a7cc-f7640c032967' }, () => {
      it('Testing heal SQS response', async ({ fixture }) => {
        fs.smartWrite(path.join(tmpDir, cassetteFile), fixture('sqs-cassette-bad'));
        const r = await nockRecord(() => aws.sqs.sendMessageBatch({
          messages: [{ k: 1 }, { k: 2 }],
          queueUrl: process.env.QUEUE_URL
        }), { heal: 'magic' });
        expect(r.expectedCassette).to.deep.equal(fixture('sqs-cassette-expected'));
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
        makeCassetteEntry(2),
        makeCassetteEntry(3)
      ]);
    });
  });
});
