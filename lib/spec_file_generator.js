var fs = require('fs');
var datejs=require('datejs');
var Handlebars = require('handlebars');
var semver = require('semver');
var helpers = require('../lib/npm_helpers.js');
module.exports = generateSpecFile;

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

    // '*' has no version restriction, || can't be expressed with simple deps,
    // and null means something went wrong. For any of these just output a name
    // with no version
    if (versionRange === null || versionRange === '*' || versionRange.includes('||')) {
      dependencies.push('npm(' + dep + ')');
    } else {
      // we should now have a space-separated list of comparators and version numbers
      // that can be added to a spec file as-is
      versionRange.split(' ').forEach((constraint) => {
        dependencies.push('npm(' + dep + ')' + constraint);
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
