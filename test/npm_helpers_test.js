var assert = require('assert');
var npmHelpers = require('../lib/npm_helpers.js');

describe('npmUrl', () => {
  it('returns the correct url', () => {
    var url = npmHelpers.npmUrl('foo', '1.2.3');
    assert.equal(url, 'https://registry.npmjs.org/foo/-/foo-1.2.3.tgz');
  });
});
