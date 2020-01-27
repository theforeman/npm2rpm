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
