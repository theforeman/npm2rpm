#!/usr/bin/env node
// NodeJS core
const fs = require('fs');
const tmp = require('tmp');
const execSync = require('child_process').execSync;
const path = require('path');
// NPM deps
const request = require('request');
const tar = require('tar');
const npm_remote_ls = require('npm-remote-ls');
const colors = require('colors');
const npm2rpm = require('commander');
const normalizeData = require('normalize-package-data');
// Our own deps
const {npmUrl, rsplit, getCacheFilename, getRpmPackageName} = require('../lib/npm_helpers.js');
const specFileGenerator = require('../lib/spec_file_generator.js');

console.log('---- npm2rpm ----'.green.bold);
console.log('-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-'.rainbow.bgWhite);
npm2rpm
.option('-n, --name <name>', 'NodeJS module name')
.option('-v, --version <version>', 'module version in X.Y.Z format')
.option('-s, --strategy [strategy]', "Strategy to build the npm packages", /^(single|bundle)$/i)
.option('-r, --release [release]', "RPM's release", 1)
.option('-t, --template [template]', "RPM .spec template to use")
.option('-6, --use-nodejs6 [useNodejs6]', "If wanting to generate cache tarball for NodeJS 6")
.option('-o, --output [directory]', "Directory to output files to")
.option('-c, --scl [scl]', "Adds scl prefixes to spec file")
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

if (npm2rpm.output === undefined) {
  console.log(' - Undefined output directory - defaulting to npm2rpm'.bold)
  npm2rpm.output = 'npm2rpm';
}

if (npm2rpm.useNodejs6 === undefined) {
  npm2rpm.useNodejs6 = false;
}

if (npm2rpm.scl === undefined) {
  npm2rpm.scl = false;
}

const url = npmUrl(npm2rpm.name, npm2rpm.version);
console.log(' - Starting npm module download: '.bold + url );
const tmpDir = createTempDir();
console.log(' - Unpacking in '.bold + tmpDir + ' ...'.bold);
const tar_stream = request.get(url).pipe(tar.extract({cwd: tmpDir}))
tar_stream.on('error', (error) => {
  console.log('ERROR'.red, '-', error.message);
  if (error.code === 'Z_DATA_ERROR') {
    console.log('Are you sure that the module name and version can be found on npmjs.org?'.bold);
  }
})
tar_stream.on('finish', () => {
  console.log(' - Finished extracting for '.bold + npm2rpm.name);
  console.log(' - Reading package.json for '.bold + npm2rpm.name);
  const npm_module = readPackageJson(path.join(tmpDir, 'package', 'package.json'),
    msg => console.warn('Warning:', msg));
  console.log(' - Finished reading package.json for '.bold + npm2rpm.name);

  const files = fs.readdirSync(path.join(tmpDir, 'package'));

  if (!fs.existsSync(npm2rpm.output)) {
    fs.mkdirSync(npm2rpm.output);
  }

  if (npm2rpm.strategy === 'bundle') {
    npm_remote_ls.config({
      development: false,
      optional: false
    });

    console.log(' - Fetching flattened list of production dependencies for '.bold + npm_module.name);
    npm_remote_ls.ls(npm_module.name, npm_module.version, true, (deps) => {
      // Dependencies come as name@version but sometimes as @name@version
      const dependencies = deps.map(dependency => rsplit(dependency, '@'));

      specfile = writeSpecFile(npm_module, files, dependencies, npm2rpm.release, npm2rpm.template, npm2rpm.output, npm2rpm.scl);

      if (dependencies.length > 0) {
        console.log(' - Generating npm cache tgz... '.bold)
        createNpmCacheTar(npm_module, npm2rpm.output, npm2rpm.useNodejs6, specfile);
      }
    });
  } else {
    writeSpecFile(npm_module, files, [], npm2rpm.release, npm2rpm.template, npm2rpm.output, npm2rpm.scl);
  }
})

function writeSpecFile(npmModule, files, dependencies, release, template, specDir, scl) {
  const content = specFileGenerator(npmModule, files, dependencies, release, template, scl);
  const filename = path.join(specDir, `${getRpmPackageName(npmModule.name)}.spec`);
  fs.writeFileSync(filename, content);
  return filename;
}

function createNpmCacheTar(npm_module, outputDir, useNodejs6, specfile) {
  const command = path.join(__dirname, 'generate_npm_tarball.sh');
  const pkg = `${npm_module.name}@${npm_module.version}`;
  const filename = path.join(outputDir, getCacheFilename(getRpmPackageName(npm_module.name), npm_module.version));
  execSync([command, pkg, filename, useNodejs6, specfile].join(' '), {stdio: [0,1,2]});
}

function createTempDir() {
  const tmpDir = tmp.dirSync({
    mode: 6644,
    prefix: 'npm2rpm-',
    keep: true
  });
  return tmpDir.name;
}

function readPackageJson(filename, warn) {
  const packageData = JSON.parse(fs.readFileSync(filename));
  normalizeData(packageData, warn);
  return packageData;
}
