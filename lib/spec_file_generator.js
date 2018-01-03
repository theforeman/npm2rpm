var fs = require('fs');
var datejs=require('datejs');
var Mustache = require('mustache');
var semver = require('semver');
var helpers = require('../lib/npm_helpers.js');
module.exports = generateSpecFile;

// SpecFile creation

function dependenciesToSources(deps) {
  if (deps.length === 0)
    return [];
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
  result.sort();
  return result;
}

function dependenciesToRequires(deps) {
  if (deps === undefined || deps.length === 0) {
    return [];
  }

  var sortedDeps = deps.slice(0);
  sortedDeps.sort();

  var dependencies = [];
  for(var dep in deps) {
    var version = deps[dep];
    if (version[0] === '^' || version[0] === '~') {
      var min_version = version.substr(1);
      if (version[0] === '^') {
        max_version = semver.inc(min_version, 'major');
      } else {
        max_version = semver.inc(min_version, 'minor');
      }

      dependencies.push('Requires: npm(' + dep + ') >= ' + min_version);
      dependencies.push('Requires: npm(' + dep + ') < ' + max_version);
    } else {
      if (isNaN(parseInt(version[0], 10))) {
        dependencies.push('Requires: npm(' + dep + ') ' + version);
      } else {
        dependencies.push('Requires: npm(' + dep + ') = ' + version);
      }
    }

  }
  return dependencies;
}

function getBinaries(binaries) {
  if (binaries === undefined || binaries.length <= 0)
    return [];

  // We have 'no control' over this variable, it comes from package.json
  if (typeof(binaries) === 'string') {
    return [getBasename(binaries)];
  }

  var result = [];
  for(var binary in binaries) {
    result.push(getBasename(binaries[binary]));
  }
  return result;
}

function getBasename(fullpath) {
  return fullpath.replace(/^.*[\\\/]/, '');
}

function filesToCopy(npm_module) {
  var files = npm_module.files.join(' ');
  if (npm_module.bundle) {
    return files + ' node_modules';
  } else {
    return files;
  }
}

function copyFiles(npm_module){
  var result = '';
  if (npm_module.bundle)
    result += 'cd node_modules/' + npm_module.name + '\n';
  result += ('cp -pfr ' + filesToCopy(npm_module) + ' %{buildroot}%{nodejs_sitelib}/%{npm_name}');
  if (npm_module.bundle)
    result += ('\ncp -pf ' + npm_module.doc_files.join(' ') + ' ' + npm_module.license_file + ' ../../');
  return result;
}

function generateSpecFile(npm_module, dependencies, release, template) {
  var replacements = {
    'BUNDLED': npm_module.bundle,
    'NAME': npm_module.name,
    'VERSION': npm_module.version,
    'RELEASE': release,
    'LICENSEFILE': npm_module.license_file,
    'LICENSETYPE': npm_module.license,
    'SUMMARY': npm_module.summary,
    'PROJECTURL': npm_module.project_url,
    'DESCRIPTION': npm_module.description,
    'BINARIES': getBinaries(npm_module.binaries),
    'COPYFILES': copyFiles(npm_module),
    'DOCFILES': npm_module.doc_files,
    'DATE': Date.today().toString("ddd MMM d yyyy")
  }

  if (npm_module.bundle) {
    replacements['PROVIDES'] = dependenciesToProvides(dependencies);
    replacements['SOURCES'] = dependenciesToSources(dependencies);
  } else {
    replacements['DEPENDENCIES'] = dependenciesToRequires(npm_module['dependencies']);
    replacements['PROVIDES'] = [];
    replacements['SOURCES'] = ['Source0: ' + helpers.npmUrl('%{npm_name}', '%{version}')];
  }

  var spec_file = fs.readFileSync(template, { encoding: 'utf8' });
  return Mustache.render(spec_file, replacements);
}
