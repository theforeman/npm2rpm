#! /usr/bin/env node
// NodeJS core
var async = require('async');
var fs = require('fs');
const execSync = require('child_process').execSync;
const path = require('path');
// NPM deps
var ls = require('npm-remote-ls').ls
var config = require('npm-remote-ls').config
var colors = require('colors');
var npm2rpm = require('commander');
var helpers = require('../lib/npm_helpers.js');
var npmModule = require('../lib/npm_module.js');
var specFileGenerator = require('../lib/spec_file_generator.js');

console.log('---- npm2rpm ----'.green.bold);
console.log('-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-'.rainbow.bgWhite);
npm2rpm
.option('-n, --name <name>', 'NodeJS module name')
.option('-v, --version <version>', 'module version in X.Y.Z format')
.option('-s, --strategy [strategy]', "Strategy to build the npm packages", /^(single|bundle)$/i)
.option('-r, --release [release]', "RPM's release", 1)
.option('-t, --template [template]', "RPM .spec template to use", path.join(__dirname,'/../template.mustache'))
.parse(process.argv);

// If a name is not provided, then npm2rpm.name defaults to calling 'commander' name() function
if (typeof(npm2rpm.name) === 'function' || typeof(npm2rpm.version) === 'function') {
  npm2rpm.help();
}

if (npm2rpm.strategy === undefined) {
  console.log(' - Undefined strategy - defaulting to single'.bold)
  npm2rpm.strategy = 'single';
}

var tar_extract = helpers.extractTar(helpers.downloadFromNPM(npm2rpm.name, npm2rpm.version));
tar_extract['stream'].on('error', (error) => {
	console.log('ERROR');
	console.log(error);
})
tar_extract['stream'].on('finish', () => {
	console.log(' - Finished extracting for '.bold + npm2rpm.name);
	console.log(' - Reading package.json for '.bold + npm2rpm.name);
	var package_json = JSON.parse(fs.readFileSync(tar_extract['location'] + '/package/package.json'));
	console.log(' - Finished reading package.json for '.bold + npm2rpm.name);
	npm_module_opts = {
		name: package_json['name'],
		version: package_json['version'],
		license: package_json['license'],
		description: package_json['description'],
		homepage: package_json['homepage'],
		bugs: package_json['bugs'],
		repository: package_json['repository'],
    tmp_location: tar_extract['location'],
		dependencies: package_json['dependencies'],
		binaries: package_json['bin'], // can be a string or a hash { binary: location }
		files: fs.readdirSync(tar_extract['location'] + '/package/'),
    bundle: (npm2rpm.strategy === 'bundle')
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

    if (npm_module.bundle) {
      console.log(' - Generating npm cache tgz... '.bold)
      createNpmCacheTar(npm_module);
      downloadDependencies(dependencies);
    } else {
      downloadDependencies([[npm_module.name, npm_module.version]])
    }
    //console.log(spec_file);
  });
})

function listDependencies(npm_module, callback) {
	config({
		development: false,
		optional: false
	});

	console.log(' - Fetching flattened list of production dependencies for '.bold + npm_module.name);
	ls(npm_module.name, npm_module.version, true, function (deps) {
		var dependencies_array = deps.map((dependency) => {
		  // Dependencies come as name@version
			dependency = dependency.split('@')
      return dependency;
		});

    callback(dependencies_array);
	});
}

function downloadDependencies(dependencies) {
  async.each(dependencies, (file, callback) => {
    var download_location = fs.createWriteStream('npm2rpm/SOURCES/' + file[0] + '-' + file[1] + '.tgz');
    var download_pipe = helpers.downloadFromNPM(file[0], file[1]).pipe(download_location);
    download_pipe.on('finish', () => {
      console.log('   - ' + file[0] + '-' + file[1] + ' finished'.green);
      callback(null)
    });
    download_pipe.on('error', (error) => {
      console.log('   - ' + file[0] + '-' + file[1] + ' failed to download'.red);
      callback(error);
    })
  }, (err) => {
    if(err) {
      console.log('Error: '.bold.red + err + ' failed to download'.bold.red);
    } else {
      console.log('All files have been processed successfully'.white.underline);
      console.log('Check out npm2rpm/SOURCES and npm2rpm/SPECS for the results.');
    }
  });
}

function createNpmCacheTar(npm_module) {
  var filename = npm_module.name + '-' + npm_module.version + '-registry.npmjs.org.tgz'
  execSync([path.join(__dirname, '/generate_npm_tarball.sh'), npm_module.name + '@' + npm_module.version,
           ' ', path.join('npm2rpm/SOURCES/', filename)].join(' '), {stdio:[0,1,2]});
}
