module.exports.npmUrl = (name, version) => {
  const parts = this.rsplit(name, '/');
  return 'https://registry.npmjs.org/' + name + '/-/' + parts[1] + '-' + version + '.tgz';
}

module.exports.getRpmPackageName = (nodePackageName) => {
  const parts = this.rsplit(nodePackageName, '/');
  const group = parts[0].replace('@', '');
  const name = parts[1];
  if (group !== '') {
    return `nodejs-${group}-${name}`;
  } else {
    return `nodejs-${name}`;
  }
}

module.exports.rsplit = (string, character) => {
  const index = string.lastIndexOf(character);
  if (index >= 0) {
    return [string.slice(0, index), string.slice(index + 1)];
  }
  return ['', string];
}

module.exports.getCacheFilename = (name, version) => {
  return `${name}-${version}-registry.npmjs.org.tgz`;
}

module.exports.getLockfileName = (name, version) => {
  return `${name}-${version}-package-lock.json`;
}

// Converts an npm (semver) version into a valid RPM version.
//
// RPM forbids '-' in a version: one is read as the version-release separator
// and a second one is a parse error ("Invalid version (double separator
// '-')"), which is what semver prereleases such as
// 7.21.0-placeholder-for-preset-env.2 hit. This follows the mapping Fedora's
// cargo2rpm uses for Rust crates, which share semver semantics:
//
//  - the prerelease separator '-' becomes '~', so the prerelease sorts before
//    the release, as in semver: 7.21.0~placeholder_for_preset_env.2 < 7.21.0
//  - a '-' inside the prerelease becomes '_', which never occurs in semver,
//    so the prerelease can be read back unambiguously
//  - build metadata ('+...') is dropped; semver ignores it for precedence
//
// Anything that is not a string is returned unchanged.
module.exports.rpmVersion = (version) => {
  if (typeof version !== 'string') {
    return version;
  }
  const match = /^([^-+]*)(?:-([^+]*))?(?:\+.*)?$/.exec(version);
  if (match === null) {
    return version;
  }
  let result = match[1];
  if (match[2] !== undefined) {
    result += '~' + match[2].replace(/-/g, '_');
  }
  return result;
}
