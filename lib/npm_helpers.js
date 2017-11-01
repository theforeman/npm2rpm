// NPM module download
var tar = require('tar');
var zlib = require('zlib');
var request = require('request');
var tmp = require('tmp');

module.exports.npmUrl = (name, version) => {
  return 'https://registry.npmjs.org/' + name + '/-/' + name + '-' + version + '.tgz';
}

module.exports.downloadFromNPM = (name, version) => {
  var url = this.npmUrl(name, version);
  console.log(' - Starting npm module download: '.bold + url );
  return request.get(url);
}

module.exports.extractTar = (request_stream) => {
  var tmpDir = createTempDir();
  console.log(' - Unpacking in '.bold + tmpDir + ' ...'.bold);
  var write_stream = tar.Extract({path: tmpDir, strip: 0})
  write_stream.on('error', (e) => { streamErrorCheck(e) });
  var gzip_stream = request_stream.pipe(zlib.createGunzip());
  gzip_stream.on('error', (e) => { streamErrorCheck(e) });
  return {
    stream: gzip_stream.pipe(write_stream),
    location: tmpDir
  }
}

function createTempDir() {
  var tmpDir = tmp.dirSync(
    { mode: 6644,
      prefix: 'npm2rpm-',
      keep: true });
      return tmpDir.name;
}

function streamErrorCheck(error) {
  console.log('ERROR'.red, '-', error.message);
  if (error.code === 'Z_DATA_ERROR') {
    console.log('Are you sure that the module name and version can be found on npmjs.org?'.bold);
  }
}
