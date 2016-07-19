#! /usr/bin/env node
var colors = require('colors');
var fs = require('fs');
var npm2rpm = require('commander');
var helpers = require('../lib/npm_helpers.js');
var npmModule = require('../lib/npm_module.js');
var specFileGenerator = require('../lib/spec_file_generator.js');

console.log('---- npm2rpm ----'.green.bold);
console.log('-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-'.rainbow.bgWhite);
npm2rpm
.option('-n, --name <name>', 'NodeJS module name')
.option('-v, --version [version]', 'module version in X.Y.Z format')
.option('-r, --release [release]', "RPM's release", 1)
.option('-t, --template [template]', "RPM .spec template to use", 'default.n2r')
.parse(process.argv);

var tar_extract = helpers.extractTar(helpers.downloadFromNPM(npm2rpm.name, npm2rpm.version));
tar_extract['stream'].on('error', (error) => {
	console.log(error);
})
tar_extract['stream'].on('finish', (results) => {
	console.log(' - Finished extracting for '.bold + npm2rpm.name);
	console.log(' - Reading package.json for '.bold + npm2rpm.name);
	var package_json = JSON.parse(fs.readFileSync(tar_extract['location'] + '/package/package.json'));
	console.log(' - Finished reading package.json for '.bold + npm2rpm.name);
	npm_module_opts = {
		name: package_json['name'],
		version: package_json['version'],
		license: package_json['license'],
		description: package_json['description'],
		project_url: package_json['homepage'],
    tmp_location: tar_extract['location'],
		dependencies: package_json['dependencies'],
		binaries: package_json['bin'], // can be a string or a hash { binary: location }
		files: fs.readdirSync(tar_extract['location'] + '/package/')
	}

  var npm_module = new npmModule(npm_module_opts);
  listDependencies(npm_module, (dependencies) => {
    var spec_file = specFileGenerator(npm_module, dependencies, npm2rpm.release, npm2rpm.template);
    if (!fs.existsSync('npm2rpm'))
			fs.mkdirSync('npm2rpm');
		if (!fs.existsSync('npm2rpm/SOURCES'))
			fs.mkdirSync('npm2rpm/SOURCES');
		if (!fs.existsSync('npm2rpm/SPECS'))
			fs.mkdirSync('npm2rpm/SPECS');
    fs.writeFile('npm2rpm/SPECS/nodejs-' + npm_module.name + '.spec', spec_file);

    var async = require('async');
    console.log(spec_file);
  });
})

function listDependencies(npm_module, callback) {
	var ls = require('npm-remote-ls').ls
	var config = require('npm-remote-ls').config

	config({
		development: false,
		optional: false
	});

	console.log(' - Fetching flattened list of production dependencies'.bold);
	ls(npm_module.name, npm_module.version, true, function (deps) {
		var dependencies_array = deps.map((dependency) => {
		  // Dependencies come as name@version
			dependency = dependency.split('@')
      return dependency;
		});

    callback(dependencies_array);
	});
}

