/**
 * Binary Detection Module
 *
 * Detects native binaries and WebAssembly modules in npm packages.
 * Based on detection logic from undici-sources.sh
 *
 * Detection methods (in order of performance):
 * 1. Extension check - fast, catches obvious cases
 * 2. MIME type check - medium speed, high accuracy using 'file' command
 * 3. Embedded Wasm check - slowest, catches base64-encoded Wasm
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Scan a directory for native binaries and WebAssembly modules
 * @param {string} dir - Directory path to scan
 * @returns {Object} - { hasBinaries: boolean, files: string[] }
 */
function scanForBinaries(dir) {
  const binaryFiles = [];

  // Find all files in the directory
  const files = getAllFiles(dir);

  for (const file of files) {
    const relativePath = path.relative(dir, file);

    // Check by extension (fast)
    if (hasBinaryExtension(file)) {
      binaryFiles.push(relativePath);
      continue;
    }

    // Check by MIME type (medium speed, requires file command)
    if (isBinaryByMimeType(file)) {
      binaryFiles.push(relativePath);
      continue;
    }

    // Check for embedded Wasm (slow, only for text-like files)
    if (hasEmbeddedWasm(file)) {
      binaryFiles.push(relativePath);
      continue;
    }
  }

  return {
    hasBinaries: binaryFiles.length > 0,
    files: binaryFiles
  };
}

/**
 * Recursively get all files in a directory
 * @param {string} dir - Directory to search
 * @returns {string[]} - Array of absolute file paths
 */
function getAllFiles(dir) {
  const results = [];

  function walk(currentPath) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        results.push(fullPath);
      }
    }
  }

  walk(dir);
  return results;
}

/**
 * Check if a file has a binary extension
 * @param {string} filepath - Path to file
 * @returns {boolean}
 */
function hasBinaryExtension(filepath) {
  const binaryExtensions = [
    '.node',   // Node.js native addon
    '.so',     // Linux shared library
    '.dylib',  // macOS dynamic library
    '.dll',    // Windows DLL
    '.exe',    // Windows executable
    '.wasm',   // WebAssembly module
  ];

  const ext = path.extname(filepath).toLowerCase();

  // Check exact extensions
  if (binaryExtensions.includes(ext)) {
    return true;
  }

  // Check for versioned .so files (e.g., .so.1, .so.1.2.3)
  if (filepath.match(/\.so\.\d+/)) {
    return true;
  }

  return false;
}

/**
 * Check if a file is a binary using 'file' command MIME type
 * @param {string} filepath - Path to file
 * @returns {boolean}
 */
function isBinaryByMimeType(filepath) {
  try {
    // Use file command with --mime-type for clean output
    // -N: don't pad filenames
    // --mime-type: only show MIME type
    const output = execSync(`file -N --mime-type "${filepath}"`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'] // suppress stderr
    }).trim();

    // Output format: "filepath: mime/type"
    const mimeType = output.split(':')[1]?.trim();

    if (!mimeType) {
      return false;
    }

    // MIME types for native binaries and WebAssembly
    const binaryMimeTypes = [
      'application/x-executable',           // ELF executables
      'application/x-pie-executable',       // Position Independent ELF
      'application/x-sharedlib',            // ELF shared libraries
      'application/x-mach-binary',          // macOS Mach-O
      'application/x-dosexec',              // Windows PE/COFF (older)
      'application/vnd.microsoft.portable-executable', // Windows PE (newer)
      'application/wasm',                   // WebAssembly modules
    ];

    return binaryMimeTypes.includes(mimeType);
  } catch (error) {
    // If file command fails, assume not a binary
    return false;
  }
}

/**
 * Check if a file contains base64-encoded WebAssembly
 * Wasm files start with magic bytes 0x00 0x61 0x73 0x6d
 * In base64, this is "AGFzb"
 * @param {string} filepath - Path to file
 * @returns {boolean}
 */
function hasEmbeddedWasm(filepath) {
  try {
    // Only check text-like files (skip obvious binaries)
    if (hasBinaryExtension(filepath)) {
      return false;
    }

    // Read file content as text
    const content = fs.readFileSync(filepath, 'utf8');

    // Check for Wasm magic bytes in base64
    // AGFzb is the base64 encoding of the first 4 bytes of a Wasm file
    return content.includes('AGFzb');
  } catch (error) {
    // If file is not readable as text, it's probably a binary
    // which would have been caught by other checks
    return false;
  }
}

module.exports = {
  scanForBinaries,
  hasBinaryExtension,
  isBinaryByMimeType,
  hasEmbeddedWasm,
};
