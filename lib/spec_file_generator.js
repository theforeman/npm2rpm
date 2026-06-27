const fs = require('fs');
const Handlebars = require('handlebars');
const semver = require('semver');
const npmUrl = require('../lib/npm_helpers.js').npmUrl;
const getCacheFilename = require('../lib/npm_helpers.js').getCacheFilename;
const getRpmPackageName = require('../lib/npm_helpers.js').getRpmPackageName;
module.exports = generateSpecFile;
module.exports.dependenciesToRequires = dependenciesToRequires;

// SpecFile creation

function sorted(items) {
  const result = []
  for (item in items) {
    result.push(item);
  }
  result.sort();
  return result;
}

function dependenciesToSources(name, deps) {
  // Main package is Source0 for easier patching in %prep
  const sources = [`Source0: ${npmUrl(name, '%{version}')}`];

  // Filter out main package from deps (it's already Source0) and add remaining dependencies
  const depsOnly = deps.filter(dep => dep.name !== name);
  depsOnly.forEach((dependency, index) => {
    sources.push(`Source${index + 1}: ${npmUrl(dependency['name'], dependency['version'])}`);
  });

  // Cache tarball is last
  sources.push(`Source${depsOnly.length + 1}: ${getCacheFilename(getRpmPackageName(name), '%{version}')}`);
  return sources;
}

function sortDependencies(deps) {
  const result = deps.map((dependency) => {
    return {'name': dependency[0], 'version': dependency[1]}
  });
  result.sort((a, b) => {
    if (a['name'] === b['name']) {
      return a['version'].localeCompare(b['version']);
    } else {
      return a['name'].localeCompare(b['name']);
    }
  });
  return result;
}

function dependenciesToRequires(deps) {
  var dependencies = [];
  var sortedDeps = sortedDeps = sorted(deps);

  for (var i = 0; i < sortedDeps.length; i++) {
    const dep = sortedDeps[i];
    const version = deps[dep];
    const versionRange = semver.validRange(version);


    // if the version string is not valid, validRange returns null, otherwise
    // it parses a semver string into a disjunctive normal form of version
    // constraints, and joins that result into a single string, using '||' as
    // OR and ' ' as AND.

    var versionDNF = [];
    if (versionRange !== null) {
      versionDNF = versionRange.split('||').map((s) => s.split(' '));
    }

    // If the version range contains more than on OR clause (e.g., 1.2.3 || 3.0.0),
    // it cannot be expressed with simple dependencies, so just output a name with
    // no version. If the version range contains no clauses, validRange returned
    // null and there is no version for us to include.
    if (versionDNF.length !== 1) {
      dependencies.push('npm(' + dep + ')');
    } else {
      // At this point each constraint can be one of three things:
      //  - '*', meaning there is no version constraint
      //  - just a version number, e.g. 1.2.3, meaning the requirement is equal to that
      //  - a constraint (<,>,>=,<=) and a version number, which can be used as-is
      versionDNF[0].forEach((constraint) => {
        var m;
        if (constraint === '*') {
          dependencies.push('npm(' + dep + ')');
        } else if ((m = constraint.match(/^([<>]=?)(.*?)$/)) !== null) {
          dependencies.push('npm(' + dep + ') ' + m[1] + ' ' + m[2]);
        } else {
          dependencies.push('npm(' + dep + ') = ' + constraint);
        }
      });
    }
  }

  return dependencies;
}

function getCopyFiles(files) {
  const ignoreFiles = [
    'Gemfile',
    'Gruntfile.js',
    'Rakefile',
    'bower.json',
    'circle.yml',
    'codecov.yml',
    'composer.json',
    'deploy_key.enc',
    'gulpfile.js',
    'karma.conf.js',
    'npm-shrinkwrap.json',
    'package-lock.json',
    'release.sh',
    'yarn.lock'
  ].concat(getLicenceFiles(files), getDocFiles(files));
  const ignorePattern = /^\.|\.gemspec$/;
  return files.filter(file => ignoreFiles.indexOf(file) === -1 && !ignorePattern.test(file));
}

