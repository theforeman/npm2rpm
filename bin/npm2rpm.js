#! /usr/bin/env node
var colors = require('colors');
var fs = require('fs');
var npm2rpm = require('commander');

console.log('---- npm2rpm ----'.green.bold);
console.log('-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-'.rainbow.bgWhite);
npm2rpm
  .option('-n, --name <name>', 'NodeJS module name')
  .option('-v, --version [version]', 'module version in X.Y.Z format')
  .option('-r, --release [release]', "RPM's release", 1)
  .option('-t, --template [template]', "RPM .spec template to use", 'default.n2r')
  .parse(process.argv);

var npm_module = new npmModule(npm2rpm.name, npm2rpm.version);
var spec_file = fs.readFileSync(npm2rpm.template, { encoding: 'utf8' });
spec_file = replaceAttribute(spec_file, '\\$NAME', npm2rpm.name);
spec_file = replaceAttribute(spec_file, '\\$VERSION', npm2rpm.version);
spec_file = replaceAttribute(spec_file, '\\$RELEASE', npm2rpm.release);
spec_file = replaceAttribute(spec_file, '\\$LICENSE', npm_module.license);
spec_file = replaceAttribute(spec_file, '\\$SUMMARY', npm_module.summary);
spec_file = replaceAttribute(spec_file, '\\$PROJECTURL', npm_module.project_url);
spec_file = replaceAttribute(spec_file, '\\$DESCRIPTION', npm_module.description);
console.log(spec_file);

function replaceAttribute(data, template_attr, replacement_text) {
  return data.replace(new RegExp(template_attr, 'g'), replacement_text);
}

function npmModule(name, version) {
  this.name = name;
  this.version = version;
  this.url = 'http://registry.npmjs.org/' + name + '/-/' + name + '-' + version + '.tgz';

  var tar_stream = extractTar(downloadFromNPM())
	tar_stream.on('error', (error) => {
		console.log(error);
	})
  tar_stream.on('finish', () => {
		console.log('Finished extracting module');
    var package_json = JSON.parse(fs.readFileSync(this.tmp_dir + '/package/package.json'));
    set('description', package_json['description']);
    set('license', package_json['license']);
//		this.description = package_json['description'];
//		this.summary = this.description.split('\n')[0];
//		this.license = package_json['license'];
//		this.project_url = package_json['homepage']; ;
//		this.dependencies = package_json['dependencies'];
	})

	this.files_to_copy = '';
	this.docfiles = '';

  function downloadFromNPM() {
    var request = require('request');
	  console.log('Starting npm module download: ' + url);
		return request.get(this.url);
  }

  function createTempDir() {
    var tmp = require('tmp');
		var tmpDir = tmp.dirSync(
			{ mode: 6644,
				prefix: 'npm2rpm-',
				keep: true });
    this.tmp_dir = tmpDir.name;
    return tmpDir.name;
  }

  function extractTar(request_stream) {
    var targz = require('tar.gz');
		var tmpDir = createTempDir();
		var write_stream = targz().createWriteStream(tmpDir);
    console.log('Unpacking in ' + tmpDir + ' ...');
		return request_stream.pipe(write_stream)
  }
}
