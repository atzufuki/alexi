# Alexi Release Process

This document describes how to release new versions of Alexi packages.

## Package Structure

Alexi is a monorepo that publishes multiple packages to JSR under the `@alexi`
scope:

- `@alexi/core` - Universal setup (`setup`, `DatabasesConfig`)
- `@alexi/core` (management) - Management commands and CLI framework
  (`@alexi/core/management`)
- `@alexi/db` - ORM with DenoKV and IndexedDB backends
- `@alexi/urls` - URL routing
- `@alexi/middleware` - Middleware system
- `@alexi/restframework` - REST API framework
- `@alexi/auth` - Authentication (JWT)
- `@alexi/admin` - Admin panel
- `@alexi/staticfiles` - Static file handling
- `@alexi/views` - Template views
- `@alexi/web` - Web server
- `@alexi/webui` - Desktop app support (WebUI)
- `@alexi/http` - HTTP utilities
- `@alexi/capacitor` - Mobile app support
- `@alexi/types` - Shared TypeScript types
- `@alexi/create` - Project scaffolding

## Versioning Strategy

All packages share the **same version number** (synchronized versioning). This
simplifies dependency management and ensures compatibility across the framework.

**Version format:** Semantic Versioning (`MAJOR.MINOR.PATCH`)

- `MAJOR` - Breaking changes
- `MINOR` - New features (backward compatible)
- `PATCH` - Bug fixes

## Release Steps

### 1. Make Your Changes

Create a feature branch and make your changes:

```bash
git checkout -b feature/my-feature
# Make changes...
git commit -m "feat: add new feature"
```

### 2. Update Version

Edit the root `deno.json` file and bump the version:

```json
{
  "name": "@atzufuki/alexi",
  "version": "0.7.0",  // ← Update this
  ...
}
```

### 3. Sync Versions Across Packages

Run the version sync script to update all subpackage versions and their
`@alexi/*` import dependencies:

```bash
deno task version:sync
```

This will update:

- All `src/*/deno.jsonc` version fields
- All `@alexi/*` imports in each package's `imports` field

### 4. Commit Version Changes

```bash
git add -A
git commit -m "chore: bump version to 0.7.0"
```

### 5. Create and Push Tag

Create a version tag and push it to trigger the release:

```bash
git tag v0.7.0
git push origin main
git push origin v0.7.0
```

### 6. Automatic Publishing

Once the tag is pushed, the GitHub Actions workflow will automatically:

1. Checkout the tagged commit
2. Run formatting check (`deno fmt --check`)
3. Run linter (`deno lint`)
4. Run tests (`deno task test`)
5. Publish all workspace packages to JSR under `@alexi/*` scope
6. Create a summary in the GitHub Actions run

## Quick Release (TL;DR)

```bash
# 1. Update version in deno.json
# 2. Sync all packages
deno task version:sync

# 3. Commit, tag, and push
git add -A
git commit -m "chore: bump version to 0.7.0"
git tag v0.7.0
git push origin main
git push origin v0.7.0
```

## Manual Publishing (if needed)

If you need to publish manually:

```bash
# Publish a specific package
cd src/db
deno publish

# Or publish all workspace packages
for dir in $(jq -r '.workspace[]' deno.json); do
  echo "Publishing $dir..."
  (cd "$dir" && deno publish)
done
```

## Checking Published Versions

Visit JSR to see published packages:

- https://jsr.io/@alexi
- https://jsr.io/@alexi/db
- https://jsr.io/@alexi/core
- etc.

## Pre-release Checklist

Before creating a release tag:

- [ ] All tests pass (`deno task test`)
- [ ] Code is formatted (`deno task fmt`)
- [ ] Code is linted (`deno task lint`)
- [ ] Type checking passes (`deno task check`)
- [ ] Version synced (`deno task version:sync`)
- [ ] CHANGELOG updated (if you maintain one)
- [ ] Breaking changes documented (if `MAJOR` bump)

## Troubleshooting

### "Package already published"

JSR doesn't allow republishing the same version. If you need to fix something:

1. Increment the patch version (e.g., `0.7.0` → `0.7.1`)
2. Run `deno task version:sync`
3. Commit, tag with new version, and push

### "Permission denied" during publish

Make sure:

1. You have write access to the `@alexi` scope on JSR
2. The GitHub Actions workflow has `id-token: write` permission (it does)
3. OIDC is configured for the repository

### Version mismatch between packages

Run `deno task version:sync` to synchronize all package versions and imports.

### Tag already exists

If you need to re-tag (e.g., after fixing something):

```bash
# Delete local and remote tag
git tag -d v0.7.0
git push origin :refs/tags/v0.7.0

# Create new tag and push
git tag v0.7.0
git push origin v0.7.0
```

## Workspace Configuration

The monorepo uses Deno's workspace feature. The root `deno.json` defines:

```json
{
  "workspace": [
    "./src/types",
    "./src/urls",
    "./src/middleware",
    ...
  ]
}
```

This allows packages to reference each other using JSR specifiers
(`jsr:@alexi/db@0.7.0`) while Deno resolves them locally during development.

## Notes

- The root package `@atzufuki/alexi` is NOT published - only subpackages under
  `@alexi/*`
- All packages must be published from their respective directories (`src/*/`)
- The workflow uses `--allow-dirty` flag to publish from CI
- Only tags matching `v*` pattern trigger the publish workflow
- The `@alexi/admin` package is currently excluded from workspace due to
  html-props compatibility issues
