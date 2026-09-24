const request = require('request');
const tar = require('tar');

function downloadAndExtract(url, directory, callback) {
  let completed = false;

  function complete(error) {
    if (completed) {
      return;
    }
    completed = true;
    callback(error);
  }

  const download = request.get(url);
  download.on('error', complete);
  download.on('response', response => {
    if (response.statusCode < 200 || response.statusCode >= 300) {
      response.resume();
      const error = new Error(`npm registry returned HTTP ${response.statusCode}`);
      error.statusCode = response.statusCode;
      complete(error);
      return;
    }

    const extractor = tar.extract({cwd: directory});
    response.on('error', complete);
    extractor.on('error', complete);
    extractor.on('finish', () => complete());
    response.pipe(extractor);
  });
}

module.exports = downloadAndExtract;
