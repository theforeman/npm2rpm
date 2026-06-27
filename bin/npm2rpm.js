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
const binaryDetector = require('../lib/binary_detector.js');
const dependencyAnalyzer = require('../lib/dependency_analyzer.js');

console.log('---- npm2rpm ----'.green.bold);
console.log('-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-'.rainbow.bgWhite);
npm2rpm
.option('-n, --name <name>', 'NodeJS module name')
.option('-v, --version <version>', 'module version in X.Y.Z format')
.option('-s, --strategy [strategy]', "Strategy to build the npm packages", /^(single|bundle)$/i)
.option('-r, --release [release]', "RPM's release", 1)
.option('-t, --template [template]', "RPM .spec template to use")
.option('-o, --output [directory]', "Directory to output files to")
.option('-p, --use-legacy-peer-deps [useLegacyPeerDeps]', "Adds --legacy-peer-deps during npm install")
.option('--check-binaries', 'Check for native binaries and WebAssembly (required for Fedora packaging)')
.option('--concurrency <number>', 'Number of parallel dependency downloads (default: 5)', parseInt)
.option('--verbose-binaries', 'Show detailed binary detection output')
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

if (npm2rpm.useLegacyPeerDeps === undefined) {
  npm2rpm.useLegacyPeerDeps = false;
}

