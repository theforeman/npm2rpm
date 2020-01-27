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
  const sources = deps.map((dependency, index) => {
    return `Source${index}: ${npmUrl(dependency['name'], dependency['version'])}`;
  });
  sources.push(`Source${deps.length}: ${getCacheFilename(getRpmPackageName(name), '%{version}')}`);
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

function dependenciesToRequires(deps, scl) {
  var dependencies = [];
  var sortedDeps = sortedDeps = sorted(deps);
  var sclPrefix = '';

  if (scl) {
    sclPrefix = '%{scl_prefix}';
  }

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
      dependencies.push(sclPrefix + 'npm(' + dep + ')');
    } else {
      // At this point each constraint can be one of three things:
      //  - '*', meaning there is no version constraint
      //  - just a version number, e.g. 1.2.3, meaning the requirement is equal to that
      //  - a constraint (<,>,>=,<=) and a version number, which can be used as-is
      versionDNF[0].forEach((constraint) => {
        var m;
        if (constraint === '*') {
          dependencies.push(sclPrefix + 'npm(' + dep + ')');
        } else if ((m = constraint.match(/^([<>]=?)(.*?)$/)) !== null) {
          dependencies.push(sclPrefix + 'npm(' + dep + ') ' + m[1] + ' ' + m[2]);
        } else {
          dependencies.push(sclPrefix + 'npm(' + dep + ') = ' + constraint);
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

function generateSpecFile(npm_module, files, dependencies, release, template_name, scl) {
  for (binary in npm_module.bin) {
    npm_module.bin[binary] = npm_module.bin[binary].replace(/^\.\//, '');
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
    DOCFILES: getDocFiles(files)
  }

  if (dependencies.length !== 0) {
    dependencies = sortDependencies(dependencies);
    replacements['DEPENDENCIES'] = [];
    replacements['PROVIDES'] = dependencies;
    replacements['SOURCES'] = dependenciesToSources(npm_module.name, dependencies);
  } else {
    replacements['DEPENDENCIES'] = dependenciesToRequires(npm_module['dependencies'], scl);
    replacements['PROVIDES'] = [];
    replacements['SOURCES'] = ['Source0: ' + npmUrl(npm_module.name, '%{version}')];
  }

  const spec_file = fs.readFileSync(template_name, { encoding: 'utf8' });
  const template = Handlebars.compile(spec_file);
  return template(replacements);
}
