// NPM module download

module.exports.npmUrl = (name, version) => {
	return 'http://registry.npmjs.org/' + name + '/-/' + name + '-' + version + '.tgz';
}

module.exports.downloadFromNPM = (name, version) => {
	var request = require('request');
  var url = this.npmUrl(name, version);
	console.log(' - Starting npm module download: '.bold + url );
	return request.get(url);
}

module.exports.extractTar = (request_stream) => {
	var targz = require('tar.gz');
	var tmpDir = createTempDir();
	var write_stream = targz().createWriteStream(tmpDir);
	console.log(' - Unpacking in '.bold + tmpDir + ' ...'.bold);
	return { stream: request_stream.pipe(write_stream), location: tmpDir }
}

function createTempDir() {
	var tmp = require('tmp');
	var tmpDir = tmp.dirSync(
		{ mode: 6644,
			prefix: 'npm2rpm-',
			keep: true });
	return tmpDir.name;
}
