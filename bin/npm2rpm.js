#! /usr/bin/env node

var npm2rpm = require('commander');

console.log('NPM2RPM');
console.log('-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-');
npm2rpm
  .option('-n, --name <name>', 'NodeJS module name')
  .option('-v, --version [version]', 'module version in X.Y.Z format')
  .option('-r, --release [release]', "RPM's release", 1)
  .option('-t, --template [template]', "RPM .spec template to use", 'default.n2r')
  .parse(process.argv);

var fs = require('fs');
var spec_file = fs.readFileSync(npm2rpm.template, { encoding: 'utf8' });
spec_file = replaceAttribute(spec_file, '\\$NAME', npm2rpm.name);
spec_file = replaceAttribute(spec_file, '\\$VERSION', npm2rpm.version);
spec_file = replaceAttribute(spec_file, '\\$RELEASE', npm2rpm.release);
console.log(spec_file);

function replaceAttribute(data, template_attr, replacement_text) {
  return data.replace(new RegExp(template_attr, 'g'), replacement_text);
}

function npmModule(name, version) {
  this.name = name;
  this.version = version;
  this.url = '';
  this.summary = '';
  this.license = '';
  this.project_url = '';
  this.description = '';
  this.files_to_copy = '';
  this.docfiles = '';
}
