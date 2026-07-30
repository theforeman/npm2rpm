/**
 * Dependency Analyzer Module
 *
 * Downloads and analyzes npm dependencies for native binaries and WebAssembly.
 * Determines which dependencies can be bundled vs must be packaged separately.
 */

const fs = require('fs');
const path = require('path');
const tmp = require('tmp');
const request = require('request');
const tar = require('tar');
const binaryDetector = require('./binary_detector');
const { npmUrl } = require('./npm_helpers');

/**
 * Analyze a single dependency for binaries
 * @param {string} name - Package name
 * @param {string} version - Package version
 * @param {Object} options - { cacheDir: string } - optional cache directory to save tarballs
 * @returns {Promise<Object>} - { name, version, hasBinaries, binaryFiles }
 */
async function analyzeDependency(name, version, options = {}) {
  let tmpDir = null;

  try {
    // Download and extract the package
    const downloadResult = await downloadAndExtract(name, version, options);
    tmpDir = downloadResult.extractedDir;

    // Scan for binaries
    const scanResult = binaryDetector.scanForBinaries(tmpDir);

    return {
      name,
      version,
      hasBinaries: scanResult.hasBinaries,
      binaryFiles: scanResult.files,
      tarballPath: downloadResult.tarballPath // Include path to cached tarball
    };
  } catch (error) {
    // If download or analysis fails, treat as having binaries (safer default)
    console.warn(`Warning: Failed to analyze ${name}@${version}: ${error.message}`);
    return {
      name,
      version,
      hasBinaries: true,
      binaryFiles: [],
      error: error.message
    };
  } finally {
    // Clean up temp directory (but keep cached tarball if cacheDir was specified)
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }
}

/**
 * Analyze all dependencies in parallel
 * @param {Array} dependencies - [{name, version}, ...]
 * @param {Object} options - { concurrency: number, cacheDir: string }
 * @returns {Promise<Object>} - { bundled: [], unbundled: [] }
 */
async function analyzeDependencies(dependencies, options = {}) {
  const concurrency = options.concurrency || 5;
  const results = [];

  // Process dependencies in batches to limit concurrency
  for (let i = 0; i < dependencies.length; i += concurrency) {
    const batch = dependencies.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(dep => analyzeDependency(dep.name, dep.version, options))
    );
    results.push(...batchResults);

    // Progress indicator
    if (options.verbose) {
      console.log(`   Analyzed ${Math.min(i + concurrency, dependencies.length)}/${dependencies.length} dependencies`);
    }
  }

  // Split into bundled (no binaries) and unbundled (has binaries)
  const bundled = results.filter(r => !r.hasBinaries);
  const unbundled = results.filter(r => r.hasBinaries);

  return { bundled, unbundled };
}

/**
 * Helper: Find the extracted package directory in a temp directory
 * @param {string} tmpDirPath - Path to temp directory
 * @returns {string|null} - Name of the package directory, or null if not found
 */
function findPackageDir(tmpDirPath) {
  const entries = fs.readdirSync(tmpDirPath);
  return entries.find(entry => {
    const fullPath = path.join(tmpDirPath, entry);
    try {
      const isDir = fs.statSync(fullPath).isDirectory();
      const hasPackageJson = isDir && fs.existsSync(path.join(fullPath, 'package.json'));
      return hasPackageJson;
    } catch (e) {
      return false;
    }
  });
}

/**
 * Helper: Extract tarball and find package directory
 * @param {string} tarballPath - Path to tarball file
 * @param {string} tmpDirPath - Path to extract to
 * @param {string} name - Package name (for error messages)
 * @param {string} version - Package version (for error messages)
 * @returns {Promise<string>} - Path to extracted package directory
 */
