var fs = require('fs');
var datejs=require('datejs');
var Handlebars = require('handlebars');
var semver = require('semver');
var helpers = require('../lib/npm_helpers.js');
module.exports = generateSpecFile;
module.exports.dependenciesToRequires = dependenciesToRequires;

// SpecFile creation

function sorted(items) {
  var result = []
  for (item in items) {
    result.push(item);
  }
  result.sort();
  return result;
}

function dependenciesToSources(deps) {
  var sources = deps.map((dependency, index) => {
    return 'Source' + index + ': ' + helpers.npmUrl(dependency[0], dependency[1]);
  });
  sources.push('Source' + deps.length + ': %{npm_name}-%{version}-registry.npmjs.org.tgz');
  return sources;
}

function dependenciesToProvides(deps) {
  var result = deps.map((dependency) => {
    return {'name': dependency[0], 'version': dependency[1]}
  });
  result.sort((a, b) => a['name'].localeCompare(b['name']));
  return result;
}

function dependenciesToRequires(deps) {
  if (deps === undefined || deps.length === 0) {
    return [];
  }

  var sortedDeps = sorted(deps);

  var dependencies = [];
  for (var i = 0; i < sortedDeps.length; i++) {
    var dep = sortedDeps[i];
    var version = deps[dep];
    var versionRange = semver.validRange(version);


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
        if (constraint === '*') {
          dependencies.push('npm(' + dep + ')');
        } else if (constraint.startsWith('>') || constraint.startsWith('<')) {
          dependencies.push('npm(' + dep + ') ' + constraint);
        } else {
          dependencies.push('npm(' + dep + ') =' + constraint);
        }
      });
    }
  }
  return dependencies;
}

function getCopyFiles(files) {
  var ignoreFiles = [
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
  var ignorePattern = /^\.|\.gemspec$/;
  return files.filter(file => ignoreFiles.indexOf(file) === -1 && !ignorePattern.test(file));
}

function getDocFiles(files) {
  var licenseFiles = getLicenceFiles(files);
  var docPattern = /\.txt$|\.md$|authors|readme|contributing|docs/i;
  return files.filter(file => licenseFiles.indexOf(file) === -1 && docPattern.test(file));
}

function getLicenceFiles(files) {
  return files.filter(file => /license|copying/i.test(file));
}

function getSummary(description) {
  return description !== undefined ? description.split('.')[0].replace(/^\s+|\s+$/g, '') : 'FIXME';
}

function generateSpecFile(npm_module, files, dependencies, release, template_name) {
  for (binary in npm_module.bin) {
    npm_module.bin[binary] = npm_module.bin[binary].replace(/^\.\//, '');
  }

  var replacements = {
    NAME: npm_module.name,
    VERSION: npm_module.version,
    RELEASE: release,
    LICENSEFILES: getLicenceFiles(files),
    LICENSETYPE: npm_module.license,
    SUMMARY: getSummary(npm_module.description),
    PROJECTURL: npm_module.homepage,
    DESCRIPTION: npm_module.description,
    BINARIES: npm_module.bin,
    COPYFILES: getCopyFiles(files),
    DOCFILES: getDocFiles(files),
    DATE: Date.today().toString("ddd MMM d yyyy")
  }

  if (dependencies.length !== 0) {
    replacements['DEPENDENCIES'] = [];
    replacements['PROVIDES'] = dependenciesToProvides(dependencies);
    replacements['SOURCES'] = dependenciesToSources(dependencies);
  } else {
    replacements['DEPENDENCIES'] = dependenciesToRequires(npm_module['dependencies']);
    replacements['PROVIDES'] = [];
    replacements['SOURCES'] = ['Source0: ' + helpers.npmUrl('%{npm_name}', '%{version}')];
  }

  var spec_file = fs.readFileSync(template_name, { encoding: 'utf8' });
  var template = Handlebars.compile(spec_file);
  return template(replacements);
}
