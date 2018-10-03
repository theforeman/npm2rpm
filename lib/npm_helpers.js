module.exports.npmUrl = (name, version) => {
  return 'https://registry.npmjs.org/' + name + '/-/' + name + '-' + version + '.tgz';
}

module.exports.getRpmPackageName = (nodePackageName) => {
  return `nodejs-${this.rsplit(nodePackageName, '/')[1]}`;
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
