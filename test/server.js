const http = require('http');
const https = require('https');

module.exports.spawnServer = async (proto = 'http') => {
  const listener = (req, resp) => {
    resp.writeHead(200);
    resp.write(JSON.stringify({ data: req.url.split('=')[1] }));
    resp.end();
  };
  const server = { http, https }[proto].createServer(listener);
  await new Promise((resolve) => server.listen(resolve));
  return {
    uri: `${proto}://localhost:${server.address().port}`,
    close: () => new Promise((resolve) => server.close(resolve))
  };
};
