---
name: alexi-release
description: Release new versions of Alexi framework packages to JSR. Use when 
  preparing releases, updating changelogs, bumping versions, and creating git tags.
---

# Alexi Release Skill

Prepare and execute releases for the Alexi framework.

## When to Use

- User wants to release a new version
- User asks to prepare a release
- User wants to update the changelog
- User asks to bump versions

## Release Workflow

1. Review changes since last release
2. Determine version bump (major/minor/patch)
3. Update CHANGELOG.md
4. Bump version in deno.json
5. Sync versions across packages
6. Commit, tag, and push

## Step 1: Review Changes

Get commits since last release:

```bash
# Find last release tag
git describe --tags --abbrev=0

# List commits since last tag
git log $(git describe --tags --abbrev=0)..HEAD --oneline

# Or with more detail
git log $(git describe --tags --abbrev=0)..HEAD --pretty=format:"%h %s"
```

Categorize changes:
- **Breaking Changes** - API changes that break backward compatibility
- **Features** - New functionality
- **Bug Fixes** - Bug fixes
- **Documentation** - Doc updates
- **Other** - Refactoring, chores, etc.

## Step 2: Determine Version Bump

**Semantic Versioning (SemVer):**

| Change Type | Version Bump | Example |
|-------------|--------------|---------|
| Breaking changes | MAJOR | 0.7.0 → 1.0.0 |
| New features (backward compatible) | MINOR | 0.7.0 → 0.8.0 |
| Bug fixes | PATCH | 0.7.0 → 0.7.1 |

For pre-1.0 releases, breaking changes typically bump MINOR.

## Step 3: Update CHANGELOG.md

Create or update `CHANGELOG.md` in the root directory:

```markdown
# Changelog

All notable changes to Alexi are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.8.0] - 2026-02-18

### Added
- PostgreSQL backend support (#67)
- New `selectRelated()` for eager loading

### Changed
- Improved QuerySet performance

### Fixed
- Fixed ForeignKey null handling (#65)

### Breaking Changes
- Removed deprecated `APP_PATHS` configuration

## [0.7.0] - 2026-01-15

### Added
- Initial release
...
```

### Changelog Sections

Use these standard sections (in order):
- `Added` - New features
- `Changed` - Changes to existing functionality
- `Deprecated` - Features to be removed
- `Removed` - Removed features
- `Fixed` - Bug fixes
- `Security` - Security fixes
- `Breaking Changes` - Changes that break backward compatibility

### Guidelines

- Reference issue/PR numbers: `(#67)`
- Be concise but descriptive
- Group related changes
- Put breaking changes prominently

## Step 4: Bump Version

Edit the root `deno.json`:

```bash
# Check current version
jq '.version' deno.json

# Edit deno.json and update version field
```

```json
{
  "name": "@atzufuki/alexi",
  "version": "0.8.0",  // Update this
  ...
}
```

## Step 5: Sync Versions

Run the version sync script to update all subpackages:

```bash
deno task version:sync
```

This updates:
- All `src/*/deno.jsonc` version fields
- All `@alexi/*` imports in each package's `imports` field

Verify the sync:
```bash
git diff --stat
```

## Step 6: Commit, Tag, and Push

```bash
# Stage all changes
git add -A

# Commit with version
git commit -m "chore: release v0.8.0"

# Create tag
git tag v0.8.0

# Push commit and tag
git push origin main
git push origin v0.8.0
```

## Automated Publishing

Once the tag is pushed, GitHub Actions automatically:

1. Runs `deno fmt --check`
2. Runs `deno lint`
3. Runs `deno task test`
4. Publishes all workspace packages to JSR under `@alexi/*`

## Pre-Release Checklist

Before releasing, verify:

```bash
# All checks pass
deno task fmt
deno task lint
deno task check
deno task test

# Version synced
deno task version:sync

# No uncommitted changes
git status
```

Checklist:
- [ ] All tests pass
- [ ] Code is formatted and linted
- [ ] Type checking passes
- [ ] Version synced across packages
- [ ] CHANGELOG.md updated
- [ ] Breaking changes documented (if any)

## Troubleshooting

### "Package already published"

JSR doesn't allow republishing. Increment patch version:

```bash
# Fix deno.json: 0.8.0 → 0.8.1
deno task version:sync
git add -A
git commit -m "chore: release v0.8.1"
git tag v0.8.1
git push origin main v0.8.1
```

### Tag already exists

Delete and recreate:

```bash
git tag -d v0.8.0
git push origin :refs/tags/v0.8.0
git tag v0.8.0
git push origin v0.8.0
```

### Version mismatch

Run `deno task version:sync` to synchronize all packages.

## Package Structure

All packages share the same version number:

- `@alexi/core` - Core framework
- `@alexi/db` - ORM
- `@alexi/urls` - URL routing
- `@alexi/middleware` - Middleware
- `@alexi/restframework` - REST API
- `@alexi/auth` - Authentication
- `@alexi/admin` - Admin panel
- `@alexi/staticfiles` - Static files
- `@alexi/views` - Template views
- `@alexi/web` - Web server
- `@alexi/webui` - Desktop support
- `@alexi/http` - HTTP utilities
- `@alexi/capacitor` - Mobile support
- `@alexi/types` - TypeScript types
- `@alexi/create` - Project scaffolding

## Verify Published Packages

After release, check JSR:
- https://jsr.io/@alexi
- https://jsr.io/@alexi/db
- https://jsr.io/@alexi/core
