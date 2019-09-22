var assert = require('assert');
var npmHelpers = require('../lib/npm_helpers.js');

describe('npmUrl', () => {
  it('returns the correct url', () => {
    const url = npmHelpers.npmUrl('foo', '1.2.3');
    assert.equal(url, 'https://registry.npmjs.org/foo/-/foo-1.2.3.tgz');
  });
});

describe('getRpmPackageName', () => {
  it('works with a simple name', () => {
    const name = npmHelpers.getRpmPackageName('foo');
    assert.equal(name, 'nodejs-foo');
  });

  it('works with a namespaces package', () => {
    const name = npmHelpers.getRpmPackageName('@group/foo');
    assert.equal(name, 'nodejs-group-foo');
  });
});

describe('rsplit', () => {
  it('works without occurance', () => {
    const result = npmHelpers.rsplit('foo', '/');
    assert.deepStrictEqual(result, ['', 'foo']);
  });

  it('works with once occurance', () => {
    const result = npmHelpers.rsplit('foo/bar', '/');
    assert.deepStrictEqual(result, ['foo', 'bar']);
  });

  it('works with two occurances', () => {
    const result = npmHelpers.rsplit('foo/bar/baz', '/');
    assert.deepStrictEqual(result, ['foo/bar', 'baz']);
  });
});

describe('getCacheFilename', () => {
  it('works without occurance', () => {
    const filename = npmHelpers.getCacheFilename('foo', '1.0.0');
    assert.equal(filename, 'foo-1.0.0-registry.npmjs.org.tgz');
  });

  it('works with macros', () => {
    const filename = npmHelpers.getCacheFilename('foo', '%{version}');
    assert.equal(filename, 'foo-%{version}-registry.npmjs.org.tgz');
  });
});
