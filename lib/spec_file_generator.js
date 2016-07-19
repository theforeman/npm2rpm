var fs = require('fs');
var helpers = require('../lib/npm_helpers.js');
module.exports = generateSpecFile;

// SpecFile creation

function replaceAttribute(data, template_attr, replacement_text) {
	return data.replace(new RegExp(template_attr, 'g'), replacement_text);
}

function dependenciesToProvides(deps) {
	var bundled_provides = deps.map((dependency) => {
		return 'Provides: bundled-npm(' + dependency[0] + ') = ' + dependency[1];
	});
	return bundled_provides.join('\n');
}

function dependenciesToSources(deps) {
	var sources = deps.map((dependency, index) => {
		return 'Source' + (index + 1) + ': ' + helpers.npmUrl(dependency[0], dependency[1]);
	});
	return sources.join('\n');
}

function symlinkBinaries(npm_module) {
  // We have 'no control' over this variable, it comes from package.json
  if (typeof(npm_module.binaries) == 'string') {
    return symlinkBinary(npm_module.name, npm_module.binaries);
  } else {
    var symlink_snippet = '';
    for(var binary in npm_module.binaries) {
      symlink_snippet += symlinkBinary(npm_module.name, npm_module.binaries[binary]);
      symlink_snippet += '\n';
    }
    return symlink_snippet;
  }
}

function symlinkBinary(name, binary_path) {
	var basename = getBasename(binary_path);
	return 'ln -s %{nodejs_sitelib}/' + name + '/' + basename +
		' %{buildroot}%{_bindir}/' + basename;
}

function listBinaryFiles(binaries) {
  if (typeof(binaries) == 'string') {
    return '%{_bindir}/' + getBasename(binaries);
  } else {
    var binary_files = '';
    for(var binary in binaries) {
      binary_files += getBaseName(binaries[binary]);
      binary_files += '\n';
    }
    return binary_files;
  }
}

function listDocFiles(doc_files) {
  var result = doc_files.map((doc_file) => {
		return '%doc ' + doc_file;
	});
	return result.join('\n');
}

function getBasename(fullpath) {
  return fullpath.replace(/^.*[\\\/]/, '');
}

function generateSpecFile(npm_module, dependencies, release, template) {
	var spec_file = fs.readFileSync(template, { encoding: 'utf8' });
	spec_file = replaceAttribute(spec_file, '\\$NAME', npm_module.name);
	spec_file = replaceAttribute(spec_file, '\\$VERSION', npm_module.version);
	spec_file = replaceAttribute(spec_file, '\\$RELEASE', release);
	spec_file = replaceAttribute(spec_file, '\\$LICENSEFILE', '%doc ' + npm_module.license_file);
	spec_file = replaceAttribute(spec_file, '\\$LICENSE', npm_module.license);
	spec_file = replaceAttribute(spec_file, '\\$SUMMARY', npm_module.summary);
	spec_file = replaceAttribute(spec_file, '\\$PROJECTURL', npm_module.project_url);
	spec_file = replaceAttribute(spec_file, '\\$DESCRIPTION', npm_module.description);
	spec_file = replaceAttribute(spec_file, '\\$BINSNIPPET', symlinkBinaries(npm_module));
	spec_file = replaceAttribute(spec_file, '\\$REQUIRES', 'Requires: nodejs(engine)');
	spec_file = replaceAttribute(spec_file, '\\$FILESBINSNIPPET', listBinaryFiles(npm_module.binaries));
	spec_file = replaceAttribute(spec_file, '\\$FILESTOCOPY', npm_module.files.join(' '));
	spec_file = replaceAttribute(spec_file, '\\$DOCFILES', listDocFiles(npm_module.doc_files));
  spec_file = replaceAttribute(spec_file, '\\$PROVIDES', dependenciesToProvides(dependencies));
  spec_file = replaceAttribute(spec_file, '\\$BUNDLEDSOURCES', dependenciesToSources(dependencies));
	return spec_file;
}
