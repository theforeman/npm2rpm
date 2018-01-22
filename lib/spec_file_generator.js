var fs = require('fs');
var datejs=require('datejs');
var helpers = require('../lib/npm_helpers.js');
module.exports = generateSpecFile;

// SpecFile creation

function replaceAttribute(data, template_attr, replacement_text) {
	return data.replace(new RegExp(template_attr, 'g'), replacement_text);
}

function dependenciesToSources(deps) {
  if (deps.length === 0)
    return '';
  var sources = deps.map((dependency, index) => {
    return 'Source' + index + ': ' + helpers.npmUrl(dependency[0], dependency[1]);
  });
  sources.push('Source' + deps.length + ': ' + deps[0][0] + '-' + deps[0][1] +
               '-registry.npmjs.org.tgz');
  return sources.join('\n');
}

function dependenciesToProvides(deps) {
  var bundled_provides = 'Provides: npm(%{npm_name}) = %{version}\n';
  var dependencies = deps.map((dependency) => {
	return 'Provides: bundled(npm(' + dependency[0] + ')) = ' + dependency[1];
  });
  bundled_provides = bundled_provides.concat(dependencies.join('\n'))
  // Dependencies are already included, and provides are set by this function
  bundled_provides += '\nAutoReq: no\nAutoProv: no\n';
  return bundled_provides;
}

function symlinkBinaries(npm_module) {
  if (npm_module.binaries === undefined || npm_module.binaries.length < 0)
    return '';
  var symlink_snippet = '';
  symlink_snippet += "mkdir -p %{buildroot}%{nodejs_sitelib}/${npm_name}/bin \n"
  symlink_snippet += "mkdir -p %{buildroot}%{_bindir}/ \n"
  // We have 'no control' over this variable, it comes from package.json
  if (typeof(npm_module.binaries) === 'string') {
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
  if (typeof(binaries) === 'string') {
    return '%{_bindir}/' + getBasename(binaries);
  } else {
    var binary_files = '';
    for(var binary in binaries) {
      binary_files += '%{_bindir}/' + getBasename(binaries[binary]);
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
    '\\$NAME': npm_module.name,
    '\\$VERSION': npm_module.version,
    '\\$RELEASE': release,
    '\\$LICENSEFILE': npm_module.license_file.length !== 0 ? '%license ' + npm_module.license_file : '',
    '\\$LICENSETYPE': npm_module.license,
    '\\$SUMMARY': npm_module.summary,
    '\\$PROJECTURL': npm_module.project_url,
    '\\$DESCRIPTION': npm_module.description,
    '\\$BINSNIPPET': symlinkBinaries(npm_module),
    '\\$FILESBINSNIPPET': listBinaryFiles(npm_module.binaries),
    '\\$COPYFILES': copyFiles(npm_module),
    '\\$DOCFILES': listDocFiles(npm_module.doc_files),
    '\\$DATE': Date.today().toString("ddd MMM d yyyy"),
  }

  if (npm_module.bundle) {
    replacements['\\$PROVIDES'] = dependenciesToProvides(dependencies);
    replacements['\\$SOURCES'] = dependenciesToSources(dependencies);
    replacements['\\$BUILD'] = npmInstallCache();
    replacements['\\$SETUP'] = sourcesToCache(dependencies);
    replacements['\\$SYMLINK'] = '';
  } else {
    replacements['\\$PROVIDES'] = '%{?nodejs_find_provides_and_requires}';
    replacements['\\$SOURCES'] = 'Source0: ' + helpers.npmUrl('%{npm_name}', '%{version}');
    replacements['\\$BUILD'] = '';
    replacements['\\$SETUP'] = '%setup -q -n package';
    replacements['\\$SYMLINK'] = '%nodejs_symlink_deps';
  }

  var spec_file = fs.readFileSync(template, { encoding: 'utf8' });

  for (var key in replacements) {
    var replacement = replacements[key];
    if (replacement === undefined) {
      replacement = 'FIXME';
    }
    spec_file = replaceAttribute(spec_file, key, replacement);
  }

  return spec_file;
}

function npmInstallCache() {
  return 'npm install --cache-min Infinity --cache %{npm_cache_dir} --no-optional --global-style true %{npm_name}@%{version}';
}

function sourcesToCache(deps) {
  return 'mkdir -p %{npm_cache_dir}\n\
for tgz in %{sources}; do\n\
  echo $tgz | grep -q registry.npmjs.org || npm cache add --cache %{npm_cache_dir} $tgz\n\
done\n\
\n\
%setup -T -q -a ' + deps.length + ' -D -n %{npm_cache_dir}';
}