if (npm2rpm.concurrency === undefined) {
  npm2rpm.concurrency = 5;
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
tar_stream.on('finish', async () => {
  console.log(' - Finished extracting for '.bold + npm2rpm.name);
  console.log(' - Reading package.json for '.bold + npm2rpm.name);
  const npm_module = readPackageJson(path.join(tmpDir, 'package', 'package.json'),
    msg => console.warn('Warning:', msg));
  console.log(' - Finished reading package.json for '.bold + npm2rpm.name);

  const files = fs.readdirSync(path.join(tmpDir, 'package'));

  if (!fs.existsSync(npm2rpm.output)) {
    fs.mkdirSync(npm2rpm.output);
  }

  // Binary checking is OPT-IN via --check-binaries flag
  let mainPackageBinaries = null;
  let cacheDir = null; // Cache directory for dependency tarballs
  let cacheDirCleanup = null; // Cleanup callback for temp cache directory
  if (npm2rpm.checkBinaries) {
    console.log(' - Scanning main package for binaries...'.bold);
    const mainScan = binaryDetector.scanForBinaries(path.join(tmpDir, 'package'));

    if (mainScan.hasBinaries) {
      console.warn('');
      console.warn('⚠ WARNING: Main package contains native binaries/Wasm:'.yellow);
      mainScan.files.forEach(f => console.warn('  -', f));
      console.warn('');
      console.warn('For Fedora packaging, these binaries must be stripped before building.'.yellow);
      console.warn('Generated spec file will include a %prep section to strip these binaries.'.yellow);
      console.warn('');
      console.warn('NOTE: If this package requires these binaries to be rebuilt:'.yellow);
      console.warn('  - Ensure package.json includes proper build scripts');
      console.warn('  - Add appropriate BuildRequires to the spec (e.g., node-gyp, gcc-c++)');
      console.warn('  - The %build section may need manual adjustment');
      console.warn('');

      mainPackageBinaries = mainScan.files;
    } else {
      console.log('   ✓ No binaries found in main package'.green);
    }
  }

  if (npm2rpm.strategy === 'bundle') {
    npm_remote_ls.config({
      development: false,
      optional: false
    });

    console.log(' - Fetching flattened list of production dependencies for '.bold + npm_module.name);
    npm_remote_ls.ls(npm_module.name, npm_module.version, true, async (deps) => {
      // Dependencies come as name@version but sometimes as @name@version
      const dependencies = deps.map(dependency => rsplit(dependency, '@'));

      let analysis;

      // Binary checking is OPT-IN via --check-binaries flag
      if (npm2rpm.checkBinaries) {
        console.log(' - Analyzing dependencies for native binaries...'.bold);

        // Create temp cache directory to save downloaded tarballs
        // This avoids re-downloading when spectool runs later
        const cacheDirObj = tmp.dirSync({ prefix: 'npm2rpm-cache-', unsafeCleanup: true });
        cacheDir = cacheDirObj.name;
        cacheDirCleanup = () => cacheDirObj.removeCallback();

        analysis = await dependencyAnalyzer.analyzeAndCategorizeDependencies(
          dependencies.map(([name, version]) => ({name, version})),
          npm_module,
          {
            concurrency: npm2rpm.concurrency,
            verbose: npm2rpm.verboseBinaries,
            cacheDir: cacheDir
          }
        );

        console.log(`   ✓ ${analysis.bundled.length} dependencies can be bundled`.green);
        if (analysis.unbundled.length > 0) {
          console.log(`   ⚠ ${analysis.unbundled.length} dependencies contain binaries (will be unbundled):`.yellow);
          analysis.unbundled.forEach(d => {
            const depType = analysis.unbundledRuntime.includes(d) ? 'runtime' : 'dev';
            console.log(`     - ${d.name}@${d.version}`.yellow + ` [${depType}]`.dim);
            if (npm2rpm.verboseBinaries && d.binaryFiles.length > 0) {
              d.binaryFiles.slice(0, 3).forEach(f => console.log(`       • ${f}`.dim));
              if (d.binaryFiles.length > 3) {
                console.log(`       ... and ${d.binaryFiles.length - 3} more`.dim);
              }
            }
          });
          console.log('');
          console.log('   These dependencies will be added as Requires/BuildRequires instead of bundled.'.yellow);
          console.log('   For Fedora: these must be packaged separately as RPMs first.'.yellow);
        }
      } else {
        // Default behavior: bundle everything (no binary checking)
        analysis = {
          bundled: dependencies.map(([name, version]) => ({name, version})),
          unbundled: [],
          unbundledRuntime: [],
          unbundledDev: []
        };
      }

      specfile = writeSpecFile(npm_module, files, analysis, mainPackageBinaries, npm2rpm.release, npm2rpm.template, npm2rpm.output, npm2rpm.useLegacyPeerDeps);

      if (analysis.bundled.length > 0) {
        console.log(' - Generating npm cache tgz... '.bold)
        createNpmCacheTar(npm_module, npm2rpm.output, specfile, npm2rpm.useLegacyPeerDeps, cacheDir);
      }

      // Clean up cache directory after we're done
      if (cacheDirCleanup) {
        cacheDirCleanup();
      }
    });
  } else {
    // Single strategy - pass empty analysis (no dependencies)
    const analysis = { bundled: [], unbundled: [], unbundledRuntime: [], unbundledDev: [] };
    writeSpecFile(npm_module, files, analysis, mainPackageBinaries, npm2rpm.release, npm2rpm.template, npm2rpm.output, npm2rpm.useLegacyPeerDeps);
  }
})

function writeSpecFile(npmModule, files, analysis, mainPackageBinaries, release, template, specDir, use_legacy_peer_deps) {
  const content = specFileGenerator(npmModule, files, analysis, mainPackageBinaries, release, template, use_legacy_peer_deps);
  const filename = path.join(specDir, `${getRpmPackageName(npmModule.name)}.spec`);
  fs.writeFileSync(filename, content);
  return filename;
}

function createNpmCacheTar(npm_module, outputDir, specfile, useLegacyPeerDeps, cacheDir) {
  const command = path.join(__dirname, 'generate_npm_tarball.sh');
  const pkg = `${npm_module.name}@${npm_module.version}`;
  const filename = path.join(outputDir, getCacheFilename(getRpmPackageName(npm_module.name), npm_module.version));
  const args = cacheDir
    ? [command, pkg, filename, specfile, useLegacyPeerDeps, cacheDir].join(' ')
    : [command, pkg, filename, specfile, useLegacyPeerDeps].join(' ');
  execSync(args, {stdio: [0,1,2]});
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
