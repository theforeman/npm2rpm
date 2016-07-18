#! /usr/bin/env node
var colors = require('colors');
var fs = require('fs');
var npm2rpm = require('commander');

console.log('---- npm2rpm ----'.green.bold);
console.log('-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-'.rainbow.bgWhite);
npm2rpm
.option('-n, --name <name>', 'NodeJS module name')
.option('-v, --version [version]', 'module version in X.Y.Z format')
.option('-r, --release [release]', "RPM's release", 1)
.option('-t, --template [template]', "RPM .spec template to use", 'default.n2r')
.parse(process.argv);

var tar_extract = extractTar(downloadFromNPM(npm2rpm.name, npm2rpm.version));
tar_extract['stream'].on('error', (error) => {
	console.log(error);
})
tar_extract['stream'].on('finish', (results) => {
	console.log(' - Finished extracting for '.bold + npm2rpm.name);
	console.log(' - Reading package.json for '.bold + npm2rpm.name);
	var package_json = JSON.parse(fs.readFileSync(tar_extract['location'] + '/package/package.json'));
	console.log(' - Finished reading package.json for '.bold + npm2rpm.name);
	npm_module_opts = {
		name: package_json['name'],
		version: package_json['version'],
		license: package_json['license'],
		description: package_json['description'],
		project_url: package_json['homepage'],
    tmp_location: tar_extract['location'],
		dependencies: package_json['dependencies'],
		binaries: package_json['bin'], // can be a string or a hash { binary: location }
		files: fs.readdirSync(tar_extract['location'] + '/package/')
	}

  var npm_module = new npmModule(npm_module_opts);
  generateSpecFile(npm_module);
})

// NPM module download

function downloadFromNPM(name, version) {
	var request = require('request');
  var url = npmUrl(name, version);
	console.log(' - Starting npm module download: '.bold + url );
	return request.get(url);
}

function extractTar(request_stream) {
	var targz = require('tar.gz');
	var tmpDir = createTempDir();
	var write_stream = targz().createWriteStream(tmpDir);
	console.log(' - Unpacking in '.bold + tmpDir + ' ...'.bold);
	return { stream: request_stream.pipe(write_stream), location: tmpDir }
}

function createTempDir() {
	var tmp = require('tmp');
	var tmpDir = tmp.dirSync(
		{ mode: 6644,
			prefix: 'npm2rpm-',
			keep: true });
	return tmpDir.name;
}

function npmUrl(name, version) {
	return 'http://registry.npmjs.org/' + name + '/-/' + name + '-' + version + '.tgz';
}

function npmModule(opts) {
	this.name = opts['name'];
	this.version = opts['version'];
	this.url = npmUrl(this.name, this.version);
	this.description = opts['description'];
	this.summary = this.description.split('.')[0];
	this.license = opts['license'];
	this.project_url = opts['project_url'];
	this.dependencies = opts['dependencies'];
  this.tmp_location = opts['tmp_location'] + '/package';
  this.binaries = opts['binaries'];
  this.files = opts['files'];
  this.doc_files = findFiles(this.files, /\.txt|\.md|readme|contributing/i);
  this.license_file = findFiles(this.files, /license/i);

	function findFiles(files, regex) {
		var matching_files = [];
		files.forEach((file) => {
			if(regex.test(file))
				matching_files.push(file);
		});
		return matching_files;
	}
}

// SpecFile creation

function replaceAttribute(data, template_attr, replacement_text) {
	return data.replace(new RegExp(template_attr, 'g'), replacement_text);
}

function listDependencies(npm_module, callback) {
	var ls = require('npm-remote-ls').ls
	var config = require('npm-remote-ls').config

	config({
		development: false,
		optional: false
	});

	console.log(' - Fetching flattened list of production dependencies'.bold);
	ls(npm_module.name, npm_module.version, true, function (deps) {
		var dependencies_array = deps.map((dependency) => {
		  // Dependencies come as name@version
			dependency = dependency.split('@')
      return dependency;
		});

    callback(dependencies_array);
	});
}

function dependenciesToProvides(deps) {
	var bundled_provides = deps.map((dependency) => {
		return 'Provides: bundled-npm(' + dependency[0] + ') = ' + dependency[1];
	});
	return bundled_provides.join('\n');
}

function dependenciesToSources(deps) {
	var sources = deps.map((dependency, index) => {
		return 'Source' + (index + 1) + ': ' + npmUrl(dependency[0], dependency[1]);
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

function generateSpecFile(npm_module) {
	var spec_file = fs.readFileSync(npm2rpm.template, { encoding: 'utf8' });
	spec_file = replaceAttribute(spec_file, '\\$NAME', npm_module.name);
	spec_file = replaceAttribute(spec_file, '\\$VERSION', npm_module.version);
	spec_file = replaceAttribute(spec_file, '\\$RELEASE', npm2rpm.release);
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
  listDependencies(npm_module, (dependencies) => {
    spec_file = replaceAttribute(spec_file, '\\$PROVIDES', dependenciesToProvides(dependencies));
    spec_file = replaceAttribute(spec_file, '\\$BUNDLEDSOURCES', dependenciesToSources(dependencies));
	  console.log(spec_file);
  });
}
