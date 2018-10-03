#!/usr/bin/env node
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
var normalizeData = require('normalize-package-data');
var helpers = require('../lib/npm_helpers.js');
var specFileGenerator = require('../lib/spec_file_generator.js');

console.log('---- npm2rpm ----'.green.bold);
console.log('-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-'.rainbow.bgWhite);
npm2rpm
.option('-n, --name <name>', 'NodeJS module name')
.option('-v, --version <version>', 'module version in X.Y.Z format')
.option('-s, --strategy [strategy]', "Strategy to build the npm packages", /^(single|bundle)$/i)
.option('-r, --release [release]', "RPM's release", 1)
.option('-t, --template [template]', "RPM .spec template to use")
.parse(process.argv);

// If a name is not provided, then npm2rpm.name defaults to calling 'commander' name() function
if (typeof(npm2rpm.name) === 'function' || typeof(npm2rpm.version) === 'function') {
  npm2rpm.help();
}

if (npm2rpm.strategy === undefined) {
  console.log(' - Undefined strategy - defaulting to single'.bold)
  npm2rpm.strategy = 'single';
}

if (npm2rpm.template === undefined) {
  npm2rpm.template = path.join(__dirname, '..', npm2rpm.strategy + '.mustache');
}

var tar_extract = helpers.extractTar(helpers.downloadFromNPM(npm2rpm.name, npm2rpm.version));
tar_extract['stream'].on('error', (error) => {
	console.log('ERROR');
	console.log(error);
})
tar_extract['stream'].on('finish', () => {
  console.log(' - Finished extracting for '.bold + npm2rpm.name);
  console.log(' - Reading package.json for '.bold + npm2rpm.name);
  var npm_module = JSON.parse(fs.readFileSync(tar_extract['location'] + '/package/package.json'));
  normalizeData(npm_module, msg => console.error('Warning:', msg));
  console.log(' - Finished reading package.json for '.bold + npm2rpm.name);

  var files = fs.readdirSync(tar_extract['location'] + '/package/');

  if (npm2rpm.strategy === 'bundle') {
    config({
      development: false,
      optional: false
    });

    console.log(' - Fetching flattened list of production dependencies for '.bold + npm_module.name);
    ls(npm_module.name, npm_module.version, true, (deps) => {
      // Dependencies come as name@version but sometimes as @name@version
      var dependencies = deps.map(dependency => {
        // Work around the lack of rsplit
        var index = dependency.lastIndexOf('@');
        return [dependency.slice(0, index), dependency.slice(index + 1)];
      });
      var spec_file = specFileGenerator(npm_module, files, dependencies, npm2rpm.release, npm2rpm.template);

      writeSpecFile(npm_module.name, spec_file);

      console.log(' - Generating npm cache tgz... '.bold)
      createNpmCacheTar(npm_module);
      downloadDependencies(dependencies);
    });
  } else {
    var spec_file = specFileGenerator(npm_module, files, [], npm2rpm.release, npm2rpm.template);
    writeSpecFile(npm_module.name, spec_file);
    downloadDependencies([[npm_module.name, npm_module.version]])
  }
})

function writeSpecFile(name, content) {
  helpers.ensureDirSync('npm2rpm');
  helpers.ensureDirSync('npm2rpm/SOURCES');
  helpers.ensureDirSync('npm2rpm/SPECS');
  fs.writeFile('npm2rpm/SPECS/nodejs-' + name + '.spec', content);
}

function downloadDependencies(dependencies) {
  async.each(dependencies, (file, callback) => {
    var filename = 'npm2rpm/SOURCES/' + file[0] + '-' + file[1] + '.tgz';
    helpers.ensureDirSync(path.dirname(filename));
    var download_location = fs.createWriteStream(filename);
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
