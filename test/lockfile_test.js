var assert = require('assert');
var lockfile = require('../lib/lockfile.js');

const sample = {
  name: 'nodejs-example',
  version: '1.0.0',
  lockfileVersion: 3,
  packages: {
    '': {dependencies: {example: '1.0.0'}},
    'node_modules/example': {version: '1.0.0', resolved: 'https://registry.npmjs.org/example/-/example-1.0.0.tgz'},
    'node_modules/example/node_modules/@scope/dep': {version: '2.0.0', resolved: 'https://registry.npmjs.org/@scope/dep/-/dep-2.0.0.tgz'},
    'node_modules/example/node_modules/warning': {version: '3.0.0', resolved: 'https://registry.npmjs.org/warning/-/warning-3.0.0.tgz'},
    'node_modules/example/node_modules/other/node_modules/warning': {version: '4.0.3', resolved: 'https://registry.npmjs.org/warning/-/warning-4.0.3.tgz'},
    'node_modules/example/node_modules/typed': {version: '9.9.9', resolved: 'https://registry.npmjs.org/typed/-/typed-9.9.9.tgz', optional: true},
    'node_modules/example/node_modules/linter': {version: '8.8.8', resolved: 'https://registry.npmjs.org/linter/-/linter-8.8.8.tgz', dev: true},
    // reachable only through dev-or-optional paths: npm sets devOptional
    // instead of dev and optional, not alongside them
    'node_modules/example/node_modules/fixture': {version: '7.7.7', resolved: 'https://registry.npmjs.org/fixture/-/fixture-7.7.7.tgz', devOptional: true},
    // an aliased dependency: the tarball name does not match the install path
    'node_modules/example/node_modules/aliased': {name: 'upstream-name', version: '5.0.0', resolved: 'https://registry.npmjs.org/upstream-name/-/upstream-name-5.0.0.tgz'}
  }
};

describe('lockfileDependencies', () => {
  const deps = lockfileDependenciesOf(sample);

  function lockfileDependenciesOf(lock) {
    return lockfile.lockfileDependencies(lock);
  }

  // The lockfile ships verbatim (npm >= 11 rejects one with entries removed),
  // so the optional/dev filtering has to happen here, on the Source list.
  it('omits optional and dev dependencies, which are never installed', () => {
    assert.ok(!deps.some(([name]) => name === 'typed' || name === 'linter'));
  });

  it('omits devOptional dependencies', () => {
    assert.ok(!deps.some(([name]) => name === 'fixture'));
  });

  it('carries the URL the lockfile resolved to, rather than rebuilding it', () => {
    assert.deepEqual(
      deps.find(([name]) => name === 'upstream-name'),
      ['upstream-name', '5.0.0', 'https://registry.npmjs.org/upstream-name/-/upstream-name-5.0.0.tgz']
    );
  });

  it('returns a URL for every dependency', () => {
    assert.ok(deps.every(([, , url]) => typeof url === 'string' && url.length > 0));
  });

  it('skips the root entry, which has no tarball', () => {
    assert.ok(!deps.some(([name]) => name === ''));
  });

  it('includes the top-level package itself', () => {
    assert.deepEqual(deps.find(([name]) => name === 'example'),
      ['example', '1.0.0', 'https://registry.npmjs.org/example/-/example-1.0.0.tgz']);
  });

  it('recovers scoped names from nested paths', () => {
    assert.deepEqual(deps.find(([name]) => name === '@scope/dep'),
      ['@scope/dep', '2.0.0', 'https://registry.npmjs.org/@scope/dep/-/dep-2.0.0.tgz']);
  });

  it('keeps every version of a multi-version dependency', () => {
    const versions = deps.filter(([name]) => name === 'warning').map(([, version]) => version);
    assert.deepEqual(versions.sort(), ['3.0.0', '4.0.3']);
  });

  it('deduplicates a dependency appearing at several locations', () => {
    const withDuplicate = JSON.parse(JSON.stringify(sample));
    withDuplicate.packages['node_modules/example/node_modules/dup/node_modules/warning'] =
      {version: '3.0.0', resolved: 'https://registry.npmjs.org/warning/-/warning-3.0.0.tgz'};
    const names = lockfileDependenciesOf(withDuplicate).filter(([name]) => name === 'warning');
    assert.equal(names.length, 2);
  });
});
