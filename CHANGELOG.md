# Changelog

All notable changes to Alexi are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.26.1] - 2026-02-28

### Fixed

- `BundleCommand` now loads only the active settings file when `--settings` is
  provided (or when called from `runserver`), preventing apps from unrelated
  settings files from bleeding into the wrong bundle context (#169)
- Virtual entry esbuild plugin now uses a normalised `resolveDir` path on
  Windows, fixing import resolution failures when bundling Service Workers
  (#170)

## [0.26.0] - 2026-02-28

### Added

- Django-style template engine with template inheritance (`{% extends %}`),
  blocks (`{% block %}`), loops (`{% for %}`), conditionals (`{% if %}`),
  includes (`{% include %}`), and comments (`{# #}`) in `@alexi/views` (#163)
- `templateView` new API with `templateName` and async `context` function using
  the global `templateRegistry` (#163)
- `AppConfig.templatesDir` — templates are auto-loaded at `runserver` startup
  and embedded into SW bundles by `bundle` (#164)
- HTML templates are now embedded into Service Worker bundles as a virtual
  esbuild module (`alexi:templates`) for offline-first MPA support (#164)
- `sw` app type for `startapp` command — scaffolds an offline-first MPA with
  Service Worker architecture (#165)

## [0.25.6] - 2026-02-28

### Fixed

- `ForeignKey` and `ManyToManyField` now lazily resolve string-ref model names
  via the model registry, so instances created after initial setup correctly
  resolve their related models without requiring a full re-import (#161)

## [0.25.5] - 2026-02-28

### Fixed

- Admin change form no longer crashes with "Related object not fetched" error
  when viewing/editing a model instance that has `ForeignKey` fields —
  `fetchInstance` now uses `ForeignKey.id` (raw id, always available) instead of
  `.get()` which throws if the related object has not been loaded (#159)

## [0.25.4] - 2026-02-28

### Fixed

- Admin change form no longer returns 404 when navigating from the changelist —
  `fetchInstance` and `saveInstance` now resolve the primary key field name
  dynamically instead of hardcoding `id` (#156)
- Admin changelist now always renders row links when `listDisplay` is not
  explicitly configured — falls back to the first auto-derived column (#156)
- Admin `fetchInstance` now logs ORM errors via `console.error` instead of
  silently swallowing them, making debugging easier (#156)
- Admin `urlPrefix` is normalised consistently (leading `/`, no trailing `/`)
  across all admin view files (#156)

### Added

- Playwright E2E test suite for the admin panel covering login page, dashboard,
  changelist, change form navigation, save, and add form (#157)

## [0.25.3] - 2026-02-28

### Added

- Admin dark mode with system preference detection and manual toggle (cycles:
  auto → dark → light) with `localStorage` persistence (#152)
- Admin CSS classes for dashboard, changelist and changeform views (#152)

### Fixed

- Admin JWT login race condition — token is now stored via `X-Admin-Token`
  response header before HTMX navigation occurs; also sets `adminToken` cookie
  so page refreshes work without relying on HTMX header injection (#150)
- Admin auth guard now falls back to `adminToken` cookie when `Authorization`
  header is absent, enabling direct page loads and refreshes to be authenticated
  (#150)
- Admin login form layout uses vertical stack (#152)
- Admin header text uses `text-inverse` color in dark mode for readability
  (#152)
- Admin theme toggle icon updated correctly via JS on theme change (#152)

### Changed

- Admin UI spacing, button colors, filter sidebar and table alignment polished
  (#152)

## [0.25.2] - 2026-02-28

### Fixed

- Admin static files (`/admin/static/css/admin.css`,
  `/admin/static/js/admin.js`) now load correctly when `@alexi/admin` is
  installed from JSR — `createStaticHandler` now uses `fetch()` instead of
  `Deno.readTextFile()`, which only supports `file://` URLs (#148)

## [0.25.1] - 2026-02-28

### Fixed

- `collectstatic` now correctly resolves `staticDir` values that are `file://`
  URLs (e.g. `new URL("./static/", import.meta.url).href`), enabling published
  JSR packages to declare their own static directories (#146)

### Changed

- `@alexi/admin` now uses `import.meta.url`-based `staticDir` so its static
  files are found correctly when installed from JSR

### Added

- Documented the `import.meta.url` pattern for `staticDir` in published packages
  (`docs/staticfiles/staticfiles.md`)

## [0.25.0] - 2026-02-28

### Added

- Admin panel rewritten as a server-side rendered MPA with HTMX — replaces the
  previous SPA architecture (#124–#133)
- Admin: login/logout views with JWT authentication and `localStorage` token
  storage (#126, #136)
- Admin: dashboard view with JWT auth guard (#127, #137)
- Admin: change list view with search, pagination, filters, and bulk actions
  (#128, #138)
- Admin: change form view (add/edit) with server-side validation (#129)
- Admin: delete confirmation view (#130)
- Admin: `ModelAdmin` search, filter, ordering, pagination, `deleteSelected`,
  and `validateForm` (#131)
- Admin: static file serving for `admin.css` and `admin.js` (#124)
- Admin: HTTP integration tests covering all views (#133)
- `.gitattributes` to enforce LF line endings on all platforms

### Removed

- Admin: SPA code removed — `app/`, `components/`, `public/`, `styles/`,
  `spa_urls_test` deleted (#132)

### Documentation

- Rewrote `docs/admin/admin.md` for the MPA/HTMX architecture; fixed incorrect
  option names, added `AdminRouter` API docs, URL routes table, and JWT auth
  flow (#145)
- Updated `AGENTS.md` admin section and import references

## [0.24.6] - 2026-02-27

### Fixed

- Fixed `ForeignKey.get()` throwing when FK value is `null` instead of returning
  `null`; previously `_isLoaded` stayed `false` for null FKs (e.g. after
  `selectRelated()` skips them), causing an unexpected error (#122)

## [0.24.5] - 2026-02-27

### Fixed

- Fixed `selectRelated()` still failing after #118 — `relatedMap` was built with
  number keys (from `AutoField.fromDB()`) but looked up with string FK IDs (raw
  value stored after REST→IndexedDB sync); normalized all keys to `String()`
  (#120)

## [0.24.4] - 2026-02-27

### Fixed

- Fixed `selectRelated()` silently failing on IndexedDB backend due to
  number/string type mismatch in `in` lookup — IndexedDB stores IDs as strings
  while `selectRelated()` collects FK IDs as numbers (#118)

## [0.24.3] - 2026-02-25

### Fixed

- `Model._initializeFields()` no longer overwrites field values that were
  explicitly set before lazy initialization runs (#108, #109)

## [0.24.2] - 2026-02-23

### Fixed

- `ModelSerializer.buildField()` now forwards `blank=true` as `allowBlank: true`
  on serializer `CharField` and `UUIDField`, so validation correctly allows
  empty strings when the model field has `blank: true` (#106)

## [0.24.1] - 2026-02-23

### Fixed

- Fixed `InvalidStateError` in `IndexedDBBackend` when multiple model queries
  are fired concurrently on first page load. `ensureStore` calls are now
  serialized through a promise queue, and callers wait for any in-flight upgrade
  to settle before using the database connection (#104, #105)

## [0.22.0] - 2026-02-18

### Added

- PostgreSQL database backend with full ORM support (#67, #68)
  - Parameterized SQL query builder for QuerySet translation
  - Connection pooling via `npm:pg`
  - Transaction support
  - SchemaEditor for DDL operations
  - Support for DATABASE_URL and individual connection parameters
  - Compatible with Deno Deploy managed PostgreSQL
- Pre-commit hook now checks entire project formatting
- Agent skills for development workflow (alexi-implement, alexi-release,
  alexi-spec)

### Changed

- Updated pre-commit hook to block commits when any file needs formatting

## [0.21.0] - Previous Release

See git history for previous changes.
