var assert = require('assert');
var npmModule = require('../lib/npm_module.js');

describe('.setProjectURL', () => {
  beforeEach(() => {
    this.options = {
      name: 'foo',
      files: []
    };
  });

  it('uses homepage if one is defined', () => {
    this.options['homepage'] = 'http://foo';
    var npm_module = new npmModule(this.options);
    assert.equal(npm_module.project_url, this.options['homepage']);
  });

  it('uses bug tracker when homepage is not defined', () => {
    this.options['bugs'] = {
      url: 'https://bugtracker'
    }
    var npm_module = new npmModule(this.options);
    assert.equal(npm_module.project_url, 'https://bugtracker');
  });

  it('uses repository when nothing is defined', () => {
    this.options['repository'] = {
      url: 'https://repo'
    }
    var npm_module = new npmModule(this.options);
    assert.equal(npm_module.project_url, 'https://repo');
  });
});
