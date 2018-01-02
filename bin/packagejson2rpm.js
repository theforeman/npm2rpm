#! /usr/bin/env node
var packagejson2rpm = require('commander');
const colors = require('colors');
const https = require("https");

console.log('------- packagejson2rpm ----'.green.bold);
console.log('------- part of npm2rpm ----'.grey.bold);
console.log('-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-'.rainbow.bgWhite);
packagejson2rpm
.option('-f, --file <file>', "Path to package.json file")
.option('-d, --dir <dir>', "Path to directory containing folders with RPM specs")
.option('--ignore-extra-folders', "No warnings for extra RPM folders will be shown")
.parse(process.argv);

if ((packagejson2rpm.file === undefined) ||
    packagejson2rpm.dir === undefined) {
      packagejson2rpm.help();
}

const fs = require('fs');
var packagejson = JSON.parse(fs.readFileSync(packagejson2rpm.file, 'utf8'));
var dependencies = Object.assign(packagejson["dependencies"], packagejson["devDependencies"])
const { lstatSync, readdirSync } = require('fs')
const { join } = require('path')
const isDirectory = source => lstatSync(source).isDirectory()
const getDirectories = source => readdirSync(source).map(name => join(source, name)).
  filter(name => isDirectory(name) && name.split("/").slice(-1)[0].substring(0, 6) === 'nodejs')
var directories = getDirectories(packagejson2rpm.dir)
// Get files and get versions
// Once we have versions, compare versions with package.json versions
const semver = require('semver')
directories.forEach(function (directory) {
  var package_name = directory.split("/").slice(-1)[0].substring(7,directory.length)
  var package_spec = directory + "/nodejs-" + package_name + ".spec"
  var dependency_version = dependencies[package_name]
  // Check if package name is in list of dependencies.
  if (dependency_version === undefined) {
    if (!packagejson2rpm.ignoreExtraFolders) {
      console.log(" - " + package_name.bold + " is not part of your dependencies, but it has an RPM folder.")
      console.log("This could happen if you are using unbundled dependencies or maybe the RPM folder is out of date with package.json")
    }
    return;
  } else {
    package_spec = fs.readFileSync(package_spec, 'utf8');
    var spec_version = package_spec.match(/Version: .*/g)[0].split(' ').slice(-1)[0]
    if (!semver.satisfies(spec_version, dependency_version)) {
       console.log("ERROR: ".bold.red + package_name.bold.red + " " + spec_version.bold + " in the spec, but dependency requires " + dependency_version.bold)
       const clean_semver = dependency_version.replace(/[^0-9.]+/, '')
       const url = "https://registry.npmjs.org/" + package_name + "/" + clean_semver
       https.get(url, res => {
         res.setEncoding("utf8");
         let body = "";
         res.on("data", data => {
           body += data;
         });
         res.on("end", () => {
           body = JSON.parse(body);
           if (body.dependencies === undefined) {
             var strategy = 'single'
           } else {
             var strategy = 'bundle'
           }
           console.log("./add_npm_package.sh " + package_name + " " + clean_semver + " " + strategy)
         });
       });
    }
  }
});