function extractAndFind(tarballPath, tmpDirPath, name, version) {
  return new Promise((resolve, reject) => {
    const extractStream = tar.extract({ cwd: tmpDirPath });
    fs.createReadStream(tarballPath)
      .on('error', error => {
        reject(new Error(`Failed to read ${name}@${version}: ${error.message}`));
      })
      .pipe(extractStream)
      .on('error', error => {
        reject(new Error(`Failed to extract ${name}@${version}: ${error.message}`));
      })
      .on('finish', () => {
        const packageDir = findPackageDir(tmpDirPath);
        if (!packageDir) {
          reject(new Error(`Package directory not found for ${name}@${version}`));
          return;
        }
        resolve(path.join(tmpDirPath, packageDir));
      });
  });
}

/**
 * Download and extract npm package to temp directory
 * @param {string} name - Package name
 * @param {string} version - Package version
 * @param {Object} options - { cacheDir: string } - optional cache directory to save tarball
 * @returns {Promise<Object>} - { extractedDir: string, tarballPath: string }
 */
async function downloadAndExtract(name, version, options = {}) {
  const url = npmUrl(name, version);
  const tmpDir = tmp.dirSync({ prefix: 'npm2rpm-dep-', unsafeCleanup: true });
  const tarballFilename = url.split('/').pop();

  try {
    // Determine cache path if caching is enabled
    const tarballPath = options.cacheDir ? path.join(options.cacheDir, tarballFilename) : null;

    // If already cached, extract from cache
    if (tarballPath && fs.existsSync(tarballPath)) {
      const extractedDir = await extractAndFind(tarballPath, tmpDir.name, name, version);
      return { extractedDir, tarballPath };
    }

    // Download to temp location
    const tmpTarball = path.join(tmpDir.name, tarballFilename);
    await new Promise((resolve, reject) => {
      request.get(url)
        .on('error', error => reject(new Error(`Failed to download ${name}@${version}: ${error.message}`)))
        .pipe(fs.createWriteStream(tmpTarball))
        .on('error', error => reject(new Error(`Failed to write ${name}@${version}: ${error.message}`)))
        .on('finish', resolve);
    });

    // Copy to cache if requested
    if (tarballPath) {
      try {
        fs.copyFileSync(tmpTarball, tarballPath);
      } catch (error) {
        console.warn(`Warning: Failed to cache ${name}@${version}: ${error.message}`);
      }
    }

    // Extract and find package directory
    const extractedDir = await extractAndFind(tmpTarball, tmpDir.name, name, version);
    return { extractedDir, tarballPath };

  } catch (error) {
    tmpDir.removeCallback();
    throw error;
  }
}

/**
 * Analyze dependencies and categorize them
 * Helper function that also separates runtime vs dev dependencies
 * @param {Array} allDependencies - All dependencies to analyze
 * @param {Object} packageJson - The main package's package.json
 * @param {Object} options - Analysis options
 * @returns {Promise<Object>} - { bundled, unbundledRuntime, unbundledDev }
 */
async function analyzeAndCategorizeDependencies(allDependencies, packageJson, options = {}) {
  const analysis = await analyzeDependencies(allDependencies, options);

  // Separate unbundled into runtime vs dev
  const runtimeDeps = new Set(Object.keys(packageJson.dependencies || {}));
  const devDeps = new Set(Object.keys(packageJson.devDependencies || {}));

  // Transitive dependencies (not in package.json) are treated as runtime dependencies
  const unbundledRuntime = analysis.unbundled.filter(dep =>
    runtimeDeps.has(dep.name) || (!runtimeDeps.has(dep.name) && !devDeps.has(dep.name))
  );
  const unbundledDev = analysis.unbundled.filter(dep => devDeps.has(dep.name));

  return {
    bundled: analysis.bundled,
    unbundledRuntime,
    unbundledDev,
    unbundled: analysis.unbundled // Keep full list for backward compat
  };
}

module.exports = {
  analyzeDependency,
  analyzeDependencies,
  downloadAndExtract,
  analyzeAndCategorizeDependencies,
};
