const fs = require('fs');
const path = require('path');
const execFileSync = require('child_process').execFileSync;
const tmp = require('tmp');
const {getRpmPackageName} = require('./npm_helpers.js');

module.exports.generateLockfile = generateLockfile;
module.exports.lockfileDependencies = lockfileDependencies;

// The lockfile is the single source of truth for a bundle package: it records
// which exact tarballs npm will install and their integrity hashes. Generating
// it here (online) means the Source list and the lockfile are derived from one
// resolution and cannot drift apart.
//
// --install-strategy shallow keeps dependencies nested under the top-level
// package, which is the layout %install copies out of node_modules.
function generateLockfile(name, version, useLegacyPeerDeps) {
  // No mode is passed: tmp defaults to 0o700, which is what we want. (Note the
  // mode: 6644 elsewhere in this codebase is a decimal literal, i.e. 0o14764.)
  const dir = tmp.dirSync({prefix: 'npm2rpm-lock-', keep: true}).name;

  // The root package cannot share a name with its own dependency, so use the
  // RPM-style name. %prep regenerates this file from the lockfile, so whatever
  // is recorded here is what the build will use.
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
    name: getRpmPackageName(name),
    version: version,
    dependencies: {[name]: version}
  }, null, 2) + '\n');

  const args = ['install', '--package-lock-only', '--ignore-scripts',
                '--omit', 'optional', '--install-strategy', 'shallow'];
  if (useLegacyPeerDeps) {
    args.push('--legacy-peer-deps');
  }
  execFileSync('npm', args, {cwd: dir, stdio: [0, 1, 2]});

  const lockfile = JSON.parse(fs.readFileSync(path.join(dir, 'package-lock.json')));
  // Left behind on failure so the inputs can be inspected; removed once read.
  fs.rmSync(dir, {recursive: true, force: true});
  return lockfile;
}

// Returns [name, version, url] triples for every tarball the build needs,
// including the top-level package itself, in the shape spec_file_generator
// expects.
//
// The lockfile itself is shipped verbatim: npm records optional and dev
// dependencies even under --omit optional, and npm >= 11 rejects a lockfile
// with those entries removed ("Missing: <pkg> from lock file"). Only the
// Source list is filtered, so the tarballs the build never installs are not
// downloaded or annexed.
//
// devOptional marks a package reachable only through dev-or-optional paths;
// npm sets it *instead of* dev and optional, not alongside them, so it has to
// be excluded explicitly.
//
// The Source URL is taken from `resolved` rather than reconstructed from the
// name and version. npm ci verifies each tarball against the lockfile's
// integrity hash, so a reconstructed URL that resolves to different bytes --
// an aliased dependency, an alternate registry, a git dep -- would fail with
// EINTEGRITY a long way from the cause. Carrying the URL npm recorded makes
// the annexed bytes the pinned bytes by construction.
function lockfileDependencies(lockfile) {
  const seen = new Map();
  for (const [location, entry] of Object.entries(lockfile.packages)) {
    if (location === '' || !entry.resolved) {
      continue;
    }
    if (entry.optional || entry.dev || entry.devOptional) {
      continue;
    }
    const name = entry.name || location.slice(location.lastIndexOf('node_modules/') + 'node_modules/'.length);
    seen.set(`${name}@${entry.version}`, [name, entry.version, entry.resolved]);
  }
  return Array.from(seen.values());
}
