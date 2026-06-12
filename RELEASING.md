# Releasing npm2rpm

## Prerequisites

- Push access to the [theforeman/npm2rpm](https://github.com/theforeman/npm2rpm) repository

## Steps

1. Determine the version bump based on [semver](https://semver.org/).

2. Bump the version, commit, and tag:

   ```bash
   npm version patch  # or minor, or major
   ```

   This updates `package.json`, creates a commit, and tags it.
   The `.npmrc` configures `tag-version-prefix=""` (no `v` prefix on tags) and `message="Release %s"` (commit message format), matching the existing convention.

3. Push the commit and tag to upstream:

   ```bash
   git push upstream master --follow-tags
   ```

4. The [Publish Package](.github/workflows/release.yml) workflow triggers on the tag push and publishes to the npm registry using OIDC trusted publishers.

5. Verify the release:

   ```bash
   npm view npm2rpm version
   ```
