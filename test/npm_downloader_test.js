const assert = require('assert');
const fs = require('fs');
const http = require('http');
const tmp = require('tmp');
const downloadAndExtract = require('../lib/npm_downloader.js');

describe('downloadAndExtract', () => {
  let server;

  afterEach(done => {
    if (server && server.listening) {
      server.close(done);
    } else {
      done();
    }
  });

  it('reports a registry HTTP error without extracting the response', done => {
    server = http.createServer((_request, response) => {
      response.writeHead(404, {'Content-Type': 'application/json'});
      response.end('{"error":"Not found"}');
    });

    server.listen(0, '127.0.0.1', () => {
      const directory = tmp.dirSync();
      const url = `http://127.0.0.1:${server.address().port}/missing.tgz`;

      downloadAndExtract(url, directory.name, error => {
        assert(error);
        assert.equal(error.statusCode, 404);
        assert.equal(error.message, 'npm registry returned HTTP 404');
        assert.deepEqual(fs.readdirSync(directory.name), []);
        directory.removeCallback();
        done();
      });
    });
  });
});
