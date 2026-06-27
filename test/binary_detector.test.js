/**
 * Unit tests for binary_detector.js
 *
 * Tests detection of native binaries and WebAssembly modules
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const tmp = require('tmp');
const binaryDetector = require('../lib/binary_detector');

describe('binary_detector', function() {
  let tmpDir;

  beforeEach(function() {
    // Create temp directory for test files
    tmpDir = tmp.dirSync({ unsafeCleanup: true });
  });

  afterEach(function() {
    // Clean up temp directory
    if (tmpDir) {
      tmpDir.removeCallback();
    }
  });

  describe('hasBinaryExtension', function() {
    it('should detect .node files', function() {
      assert.strictEqual(binaryDetector.hasBinaryExtension('binding.node'), true);
      assert.strictEqual(binaryDetector.hasBinaryExtension('/path/to/addon.node'), true);
    });

    it('should detect .wasm files', function() {
      assert.strictEqual(binaryDetector.hasBinaryExtension('module.wasm'), true);
      assert.strictEqual(binaryDetector.hasBinaryExtension('/path/to/code.wasm'), true);
    });

    it('should detect .so files', function() {
      assert.strictEqual(binaryDetector.hasBinaryExtension('library.so'), true);
      assert.strictEqual(binaryDetector.hasBinaryExtension('library.so.1'), true);
      assert.strictEqual(binaryDetector.hasBinaryExtension('library.so.1.2.3'), true);
    });

    it('should detect .dylib files (macOS)', function() {
      assert.strictEqual(binaryDetector.hasBinaryExtension('library.dylib'), true);
    });

    it('should detect .dll and .exe files (Windows)', function() {
      assert.strictEqual(binaryDetector.hasBinaryExtension('library.dll'), true);
      assert.strictEqual(binaryDetector.hasBinaryExtension('program.exe'), true);
    });

    it('should not detect JavaScript files', function() {
      assert.strictEqual(binaryDetector.hasBinaryExtension('index.js'), false);
      assert.strictEqual(binaryDetector.hasBinaryExtension('module.mjs'), false);
    });

    it('should not detect JSON files', function() {
      assert.strictEqual(binaryDetector.hasBinaryExtension('package.json'), false);
    });

    it('should handle files with no extension', function() {
      assert.strictEqual(binaryDetector.hasBinaryExtension('README'), false);
      assert.strictEqual(binaryDetector.hasBinaryExtension('LICENSE'), false);
    });

    it('should be case-insensitive', function() {
      assert.strictEqual(binaryDetector.hasBinaryExtension('MODULE.WASM'), true);
      assert.strictEqual(binaryDetector.hasBinaryExtension('Binding.Node'), true);
    });
  });

  describe('hasEmbeddedWasm', function() {
    it('should detect base64-encoded Wasm magic bytes', function() {
      const testFile = path.join(tmpDir.name, 'embedded.js');
      const content = `
        // This file contains embedded WebAssembly
        const wasmBinary = "AGFzbQEAAAABhICAgAABYAAAYAF/AX8CjoCAgAABA2Vudg";
      `;
      fs.writeFileSync(testFile, content);

      assert.strictEqual(binaryDetector.hasEmbeddedWasm(testFile), true);
    });

    it('should not detect files without Wasm magic bytes', function() {
      const testFile = path.join(tmpDir.name, 'normal.js');
      const content = `
        const hello = "world";
        console.log(hello);
      `;
      fs.writeFileSync(testFile, content);

      assert.strictEqual(binaryDetector.hasEmbeddedWasm(testFile), false);
    });

    it('should not scan binary extension files', function() {
      const testFile = path.join(tmpDir.name, 'binary.node');
      fs.writeFileSync(testFile, 'AGFzbQEAAAA'); // Contains magic bytes

      // Should return false because .node files are skipped
      assert.strictEqual(binaryDetector.hasEmbeddedWasm(testFile), false);
    });
  });

  describe('scanForBinaries', function() {
    it('should find .node files in directory', function() {
      const bindingPath = path.join(tmpDir.name, 'lib', 'binding');
      fs.mkdirSync(bindingPath, { recursive: true });
      fs.writeFileSync(path.join(bindingPath, 'addon.node'), 'fake binary');
      fs.writeFileSync(path.join(tmpDir.name, 'index.js'), 'module.exports = {}');

      const result = binaryDetector.scanForBinaries(tmpDir.name);

      assert.strictEqual(result.hasBinaries, true);
      assert.strictEqual(result.files.length, 1);
      assert.strictEqual(result.files[0], path.join('lib', 'binding', 'addon.node'));
    });

    it('should find .wasm files in directory', function() {
      fs.writeFileSync(path.join(tmpDir.name, 'module.wasm'), 'fake wasm');
      fs.writeFileSync(path.join(tmpDir.name, 'index.js'), 'module.exports = {}');

      const result = binaryDetector.scanForBinaries(tmpDir.name);

      assert.strictEqual(result.hasBinaries, true);
      assert.strictEqual(result.files.length, 1);
      assert.strictEqual(result.files[0], 'module.wasm');
    });

    it('should find multiple binaries', function() {
      fs.writeFileSync(path.join(tmpDir.name, 'binding.node'), 'fake binary');
      fs.writeFileSync(path.join(tmpDir.name, 'module.wasm'), 'fake wasm');
      fs.writeFileSync(path.join(tmpDir.name, 'library.so'), 'fake so');
      fs.writeFileSync(path.join(tmpDir.name, 'index.js'), 'module.exports = {}');

      const result = binaryDetector.scanForBinaries(tmpDir.name);

      assert.strictEqual(result.hasBinaries, true);
      assert.strictEqual(result.files.length, 3);
      assert.ok(result.files.includes('binding.node'));
      assert.ok(result.files.includes('module.wasm'));
      assert.ok(result.files.includes('library.so'));
    });

    it('should return empty array for pure JavaScript package', function() {
      fs.writeFileSync(path.join(tmpDir.name, 'index.js'), 'module.exports = {}');
      fs.writeFileSync(path.join(tmpDir.name, 'package.json'), '{}');
      fs.mkdirSync(path.join(tmpDir.name, 'lib'));
      fs.writeFileSync(path.join(tmpDir.name, 'lib', 'util.js'), 'exports.foo = 1');

      const result = binaryDetector.scanForBinaries(tmpDir.name);

      assert.strictEqual(result.hasBinaries, false);
      assert.strictEqual(result.files.length, 0);
    });

    it('should find embedded Wasm in JavaScript files', function() {
      const jsFile = path.join(tmpDir.name, 'loader.js');
      fs.writeFileSync(jsFile, 'const wasm = "AGFzbQEAAAA"');

      const result = binaryDetector.scanForBinaries(tmpDir.name);

      assert.strictEqual(result.hasBinaries, true);
      assert.strictEqual(result.files.length, 1);
      assert.strictEqual(result.files[0], 'loader.js');
    });

    it('should handle nested directory structures', function() {
      const deepPath = path.join(tmpDir.name, 'a', 'b', 'c', 'd');
      fs.mkdirSync(deepPath, { recursive: true });
      fs.writeFileSync(path.join(deepPath, 'deep.node'), 'fake binary');
      fs.writeFileSync(path.join(tmpDir.name, 'index.js'), 'module.exports = {}');

      const result = binaryDetector.scanForBinaries(tmpDir.name);

      assert.strictEqual(result.hasBinaries, true);
      assert.strictEqual(result.files.length, 1);
      assert.strictEqual(result.files[0], path.join('a', 'b', 'c', 'd', 'deep.node'));
    });
  });

  describe('isBinaryByMimeType', function() {
    // Note: These tests require the 'file' command to be available
    // Skip if not available
    before(function() {
      try {
        require('child_process').execSync('which file', { stdio: 'ignore' });
      } catch (e) {
        this.skip();
      }
    });

    it('should detect text files as non-binary', function() {
      const testFile = path.join(tmpDir.name, 'test.js');
      fs.writeFileSync(testFile, 'console.log("hello");');

      assert.strictEqual(binaryDetector.isBinaryByMimeType(testFile), false);
    });

    it('should detect JSON files as non-binary', function() {
      const testFile = path.join(tmpDir.name, 'package.json');
      fs.writeFileSync(testFile, '{"name": "test"}');

      assert.strictEqual(binaryDetector.isBinaryByMimeType(testFile), false);
    });

    // Note: Creating actual ELF/Mach-O/PE binaries is complex
    // In real testing, you'd test against actual npm packages with binaries
  });
});
