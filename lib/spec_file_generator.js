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
  bundled_provides = bundled_provides.join('\n');
  // Dependencies are already included, and provides are set by this function
  bundled_provides += '\nAutoReq: no \nAutoProv: no \n';
	return bundled_provides;
}

function symlinkBinaries(npm_module) {
  var symlink_snippet = '';
  symlink_snippet += "mkdir -p %{buildroot}%{nodejs_sitelib}/${npm_name}/bin \n"
  symlink_snippet += "mkdir -p %{buildroot}%{_bindir}/ \n"
  // We have 'no control' over this variable, it comes from package.json
  if (typeof(npm_module.binaries) == 'string') {
    symlink_snippet += installBinary(npm_module.binaries);
    symlink_snippet += symlinkBinary(npm_module.binaries);
  } else {
    for(var binary in npm_module.binaries) {
      symlink_snippet += installBinary(npm_module.binaries[binary]);
      symlink_snippet += symlinkBinary(npm_module.binaries[binary]);
    }
  }
  return symlink_snippet;
}

function installBinary(binary_path) {
	var basename = getBasename(binary_path);
	return 'install -p -D -m0755 bin/' + basename +
		' %{buildroot}%{nodejs_sitelib}/%{npm_name}/bin/' + basename + '\n';
}

function symlinkBinary(binary_path) {
	var basename = getBasename(binary_path);
	return 'ln -sf %{nodejs_sitelib}/%{npm_name}/bin/' + basename +
		' %{buildroot}%{_bindir}/' + basename + '\n';
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

function filesToCopy(npm_module) {
  var files = npm_module.files.join(' ');
  if (npm_module.bundle) {
    return files + ' node_modules';
  } else {
    return files;
  }
}

function generateSpecFile(npm_module, dependencies, release, template) {
	var spec_file = fs.readFileSync(template, { encoding: 'utf8' });
	spec_file = replaceAttribute(spec_file, '\\$VERSION', npm_module.version);
	spec_file = replaceAttribute(spec_file, '\\$RELEASE', release);
	spec_file = replaceAttribute(spec_file, '\\$LICENSEFILE', '%doc ' + npm_module.license_file);
	spec_file = replaceAttribute(spec_file, '\\$LICENSE', npm_module.license);
	spec_file = replaceAttribute(spec_file, '\\$SUMMARY', npm_module.summary);
	spec_file = replaceAttribute(spec_file, '\\$PROJECTURL', npm_module.project_url);
	spec_file = replaceAttribute(spec_file, '\\$DESCRIPTION', npm_module.description);
	spec_file = replaceAttribute(spec_file, '\\$BINSNIPPET', symlinkBinaries(npm_module));
	spec_file = replaceAttribute(spec_file, '\\$FILESBINSNIPPET', listBinaryFiles(npm_module.binaries));
	spec_file = replaceAttribute(spec_file, '\\$FILESTOCOPY', filesToCopy(npm_module));
	spec_file = replaceAttribute(spec_file, '\\$DOCFILES', listDocFiles(npm_module.doc_files));
  if (npm_module.bundle) {
	  spec_file = replaceAttribute(spec_file, '\\$NAME', 'bundle-' + npm_module.name);
    spec_file = replaceAttribute(spec_file, '\\$PROVIDES', dependenciesToProvides(dependencies));
  } else {
	  spec_file = replaceAttribute(spec_file, '\\$NAME', npm_module.name);
    spec_file = replaceAttribute(spec_file, '\\$PROVIDES', '%{?nodejs_find_provides_and_requires}');
  }
	return spec_file;
}
