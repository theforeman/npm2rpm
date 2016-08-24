// NPM module download
var targz = require('tar.gz');
var request = require('request');
var tmp = require('tmp');

module.exports.npmUrl = (name, version) => {
	return 'http://registry.npmjs.org/' + name + '/-/' + name + '-' + version + '.tgz';
}

module.exports.downloadFromNPM = (name, version) => {
  var url = this.npmUrl(name, version);
	console.log(' - Starting npm module download: '.bold + url );
	return request.get(url);
}

module.exports.extractTar = (request_stream) => {
	var tmpDir = createTempDir();
	var write_stream = targz().createWriteStream(tmpDir);
	console.log(' - Unpacking in '.bold + tmpDir + ' ...'.bold);
	return { stream: request_stream.pipe(write_stream), location: tmpDir }
}

function createTempDir() {
	var tmpDir = tmp.dirSync(
		{ mode: 6644,
			prefix: 'npm2rpm-',
			keep: true });
	return tmpDir.name;
}
