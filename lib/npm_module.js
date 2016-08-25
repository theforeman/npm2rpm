var helpers = require('../lib/npm_helpers.js');
module.exports = npmModule;

function npmModule(opts) {
  this.name = opts['name'];
  this.version = opts['version'];
  this.url = helpers.npmUrl(this.name, this.version);
  this.description = opts['description'];
  if (this.description !== undefined)
    this.summary = this.description.split('.')[0];
  this.license = opts['license'];
  this.project_url = getProjectURL();
  this.dependencies = opts['dependencies'];
  this.tmp_location = opts['tmp_location'] + '/package';
  this.binaries = opts['binaries'];
  this.files = opts['files'];
  this.doc_files = findFiles(this.files, /\.txt|\.md|readme|contributing/i);
  this.license_file = findFiles(this.files, /license/i);
  this.bundle = opts['bundle'];

  function findFiles(files, regex) {
    var matching_files = [];
    files.forEach((file) => {
      if(regex.test(file))
        matching_files.push(file);
    });
    return matching_files;
  }

  function getProjectURL() {
    if (opts['homepage'] !== undefined) {
      return opts['homepage'];
    } else {
      if (opts['bugs'] !== undefined) {
        return opts['bugs'].url;
      } else if (opts['repository'] !== undefined) {
        return opts['repository'].url;
      }
    }
  }
}
