const path = require('path');
const http = require('http');
const fs = require('smart-fs');
const expect = require('chai').expect;
const request = require('request-promise');
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

  const runTest = async ({
    stripHeaders = false,
    strict = false,
    qs = [1],
    heal = false,
    body = {
      id: 123,
      payload: '15543754-fe97-43b5-9b49-7ddcc6cc60c6'
    }
  } = {}) => {
    const filePath = path.join(tmpDir, cassetteFile);

    const requestRecorder = RequestRecorder({
      cassetteFolder: tmpDir,
      stripHeaders,
      strict,
      heal
    });
    await requestRecorder.inject(path.basename(filePath));

    try {
      for (let idx = 0; idx < qs.length; idx += 1) {
        // eslint-disable-next-line no-await-in-loop
        expect(await request({
          uri: `${server.uri}?q=${qs[idx]}`,
          body,
          json: true
        }))
          .to.deep.equal({ data: String(qs[idx]) });
      }
    } finally {
      requestRecorder.release();
      requestRecorder.shutdown();
    }

    return { cassette: fs.smartRead(filePath), ...requestRecorder.get() };
  };

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
    let runner;

    beforeEach(({ capture }) => {
      runner = async (heal, heals, {
        method = 'GET',
        raises = true,
        body = undefined
      } = {}) => {
        const cassetteContent = [{
          scope: server.uri,
          method,
          path: '/?q=1',
          body: {
            id: 123,
            payload: null
          },
          status: 200,
          response: { data: '1' },
          responseIsBinary: false
        }];
        const cassettePath = path.join(tmpDir, cassetteFile);
        fs.smartWrite(cassettePath, cassetteContent);
        if (raises) {
          const e = await capture(() => runTest({ heal, body }));
          expect(e.message).to.match(/^Error: Nock: No match for request/);
        } else {
          await runTest({ heal, body });
        }
        const content = fs.smartRead(cassettePath);
        if (heals) {
          expect(content[0].body.payload).to.not.equal(null);
          await runTest({ body });
        }
      };
    });

    it('Testing healing without body matching', async () => {
      await runner(true, false);
    });

    it('Testing healing with body matching', async () => {
      await runner('body', true, { raises: false });
    });

    it('Testing healing with body matching and null', async () => {
      await runner('body', true, { raises: false, body: null });
    });

    it('Testing healing with unknown recording', async () => {
      await runner('body', false, { method: 'POST' });
    });

    it('Testing healing with undefined body matching', async () => {
      await runner('body', false, { raises: false });
    });

    it('Testing without healing', async () => {
      await runner(false, false);
    });
  });
});
