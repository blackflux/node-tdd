import qs from 'querystring';
import path from 'path';
import http from 'http';
import https from 'https';
import fs from 'smart-fs';
import RequestRecorder from '../src/modules/request-recorder.js';

export const spawnServer = async (proto = 'http') => {
  const listener = (req, resp) => {
    const params = qs.parse(req.url.split('?').pop());
    resp.writeHead(200, {
      date: new Date().toUTCString()
    });
    resp.write(JSON.stringify({ data: params.q }));
    resp.end();
  };
  const server = { http, https }[proto].createServer(proto === 'https' ? {
    key: fs.readFileSync(path.join(fs.dirname(import.meta.url), 'certs', 'my-server.key.pem')),
    cert: fs.readFileSync(path.join(fs.dirname(import.meta.url), 'certs', 'my-server.crt.pem'))
  } : {}, listener);
  await new Promise((resolve) => {
    server.listen(resolve);
  });
  const address = server.address();
  return {
    address,
    host: `localhost:${address.port}`,
    uri: `${proto}://localhost:${address.port}`,
    close: () => new Promise((resolve) => {
      server.close(resolve);
    })
  };
};

export const NockRecord = (tmpDir, cassetteFile) => async (fn, {
  stripHeaders = false,
  reqHeaderOverwrite = {},
  strict = false,
  heal = false,
  modifiers = {}
}) => {
  const filePath = path.join(tmpDir, cassetteFile);

  const requestRecorder = RequestRecorder({
    cassetteFolder: tmpDir,
    stripHeaders,
    reqHeaderOverwrite,
    strict,
    heal,
    modifiers
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