function getDocFiles(files) {
  const licenseFiles = getLicenceFiles(files);
  const docPattern = /\.txt$|\.md$|authors|readme|contributing|docs/i;
  return files.filter(file => licenseFiles.indexOf(file) === -1 && docPattern.test(file));
}

function getLicenceFiles(files) {
  return files.filter(file => /license|copying/i.test(file));
}

function getSummary(description) {
  return description !== undefined ? description.split('.')[0].replace(/^\s+|\s+$/g, '') : 'FIXME';
}

function getProjectUrl(npm_module) {
  var projecturl = '';

  if (npm_module.homepage) {
    projecturl = npm_module.homepage;
  } else if (npm_module.repository) {
    projecturl = npm_module.repository.url;
  } else {
    projecturl = "https://www.npmjs.com/package/" + npm_module.name;
  }

  return projecturl;
}

function getLicense(npm_module) {
  if (npm_module.license) {
    return npm_module.license;
  } else if (npm_module.licenses) {
    return npm_module.licenses[0].type;
  } else {
    return 'FIXME';
  }
}

function getLegacyPeerDeps(use_legacy_peer_deps) {
  if (use_legacy_peer_deps) {
    return '--legacy-peer-deps ';
  } else {
    return '';
  }
}

function generateSpecFile(npm_module, files, analysis, mainPackageBinaries, release, template_name, use_legacy_peer_deps) {
  for (binary in npm_module.bin) {
    npm_module.bin[binary] = npm_module.bin[binary].replace(/^\.\//, '');
  }

  // Handle both old API (dependencies array) and new API (analysis object)
  let bundled, unbundledRuntime, unbundledDev;
  if (Array.isArray(analysis)) {
    // Old API: analysis is actually a dependencies array
    bundled = analysis;
    unbundledRuntime = [];
    unbundledDev = [];
    mainPackageBinaries = null; // Old API doesn't support this
  } else {
    // New API: analysis is an object with bundled/unbundled split
    bundled = analysis.bundled || [];
    unbundledRuntime = analysis.unbundledRuntime || [];
    unbundledDev = analysis.unbundledDev || [];
  }

  const replacements = {
    NAME: npm_module.name,
    RPM_PACKAGE_NAME: getRpmPackageName(npm_module.name),
    PACKAGE_NAME_HAS_SLASH: npm_module.name.indexOf('/') >= 0,
    VERSION: npm_module.version,
    RELEASE: release,
    LICENSEFILES: getLicenceFiles(files),
    LICENSETYPE: getLicense(npm_module),
    SUMMARY: getSummary(npm_module.description),
    PROJECTURL: getProjectUrl(npm_module),
    DESCRIPTION: npm_module.description,
    BINARIES: npm_module.bin,
    COPYFILES: getCopyFiles(files),
    DOCFILES: getDocFiles(files),
    LEGACY_PEER_DEPS: getLegacyPeerDeps(use_legacy_peer_deps),
    MAIN_PACKAGE_HAS_BINARIES: !!mainPackageBinaries,
    PREP_BINARY_STRIP: mainPackageBinaries ? {files: mainPackageBinaries} : null,
  }

  if (bundled.length !== 0) {
    const sortedBundled = sortDependencies(bundled.map(d => [d.name, d.version]));
    replacements['DEPENDENCIES'] = [];
    replacements['PROVIDES'] = sortedBundled;
    replacements['SOURCES'] = dependenciesToSources(npm_module.name, sortedBundled);
  } else {
    replacements['DEPENDENCIES'] = dependenciesToRequires(npm_module['dependencies']);
    replacements['PROVIDES'] = [];
    replacements['SOURCES'] = ['Source0: ' + npmUrl(npm_module.name, '%{version}')];
  }

  // Add unbundled dependencies as Requires/BuildRequires
  // Runtime deps need both BuildRequires (for %check) and Requires (for runtime)
  // Dev deps only need BuildRequires (for %check)
  replacements['UNBUNDLED_REQUIRES'] = unbundledRuntime.map(d => d.name);
  replacements['UNBUNDLED_BUILD_REQUIRES'] = [...unbundledRuntime, ...unbundledDev].map(d => d.name);

  const spec_file = fs.readFileSync(template_name, { encoding: 'utf8' });
  const template = Handlebars.compile(spec_file);
  return template(replacements);
}
