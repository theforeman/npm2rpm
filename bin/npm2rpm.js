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

npmModule(npm2rpm.name, npm2rpm.version);
//var spec_file = fs.readFileSync(npm2rpm.template, { encoding: 'utf8' });
//spec_file = replaceAttribute(spec_file, '\\$NAME', npm2rpm.name);
//spec_file = replaceAttribute(spec_file, '\\$VERSION', npm2rpm.version);
//spec_file = replaceAttribute(spec_file, '\\$RELEASE', npm2rpm.release);
//console.log(spec_file);

function replaceAttribute(data, template_attr, replacement_text) {
  return data.replace(new RegExp(template_attr, 'g'), replacement_text);
}

function npmModule(name, version) {
  this.name = name;
  this.version = version;
  this.url = 'http://registry.npmjs.org/' + name + '/-/' +
               name + '-' + version + '.tgz';
  downloadFromNPM();
  this.summary = '';
  this.license = '';
  this.project_url = '';
  this.description = '';
  this.files_to_copy = '';
  this.docfiles = '';

  function downloadFromNPM() {
    var request = require('request');
    var tar = require('tar.gz');
    var tmp = require('tmp');
		var tmpDir = tmp.dirSync({ mode: 0644, prefix: 'npm2rpm-', keep: true });
    tmpDir.removeCallback();
		console.log('Starting npm module ' + url + ' download to ' + tmpDir.name);
    console.log('Unpacking the tar...');
    var npm_file = request.get(this.url)
    var write_dir = tar().createWriteStream(tmpDir.name)
    npm_file.pipe(write_dir);

    //fs.createReadStream(tmpFile.name).pipe(tar.extract(tmpFile.name.slice(0, -4)))
    console.log('Tar unpacked!');
  }
}
