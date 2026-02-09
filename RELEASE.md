# Alexi Release Process

This document describes how to release new versions of Alexi packages.

## Package Structure

Alexi is a monorepo that publishes multiple packages to JSR under the `@alexi`
scope:

- `@alexi/core` - Core framework and management commands
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

Run the version sync script to update all subpackage versions:

```bash
deno task version:sync
```

This will update all `src/*/deno.jsonc` files to match the root version.

### 4. Commit Version Changes

```bash
git add deno.json src/*/deno.jsonc
git commit -m "chore: bump version to 0.7.0"
```

### 5. Push and Create PR

```bash
git push origin feature/my-feature
```

Create a pull request to `main` branch.

### 6. Merge to Main

Once the PR is approved and merged to `main`, the GitHub Actions workflow will
automatically:

1. Detect the version change in `deno.json`
2. Run tests (`deno task test`)
3. Publish all packages to JSR under `@alexi/*` scope
4. Create a summary in the GitHub Actions run

## Manual Publishing (if needed)

If you need to publish manually:

```bash
# Publish a specific package
cd src/db
deno publish

# Or publish all packages
for dir in src/*/; do
  if [ -f "$dir/deno.jsonc" ]; then
    echo "Publishing $dir..."
    (cd "$dir" && deno publish)
  fi
done
```

## Checking Published Versions

Visit JSR to see published packages:

- https://jsr.io/@alexi
- https://jsr.io/@alexi/db
- https://jsr.io/@alexi/core
- etc.

## Pre-release Checklist

Before bumping version and merging:

- [ ] All tests pass (`deno task test`)
- [ ] Code is formatted (`deno task fmt`)
- [ ] Code is linted (`deno task lint`)
- [ ] Type checking passes (`deno task check`)
- [ ] CHANGELOG updated (if you maintain one)
- [ ] Breaking changes documented (if `MAJOR` bump)

## Troubleshooting

### "Package already published"

JSR doesn't allow republishing the same version. If you need to fix something:

1. Increment the patch version (e.g., `0.7.0` → `0.7.1`)
2. Run `deno task version:sync`
3. Commit and push

### "Permission denied" during publish

Make sure:

1. You have write access to the `@alexi` scope on JSR
2. The GitHub Actions workflow has `id-token: write` permission (it does)
3. OIDC is configured for the repository

### Version mismatch between packages

Run `deno task version:sync` to synchronize all package versions.

## Notes

- The root package `@atzufuki/alexi` is NOT published - only subpackages under
  `@alexi/*`
- All packages must be published from their respective directories (`src/*/`)
- The workflow uses `--allow-dirty` flag to publish from CI
- Version changes trigger the workflow only when pushed to `main` branch
