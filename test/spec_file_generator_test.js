var assert = require('assert');
var specFileGenerator = require('../lib/spec_file_generator.js');

describe('dependenciesToRequires', () => {
  var d2r = specFileGenerator.dependenciesToRequires;
  it('handles a single version number', () => {
    var deps = {'foo': '1.2.3'};
    assert.deepEqual(d2r(deps), ['npm(foo) = 1.2.3']);
  });

  it('handles comparators', () => {
    var lt  = {'foo': '< 1.2.3'};
    var lte = {'foo': '<= 1.2.3'};
    var eq  = {'foo': '= 1.2.3'};
    var gt  = {'foo': '> 1.2.3'};
    var gte = {'foo': '>= 1.2.3'};

    assert.deepEqual(d2r(lt),  ['npm(foo) < 1.2.3']);
    assert.deepEqual(d2r(lte), ['npm(foo) <= 1.2.3']);
    assert.deepEqual(d2r(eq),  ['npm(foo) = 1.2.3']);
    assert.deepEqual(d2r(gt),  ['npm(foo) > 1.2.3']);
    assert.deepEqual(d2r(gte), ['npm(foo) >= 1.2.3']);
  });

  it('handles basic ranges', () => {
    var deps = {'foo': '>= 1.2.3 <4.5.6'};
    assert.deepEqual(d2r(deps), ['npm(foo) >= 1.2.3', 'npm(foo) < 4.5.6']);
  });

  it('handles hyphen ranges', () => {
    var depsFull = {'foo': '1.2.3 - 4.5.6'};
    var depsPartialStart = {'foo': '1.2 - 4.5.6'};
    var depsPartialEnd = {'foo': '1.2.3 - 4.5'};
    assert.deepEqual(d2r(depsFull), ['npm(foo) >= 1.2.3', 'npm(foo) <= 4.5.6']);
    assert.deepEqual(d2r(depsPartialStart), ['npm(foo) >= 1.2.0', 'npm(foo) <= 4.5.6']);
    assert.deepEqual(d2r(depsPartialEnd), ['npm(foo) >= 1.2.3', 'npm(foo) < 4.6.0']);
  });

  it('handles X-ranges', () => {
    var deps1X1 = {'foo': '1.2.x'};
    var deps1X2 = {'foo': '1.2.X'};
    var deps1X3 = {'foo': '1.2.*'};
    var deps1X4 = {'foo': '1.2'};
    var deps2X1 = {'foo': '1.x.x'};
    var deps2X2 = {'foo': '1.x'};
    var deps2X3 = {'foo': '1'};
    var deps3X1 = {'foo': '*'};
    var deps3X2 = {'foo': ''};
    assert.deepEqual(d2r(deps1X1), ['npm(foo) >= 1.2.0', 'npm(foo) < 1.3.0']);
    assert.deepEqual(d2r(deps1X2), ['npm(foo) >= 1.2.0', 'npm(foo) < 1.3.0']);
    assert.deepEqual(d2r(deps1X3), ['npm(foo) >= 1.2.0', 'npm(foo) < 1.3.0']);
    assert.deepEqual(d2r(deps1X4), ['npm(foo) >= 1.2.0', 'npm(foo) < 1.3.0']);
    assert.deepEqual(d2r(deps2X1), ['npm(foo) >= 1.0.0', 'npm(foo) < 2.0.0']);
    assert.deepEqual(d2r(deps2X2), ['npm(foo) >= 1.0.0', 'npm(foo) < 2.0.0']);
    assert.deepEqual(d2r(deps2X3), ['npm(foo) >= 1.0.0', 'npm(foo) < 2.0.0']);
    assert.deepEqual(d2r(deps3X1), ['npm(foo)']);
    assert.deepEqual(d2r(deps3X2), ['npm(foo)']);
  });

  it('handles tilde ranges', () => {
    var tildeFullVersion         = {'foo': '~1.2.3'};
    var tildePartial1            = {'foo': '~1.2'};
    var tildePartial2            = {'foo': '~1'};
    var tildeUnstableFullVersion = {'foo': '~0.2.3'};
    var tildeUnstablePartial1    = {'foo': '~0.2'};
    var tildeUnstablePartial2    = {'foo': '~0'};
    var tildePreRelease          = {'foo': '~1.2.3-beta.2'};

    assert.deepEqual(d2r(tildeFullVersion),         ['npm(foo) >= 1.2.3', 'npm(foo) < 1.3.0']);
    assert.deepEqual(d2r(tildePartial1),            ['npm(foo) >= 1.2.0', 'npm(foo) < 1.3.0']);
    assert.deepEqual(d2r(tildePartial2),            ['npm(foo) >= 1.0.0', 'npm(foo) < 2.0.0']);
    assert.deepEqual(d2r(tildeUnstableFullVersion), ['npm(foo) >= 0.2.3', 'npm(foo) < 0.3.0']);
    assert.deepEqual(d2r(tildeUnstablePartial1),    ['npm(foo) >= 0.2.0', 'npm(foo) < 0.3.0']);
    assert.deepEqual(d2r(tildeUnstablePartial2),    ['npm(foo) >= 0.0.0', 'npm(foo) < 1.0.0']);
    assert.deepEqual(d2r(tildePreRelease),          ['npm(foo) >= 1.2.3-beta.2', 'npm(foo) < 1.3.0']);
  });

  it('handles caret ranges', () => {
    var caretFullVersion          = {'foo': '^1.2.3'};
    var caretPartial1             = {'foo': '^1.2.x'};
    var caretPartial2             = {'foo': '^1.x.x'};
    var caretPartial3             = {'foo': '^1.x'};
    var caretUnstableFullVersion  = {'foo': '^0.2.3'};
    var caretUnstablePartial1     = {'foo': '^0.2.x'};
    var caretUnstable2FullVersion = {'foo': '^0.0.3'};
    var caretUnstable2Partial1    = {'foo': '^0.0.x'};
    var caretUnstable2Partial2    = {'foo': '^0.0'};
    var caretPreRelease           = {'foo': '^1.2.3-beta.2'};
    var caretUnstablePreRelease   = {'foo': '^0.0.3-beta.2'};

    assert.deepEqual(d2r(caretFullVersion),          ['npm(foo) >= 1.2.3', 'npm(foo) < 2.0.0']);
    assert.deepEqual(d2r(caretPartial1),             ['npm(foo) >= 1.2.0', 'npm(foo) < 2.0.0']);
    assert.deepEqual(d2r(caretPartial2),             ['npm(foo) >= 1.0.0', 'npm(foo) < 2.0.0']);
    assert.deepEqual(d2r(caretUnstableFullVersion),  ['npm(foo) >= 0.2.3', 'npm(foo) < 0.3.0']);
    assert.deepEqual(d2r(caretUnstablePartial1),     ['npm(foo) >= 0.2.0', 'npm(foo) < 0.3.0']);
    assert.deepEqual(d2r(caretUnstable2FullVersion), ['npm(foo) >= 0.0.3', 'npm(foo) < 0.0.4']);
    assert.deepEqual(d2r(caretUnstable2Partial1),    ['npm(foo) >= 0.0.0', 'npm(foo) < 0.1.0']);
    assert.deepEqual(d2r(caretUnstable2Partial2),    ['npm(foo) >= 0.0.0', 'npm(foo) < 0.1.0']);
    assert.deepEqual(d2r(caretPreRelease),           ['npm(foo) >= 1.2.3-beta.2', 'npm(foo) < 2.0.0']);
    assert.deepEqual(d2r(caretUnstablePreRelease),   ['npm(foo) >= 0.0.3-beta.2', 'npm(foo) < 0.0.4']);
  });

  it('ignores || ranges', () => {
    var or1 = {'foo': '1.2.3 || 4.5.6'};
    var or2 = {'foo': '1.x || >=2.5.0 || 5.0.0 - 7.2.3'};

    assert.deepEqual(d2r(or1), ['npm(foo)']);
    assert.deepEqual(d2r(or2), ['npm(foo)']);
  });

  it('ignores invalid versions', () => {
    var invalid = {'foo': 'a.b.c'};
    assert.deepEqual(d2r(invalid), ['npm(foo)']);
  });

  it('handles scl prefix', () => {
    var deps = {'foo': '1.2.3'};
    assert.deepEqual(d2r(deps, true), ['%{scl_prefix}npm(foo) = 1.2.3']);
  });

  it('handles comparators with scl prefix', () => {
    var lt  = {'foo': '< 1.2.3'};
    var lte = {'foo': '<= 1.2.3'};
    var eq  = {'foo': '= 1.2.3'};
    var gt  = {'foo': '> 1.2.3'};
    var gte = {'foo': '>= 1.2.3'};

    assert.deepEqual(d2r(lt, true),  ['%{scl_prefix}npm(foo) < 1.2.3']);
    assert.deepEqual(d2r(lte, true), ['%{scl_prefix}npm(foo) <= 1.2.3']);
    assert.deepEqual(d2r(eq, true),  ['%{scl_prefix}npm(foo) = 1.2.3']);
    assert.deepEqual(d2r(gt, true),  ['%{scl_prefix}npm(foo) > 1.2.3']);
    assert.deepEqual(d2r(gte, true), ['%{scl_prefix}npm(foo) >= 1.2.3']);
  });
});
