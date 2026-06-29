/**
 * Remote dependency listing
 *
 * Simplified version of npm-remote-ls that fetches a flattened list
 * of production dependencies for a given package.
 *
 * Based on npm-remote-ls by npm, Inc.
 */

const semver = require('semver');
const request = require('request');

/**
 * Fetch a flattened list of production dependencies
 * @param {string} name - Package name
 * @param {string} version - Package version (or 'latest')
 * @param {Object} options - { development: boolean, optional: boolean, registry: string }
 * @param {Function} callback - Called with array of 'name@version' strings
 */
function fetchDependencies(name, version, options, callback) {
  // Handle optional parameters
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  const opts = Object.assign({
    development: false,
    optional: false,
    registry: 'https://registry.npmjs.org'
  }, options);

  const flat = {};
  const pending = new Set();
  let processing = 0;

  function done() {
    processing--;
    if (processing === 0 && pending.size === 0) {
      callback(Object.keys(flat));
    }
  }

  function loadPackage(pkgName, pkgVersion) {
    const key = `${pkgName}@${pkgVersion}`;

    // Skip if already processed or pending
    if (flat[key] || pending.has(key)) {
      return;
    }

    pending.add(key);
    processing++;

    // Escape scoped package names for registry URL
    const escapedName = pkgName.replace(/\//g, '%2f');
    const url = `${opts.registry.replace(/\/$/, '')}/${escapedName}`;

    request.get(url, { json: true }, function (err, res, packageJson) {
      pending.delete(key);

      if (err || (res.statusCode < 200 || res.statusCode >= 400)) {
        console.warn(`Warning: Could not load ${pkgName}@${pkgVersion}`);
        done();
        return;
      }

      try {
        const resolvedVersion = guessVersion(pkgVersion, packageJson);
        const versionData = packageJson.versions[resolvedVersion];

        if (!versionData) {
          console.warn(`Warning: Version ${resolvedVersion} not found for ${pkgName}`);
          done();
          return;
        }

        // Mark as processed with resolved version
        const fullName = `${pkgName}@${resolvedVersion}`;
        flat[fullName] = true;

        // Collect dependencies
        const deps = versionData.dependencies || {};

        // Add optional dependencies if requested
        if (opts.optional && versionData.optionalDependencies) {
          Object.assign(deps, versionData.optionalDependencies);
        }

        // Add dev dependencies only for root package if requested
        if (opts.development && pkgName === name && versionData.devDependencies) {
          Object.assign(deps, versionData.devDependencies);
        }

        // Queue dependencies
        Object.keys(deps).forEach(depName => {
          loadPackage(depName, deps[depName]);
        });

      } catch (e) {
        console.warn(`Warning: Error processing ${pkgName}@${pkgVersion}: ${e.message}`);
      }

      done();
    });
  }

  // Start with the root package
  loadPackage(name, version);
}

/**
 * Resolve a version range to a specific version
 */
function guessVersion(versionString, packageJson) {
  if (versionString === 'latest') {
    versionString = '*';
  }

  const availableVersions = Object.keys(packageJson.versions);
  let version = semver.maxSatisfying(availableVersions, versionString, true);

  // Check for prerelease-only versions
  if (!version && versionString === '*') {
    const allPrerelease = availableVersions.every(av => {
      const sv = new semver.SemVer(av, true);
      return sv.prerelease && sv.prerelease.length > 0;
    });

    if (allPrerelease && packageJson['dist-tags'] && packageJson['dist-tags'].latest) {
      version = packageJson['dist-tags'].latest;
    }
  }

  if (!version) {
    throw new Error(`Could not find a satisfactory version for string ${versionString}`);
  }

  return version;
}

module.exports = {
  fetchDependencies
};
