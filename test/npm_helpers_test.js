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

describe('rpmVersion', () => {
  const rpmVersion = npmHelpers.rpmVersion;

  it('leaves a release version alone', () => {
    assert.equal(rpmVersion('7.29.14'), '7.29.14');
  });

  it('maps the prerelease separator to a tilde', () => {
    assert.equal(rpmVersion('1.0.0-beta.2'), '1.0.0~beta.2');
  });

  it('maps hyphens inside the prerelease to underscores', () => {
    assert.equal(rpmVersion('7.21.0-placeholder-for-preset-env.2'), '7.21.0~placeholder_for_preset_env.2');
    assert.equal(rpmVersion('0.1.6-no-external-plugins'), '0.1.6~no_external_plugins');
  });

  it('drops build metadata', () => {
    assert.equal(rpmVersion('4.0.0+sha.abc'), '4.0.0');
    assert.equal(rpmVersion('3.0.0-rc.1+build-5'), '3.0.0~rc.1');
  });

  it('keeps the case of prerelease identifiers', () => {
    assert.equal(rpmVersion('5.0.0-Alpha.X1'), '5.0.0~Alpha.X1');
  });

  it('passes anything that is not a string through', () => {
    assert.equal(rpmVersion(undefined), undefined);
    assert.equal(rpmVersion(null), null);
  });

  it('never returns a hyphen for a valid semver version', () => {
    ['1.0.0-0', '1.0.0--', '1.0.0-a-b-c.d-e', '1.0.0-x+y-z'].forEach((v) => {
      assert.ok(!rpmVersion(v).includes('-'), v);
    });
  });
});
