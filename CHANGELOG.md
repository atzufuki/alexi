# Changelog

All notable changes to Alexi are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.48.6] - 2026-03-17

### Fixed

- Bundler no longer crashes with `[unreachable] Not an ESM module.` when
  importing binary assets (PNG, JPG, WASM, fonts, etc.) using Deno's
  `with { type: "bytes" }` import attribute; a dedicated `alexi-binary-assets`
  esbuild plugin is now inserted before `denoPlugins()` to intercept binary file
  imports before `@luca/esbuild-deno-loader` can reject them (#403, #404)

## [0.48.5] - 2026-03-17

### Fixed

- Bundler no longer crashes when a module uses Deno's raw-bytes import attribute
  (e.g. `import bytes from "./image.png" with { type: "bytes" }`); binary asset
  extensions are now mapped to esbuild's `"binary"` loader automatically (#401,
  #402)

## [0.48.4] - 2026-03-17

### Fixed

- Bundler no longer produces `__alexi_sw_entry__-<hash>.js` output filenames
  when `entryNames: "[name]-[hash]"` is used with a non-SW entrypoint that has
  templates embedded; `[name]` now correctly resolves to the original source
  filename (#399, #400)

## [0.48.3] - 2026-03-16

### Added

- `WebUIConfig` now accepts an optional
  `profile?: { name: string; path: string }` field to enable persistent browser
  profiles in desktop apps (#396)
  - When set, `WebUILauncher` calls `window.setProfile(name, path)` before
    opening the window, so IndexedDB, localStorage, cookies, etc. survive
    between sessions
  - When omitted, the existing behaviour (WebUI default temporary profile) is
    unchanged

## [0.48.2] - 2026-03-16

### Added

- `AuthenticationMiddleware.configure()` now sets `request.user` to the full ORM
  model instance (Django parity) instead of a plain `AuthenticatedUser` JWT
  payload object (#394, #395)
  - **Server path** (default): instance fetched from DB via
    `userModel.objects.filter({ id }).first()`
  - **Service Worker path**: instance constructed from JWT payload via the new
    optional `fromJWT(payload)` callback — no DB call
  - Without `configure()`: `request.user` remains a plain `AuthenticatedUser`
    (backward compatible)
  - `getRequestUserInstance()` continues to work unchanged
- New `fromJWT` option on `AuthenticationMiddlewareOptions` for the SW path

## [0.48.1] - 2026-03-16

### Fixed

- Removed `declare global { interface Request }` from `@alexi/auth` published
  code — JSR prohibits `declare global` in packages. Projects that need
  `request.user` typed should add the augmentation to their own non-published
  `src/types.d.ts` (see `@alexi/auth` README for the snippet).
- Added `src/auth/test_types.ts` with the `declare global` augmentation for use
  in Alexi's own test suite only (not exported from `mod.ts`).
- Updated JSDoc on `decorators.ts` and `middleware.ts` to document the required
  project-side augmentation pattern.

## [0.48.0] - 2026-03-16

### Added

- `request.user` property on the global `Request` interface — set automatically
  by `AuthenticationMiddleware`, `loginRequired`, and `permissionRequired` in
  `@alexi/auth`, mirroring Django's `request.user` API (#392, #393)
- `decodeToken(token)` in `@alexi/auth` — decodes JWT payload without signature
  verification for use in Service Worker / browser environments where the secret
  key is unavailable (#391)
- `AuthenticatedUser` index signature `[key: string]: unknown` — extra JWT
  claims (e.g. `firstName`, `lastName`) are accessible without casting (#393)

### Changed

- `AuthenticationMiddleware.call()` now sets `request.user = null` for anonymous
  requests (previously left `request.user` undefined) (#393)
- `_resolveUser` in both middleware and decorators now spreads all JWT payload
  claims onto `AuthenticatedUser` so extra fields are forwarded automatically
  (#393)
- `verifyToken()` falls back to `decodeToken()` in Service Worker / browser
  environments when the secret key is unavailable (#391)

## [0.47.0] - 2026-03-16

### Added

- `AuthenticationMiddleware.configure({ userModel })` static factory in
  `@alexi/auth` returns a configured subclass that fetches the full ORM user
  instance from the database on every authenticated request (#389)
- `getRequestUserInstance<T>()` helper retrieves the ORM instance attached by
  `AuthenticationMiddleware.configure()` (#389)
- `UserModelClass` and `AuthenticationMiddlewareOptions` exported interfaces in
  `@alexi/auth` (#389)

## [0.46.2] - 2026-03-16

### Fixed

- Added missing `@alexi/middleware` dependency to `@alexi/auth` package imports,
  fixing JSR publish failure "Module not found middleware/mod.ts"

## [0.46.1] - 2026-03-16

### Fixed

- Removed cross-package re-exports of `BaseMiddleware` and `NextFunction` from
  `@alexi/auth` that caused JSR publish to fail with "Module not found"

## [0.46.0] - 2026-03-16

### Added

- `AuthenticationMiddleware` in `@alexi/auth` automatically resolves JWT tokens
  for every request and populates `getRequestUser()` across the entire request
  lifecycle — not just inside ViewSets (#387)

## [0.45.3] - 2026-03-16

### Fixed

- `ImageField` and `FileField` columns are now correctly created as `TEXT` in
  SQLite tables; previously they were missing from `FIELD_TYPE_MAP`, causing
  `CREATE TABLE` to silently skip the columns and ORM `INSERT`s to fail with
  `table has no column named <field>` (#384)
- `buildColumnDefinition()` in both the migration schema editor and the backend
  schema editor now emits a `console.warn()` for unknown field types instead of
  silently dropping the column (#384)

## [0.45.2] - 2026-03-16

### Fixed

- `autoReverse()` now correctly resolves the SQLite column name for `ForeignKey`
  and `OneToOneField` fields: the actual column is `<fieldName>_id` (e.g.
  `category_id`), not the bare field name. Previously, rolling back an
  `addField` migration for a FK/O2O field would fail with `no such column`
  (#382)

## [0.45.1] - 2026-03-16

### Fixed

- `migrate --test` no longer double-applies non-reversible `DataMigration`s: the
  executor now tracks which migrations were actually rolled back and re-applies
  only those in the forward re-apply phase (#378)
- `migrate --test` data migrations can now use ORM queries reliably — the global
  backend registry is temporarily replaced with the test copy for the duration
  of the test cycle, preventing `no such table` errors (#380)

### Documentation

- Added documentation for snapshot model rules, `DataMigration + --test`
  behavior, ORM queries inside data migrations, and a `no such table`
  troubleshooting section in `docs/db/migrations.md` (#379)

## [0.45.0] - 2026-03-16

### Added

- Migration `backwards()` is now optional — the executor automatically derives
  it by replaying the `forwards()` operation log in reverse, applying the safe
  inverse of each schema operation (`createModel` → `deprecateModel`, `addField`
  → `deprecateField`, `alterField` → restore original column, etc.) (#376)
- New `restoreModel()` and `restoreField()` methods on `MigrationSchemaEditor`
  for explicit rollback of deprecated items (#376)
- `MigrationSchemaEditor.getOperationLog()` and `hasRawSQL()` expose the
  recorded `forwards()` log to the executor (#376)
- `DataMigration` base class for intentionally irreversible migrations; throws
  `IrreversibleMigrationError` if rollback is attempted without an explicit
  `backwards()` override (#376)
- Executor integration tests covering `createModel`, `addField`, `alterField`,
  explicit `backwards()`, and forward → backward → forward re-apply scenarios
  against both DenoKV and SQLite in-memory backends (#377)

### Fixed

- `autoReverse()` for `alterField` no longer collides with the deprecated column
  name created by `forwards()` — it now uses a `_bwd_<field>` temp slot to
  safely swap the columns (#377)

## [0.44.3] - 2026-03-16

### Fixed

- SQLite migration schema editor now correctly escapes double-quote characters
  in identifier names by doubling them, preventing `no such column: ""name""`
  errors when rolling back migrations (#374)

## [0.44.2] - 2026-03-15

### Fixed

- Migration executor now correctly routes SQLite through a dedicated
  `SQLiteMigrationSchemaEditor` — `schema.addColumn()` and other migration
  operations no longer crash with `is not a function` (#372)
- Added `SQLiteMigrationSchemaEditor` implementing the full
  `IBackendSchemaEditor` interface for SQLite (createTable, addColumn,
  dropColumn, renameColumn, renameTable, copyColumnData, createIndex, dropIndex,
  executeRaw, getGeneratedSQL); `alterColumn` throws a descriptive error since
  SQLite does not support it (#372)
- `PostgresBackend` and `DenoKVBackend` now expose `getMigrationSchemaEditor()`
  used by the executor duck-type dispatch (#372)

## [0.44.1] - 2026-03-15

### Added

- PostgreSQL database backend (`@alexi/db/backends/postgres`) with full CRUD,
  bulk operations, transactions, and `partialUpdate`; marked experimental (#339)
- `getWebuiApplication()` factory and desktop app scaffolding via `@alexi/webui`
  and `@alexi/create` (#287)
- `getCapacitorApplication()` factory and mobile app scaffolding via
  `@alexi/capacitor` and `@alexi/create` (#288)
- `loginRequired`, `permissionRequired`, and `getRequestUser` view decorators in
  `@alexi/auth` (#355)
- `createTokenPair` and `verifyToken` JWT utilities in `@alexi/auth` (#353)
- `AdminRouter.asView()` to mount the admin router via `path()` so middleware
  applies correctly (#346)
- `DEFAULT_HOST` and `DEFAULT_PORT` settings in `GetApplicationSettings` (#344)
- `collectstatic` now merges per-app `staticfiles.json` manifests into a single
  output manifest (#343)
- `migrate --test` now runs in an isolated throwaway database copy (#341)
- `migrate <app> zero` support to roll back all migrations for an app (#342)
- `Migration.backwards()` is now abstract; added `IrreversibleMigrationError`
  and `DataMigration` base class (#340)
- `makemigrations` scaffold uses `deprecateModel`/`deprecateField` and
  `restoreModel`/`restoreField` (#349)
- `feat(core): process INSTALLED_APPS in _buildApplication()` (#351)
- `AuthConfig` exported as named export from `@alexi/auth` (#336)
- `@alexi/create` scaffolded posts app upgraded with full dark-theme UI and
  detail/publish/delete views using class-based views (#369)

### Fixed

- Removed circular dependency between `@alexi/core` and `@alexi/staticfiles`:
  `@alexi/staticfiles` now ships its own `RunServerCommand` that subclasses
  core's and shadows it via `INSTALLED_APPS` (#370)
- Fixed `help` command protection bug in `registerCommandsFromModule` — command
  name is now read from an instance instead of the prototype, so the `"help"`
  guard fires correctly

### Removed

- `@alexi/web` package removed; `runserver` now lives in `@alexi/core` (#352)
- `@alexi/http` compatibility shim removed (#330)
- Deprecated `getApplication()` factory removed; use `getHttpApplication()`
  (#347)
- `createMiddleware()` helper removed; use the `MIDDLEWARE` array instead (#348)

## [0.43.1] - 2026-03-15

### Fixed

- `SQLiteSchemaEditor.getRelatedTableName()` now resolves the model class from
  `ModelRegistry` and calls `getTableName()`, so `REFERENCES` clauses in
  generated DDL correctly use `meta.dbTable` instead of the raw lowercased class
  name (e.g. `User` → `"users"` not `"user"`) (#280)

## [0.43.0] - 2026-03-15

### Added

- SQLite database backend (`@alexi/db/backends/sqlite`) using `jsr:@db/sqlite`
  native Deno FFI bindings; supports full CRUD, bulk operations, transactions,
  aggregations, and schema introspection; requires `--unstable-ffi` (#278)

## [0.42.5] - 2026-03-14

### Fixed

- Admin change form now respects `ModelAdmin.readonlyFields`, `fields`, and
  `fieldsets` — previously all editable model fields were validated and saved
  regardless of form configuration, causing HTTP 500 for models with FK audit
  fields not included in the fieldset (#277)

## [0.42.4] - 2026-03-14

### Fixed

- `AdminSite.urls` getter now passes the globally registered default backend to
  `getAdminUrls()`, so projects using `path("admin/", include(adminSite.urls))`
  get real SSR handlers instead of permanent placeholder responses (#278)

## [0.42.3] - 2026-03-14

### Fixed

- `AdminRouter` no longer caches placeholder URL patterns when the database
  backend is not yet available at first request time; patterns are rebuilt on
  the next request once `setup()` has run, preventing a permanent
  `{"message":"Admin placeholder"}` response (#277)

## [0.42.2] - 2026-03-14

### Fixed

- `getAdminUrls()` now returns relative URL patterns instead of absolute ones,
  fixing double-prefix 404 errors when the admin is mounted at a custom
  `urlPrefix` (#276)

## [0.42.1] - 2026-03-14

### Fixed

- Declared missing `@alexi/urls` dependency in `@alexi/middleware` (introduced
  in v0.42.0, causing JSR publish failures for downstream packages) (#273)
- Declared missing `@alexi/middleware` dependency in `@alexi/staticfiles`
  (introduced in v0.42.0, causing JSR publish failures) (#273)
- Removed phantom `@alexi/restframework` dependency from `@alexi/core` (was
  listed in `deno.jsonc` but never imported in production source) (#273)
- Removed phantom `@alexi/middleware` and `@alexi/restframework` dependencies
  from `@alexi/admin` (#273)
- Removed phantom `@alexi/core` and `@alexi/types` dependencies from
  `@alexi/create` (only present in scaffolded code template strings) (#273)

## [0.42.0] - 2026-03-14

### Added

- Class-based middleware interface: `BaseMiddleware` abstract class with
  Django-style constructor-based setup (`getResponse`) and per-request
  `call(request)` method (`@alexi/middleware`) (#270)
- `MiddlewareClass` type for class constructor middleware (#270)
- Concrete middleware classes: `CorsMiddleware`,
  `AllowAllOriginsCorsMiddleware`, `LoggingMiddleware`,
  `ErrorHandlerMiddleware`, `StaticFilesMiddleware` (#270)
- Factory functions `corsMiddleware()`, `loggingMiddleware()`,
  `errorHandlerMiddleware()`, `staticFilesMiddleware()` that return
  `MiddlewareClass` for a one-liner settings experience (#270)
- Django-style admin URL patterns, context helpers, and typed settings
  (`@alexi/admin`, `@alexi/core`) (#271)
- `BaseMiddleware`, `MiddlewareClass`, `Middleware`, `NextFunction`,
  `URLPattern`, `View`, `TemplatesConfig` are now re-exported from `@alexi/core`
  for complete public API coverage (#270)

### Changed

- `Application.use()`, `ApplicationOptions.middleware`, and
  `GetApplicationSettings.MIDDLEWARE` now accept
  `Array<MiddlewareClass | Middleware>`, remaining fully backwards compatible
  with legacy function middleware (#270)

## [0.41.1] - 2026-03-14

### Fixed

- Fixed admin changelist crashing with 500 when `listDisplay` includes a
  `ForeignKey` field whose related model has its own unloaded `ForeignKey`
  fields. `safeGetFieldValue` now returns the related object's `pk` (a
  primitive) instead of the live model instance, preventing cascading
  serialization failures through nested unloaded relations (#265)

## [0.41.0] - 2026-03-13

### Breaking Changes

- Removed all auth/token management from `RestBackend`: `login()`, `logout()`,
  `getMe()`, `register()`, `changePassword()`, `updateMe()` methods and
  `AuthTokens`, `AuthEndpoints`, `LoginCredentials`, `RegisterData`, `AuthUser`,
  `AuthResponse` types are no longer exported from `@alexi/db/backends/rest`.
  Auth is now handled per-endpoint via `ModelEndpoint.getAuthHeaders()` (#263)

### Added

- `ModelEndpoint.getAuthHeaders()` — override on a shared base `ModelEndpoint`
  subclass to inject auth headers (Bearer token, API key, etc.) into every ORM
  and action request for that endpoint (#263)

### Changed

- `RestBackend` is now a pure HTTP transport layer with zero knowledge of tokens
  or auth schemes (#263)
- All ORM operations (`execute`, `insert`, `update`, `partialUpdate`, `delete`,
  `deleteById`, `getById`, `count`, `action`, `callModelAction`) now resolve
  auth headers from the matching `ModelEndpoint` instance (#263)

## [0.40.6] - 2026-03-13

### Fixed

- Fixed `ALEXI_SETTINGS_MODULE` environment variable being ignored at command
  execution time — all commands (`createsuperuser`, `runserver`, `bundle`,
  `collectstatic`, `build`, etc.) now fall back to the env var when no
  `--settings` flag is provided, consistent with the resolution order
  established in v0.40.5 (#260)

## [0.40.5] - 2026-03-13

### Fixed

- Fixed `ALEXI_SETTINGS_MODULE` environment variable being ignored during app
  command discovery — `loadAppCommands()` now falls back to the env var when no
  `--settings` flag is provided, making `help` (and all other commands) show the
  full command list when using the env var instead of the flag (#258)

## [0.40.4] - 2026-03-13

### Fixed

- Fixed `help` command showing "No commands registered" when
  `alexi_management_commands` (or any array containing `HelpCommand`) is passed
  via `config.commands` to `getCliApplication()` — `registerCommand()` and
  `registerCommands()` now skip commands that are already registered, preserving
  the wired-up built-in `HelpCommand` instance (#256)

## [0.40.3] - 2026-03-13

### Fixed

- Fixed `ManagementUtility` `help` subcommand showing "No registered commands"
  when app modules re-export a `HelpCommand` class, overwriting the correctly
  initialised built-in instance (#254)
- Fixed missing `--settings` hint when running a command (e.g.
  `createsuperuser`) without a settings file — the error message now explains
  that a settings file is required and how to provide one (#254)
- Fixed `HelpCommand.showGeneralHelp()` null-registry fallback to show an
  informative message pointing to `getCliApplication()` instead of a bare "No
  registered commands" (#254)

## [0.40.2] - 2026-03-13

### Fixed

- Fixed `selectRelated()` being silently ignored when chaining QuerySet methods
  (`limit()`, `orderBy()`, etc.) due to `_clone()` propagating the fetch cache
  to clones, causing subsequent `fetch()` calls to return immediately without
  loading related objects (#251, #252)
- Fixed `selectRelated()` skipped in `fetch()` cache fast-path even when related
  fields were requested (#251)

## [0.40.0] - 2026-03-12

### Added

- `updateFields` option for `Model.save()` enables partial updates: passing
  `updateFields: ["field1", "field2"]` calls `backend.partialUpdate()` instead
  of a full update, issuing a `PATCH` request on `RestBackend` and a targeted
  field merge on `DenoKVBackend` and `IndexedDBBackend` (#246)

## [0.39.2] - 2026-03-08

### Fixed

- Added `[key: string]: unknown` index signature to `Model` base class so
  concrete model subclasses satisfy `ModelLike`'s structural type check, fixing
  the TypeScript error when using a custom model as `Meta.model` in
  `ModelSerializer` (#242)

## [0.39.1] - 2026-03-08

### Fixed

- Added `[key: string]: unknown` index signature to `FieldOptions<T>` so it is
  structurally compatible with `ModelFieldLike.options`, fixing a TypeScript
  error when extending `ModelSerializer` with a custom `Meta.model` (#242)

## [0.39.0] - 2026-03-07

### Changed

- Expanded package-level `@module` JSDoc across Alexi entrypoints so JSR package
  overviews now describe package purpose, main concepts, starting exports, and
  runtime constraints more clearly for both humans and AI tooling (#240)

### Removed

- Removed deprecated target configuration exports from `@alexi/types`
  (`TargetType`, `TargetConfig`, and related target-specific config interfaces)
  after the move to Django-style settings modules (#240)

## [0.38.2] - 2026-03-07

### Fixed

- Release tooling now regenerates a complete `deno.lock` during version sync by
  caching the additional publish/test entrypoints that bring in release-time
  dependencies like `playwright`, `esbuild`, and `esbuild-deno-loader`. This
  fixes incomplete lockfiles in tagged releases and unblocks JSR publishing for
  packages that depend on those modules during CI release validation.

## [0.38.1] - 2026-03-07

### Fixed

- `@alexi/core/management`: custom CLI tools built on the management package no
  longer inherit Alexi-branded help output or framework commands by default.
  `ManagementUtility` now behaves as a neutral CLI runner, framework commands
  are opt-in via explicit registration, and the new `getCliApplication()` API
  provides a clear high-level entry point for both user CLIs and Alexi's own
  `manage.ts` scaffold (#232, #233)

## [0.38.0] - 2026-03-06

### Added

- `@alexi/views`: Class-based views (CBVs) mirroring Django's
  `django.views.generic` — `View`, `TemplateView`, `RedirectView`, `ListView`,
  `DetailView`, and the composable mixins `ContextMixin`,
  `TemplateResponseMixin`, `SingleObjectMixin`, `MultipleObjectMixin`. All
  classes are exported from `@alexi/views` and return a plain
  `(request, params) => Promise<Response>` handler via `as_view()`, fully
  compatible with `path()` (#230)

## [0.37.5] - 2026-03-04

### Fixed

- `@alexi/admin`: `AdminRouter` now builds its URL patterns lazily on the first
  request instead of eagerly in the constructor. When `ROOT_URLCONF` is imported
  during `runserver` startup the constructor runs before `configureSettings()` /
  `setup()` have been called, so the old eager implementation always captured
  `undefined` for both backend and settings and permanently registered
  placeholder JSON handlers. The lazy approach (Django-style: build once on
  first access, then cache) ensures patterns are created only after the global
  backend registry is fully populated, fixing JSON responses on all admin routes
  in the standard development workflow (#228)

## [0.37.4] - 2026-03-04

### Fixed

- `@alexi/admin`: `AdminRouter` now automatically resolves the global settings
  object from `@alexi/core` when no explicit `settings` argument is given,
  mirroring how `backend` is already resolved via `getBackend()`. Previously,
  `AUTH_USER_MODEL` was missing at login time even when `configureSettings()`
  had been called at startup (#226)

## [0.37.3] - 2026-03-04

### Fixed

- `@alexi/core`: `runserver` and other app commands from JSR-published packages
  were silently not discovered because `loadCommandsFromImportFn` only handled
  `file://` URL prefixes for `appPath`. When a package is loaded from JSR,
  `import.meta.url` is an `https://` URL, so `appPath` starts with `https://`
  and fell through to the relative-path branch, producing an invalid local path.
  Now `https://` and `http://` prefixes are handled correctly (#224)

## [0.37.2] - 2026-03-04

### Removed

- `AppConfig` now only contains identity metadata (`name`, `verboseName`,
  `appPath`), mirroring Django's `AppConfig`. All deprecated fields
  (`staticDir`, `templatesDir`, `commandsModule`, `urlsModule`, `modelsModule`,
  `bundle`, `staticfiles`, `desktop`) have been removed (#222)
- Removed `BundleConfig`, `StaticfileConfig`, `DesktopConfig`, `DesktopSettings`
  types from `@alexi/types`
- Framework internals updated to convention-based discovery:
  `<appPath>/commands/mod.ts`, `<appPath>/static/`, `<appPath>/templates/`

## [0.37.1] - 2026-03-04

### Fixed

- `@alexi/staticfiles`: `esbuild` and `esbuild-deno-loader` are now imported
  lazily (inside `buildSWBundle()`) instead of at the top level of `bundle.ts`.
  This prevents these server-only modules from being statically included in
  browser/worker bundles, resolving build errors such as
  `Top-level await is not available` and `Could not resolve "pnpapi"` that
  appeared when bundling projects after v0.37.0 (#220)

## [0.37.0] - 2026-03-04

### Added

- `@alexi/staticfiles`: Content-hash cache busting via esbuild's native
  `entryNames` option. Set `options: { entryNames: "[name]-[hash]" }` on a
  non-worker entry in `ASSETFILES_DIRS` to produce hashed output filenames (e.g.
  `document-a1b2c3d4.js`), write a `staticfiles.json` manifest, and rewrite HTML
  references automatically. `AppDirectoriesFinder.find()` resolves logical names
  to hashed filenames transparently at request time. Service Worker entries
  (`*worker*.js`, `sw.js`) always use `[name]` regardless of the option, keeping
  SW registration URLs stable across deploys. Apps scaffolded with
  `startapp --type browser` get `entryNames: "[name]-[hash]"` on the frontend
  entry by default (#218)

## [0.36.2] - 2026-03-04

### Fixed

- `@alexi/db`: `RestBackend.count()` now forwards filters as query parameters
  (e.g. `GET /farms/count/?owner_id=1`). Previously filters were ignored,
  causing `count()` and `RelatedManager.exists()` to always return the total
  object count instead of the filtered subset (#216)

## [0.36.1] - 2026-03-04

### Fixed

- `@alexi/restframework`: `DefaultRouter` now registers `detail=False` custom
  `@action` routes before the `/:id/` pattern, preventing shadowing. Previously
  `GET /farms/count/` would match `farms/:id/` with `id="count"` and call
  `retrieve()` instead of the custom action (#214)

## [0.36.0] - 2026-03-04

### Added

- `@alexi/core`: `getHttpApplication()` — server-side application factory,
  Django's `get_wsgi_application()` equivalent; reads settings from the global
  `conf` proxy (configured via `--settings` CLI flag), no parameters needed
  (#213)
- `@alexi/core`: `getWorkerApplication(settings)` — Service Worker application
  factory; accepts a settings object directly since there is no `--settings`
  flag in the browser context (#213)

### Changed

- `@alexi/web`: `runserver` now calls `configureSettings()` before
  `getHttpApplication()` so the `conf` proxy is always populated at request
  time, fixing `Error: Alexi settings are not configured` (#212, #213)
- Scaffolded `http.ts` no longer imports a settings module directly — uses
  `getHttpApplication()` instead (#213)
- Scaffolded `worker.ts` uses `getWorkerApplication(settings)` instead of the
  generic `getApplication(settings)` (#213)

### Deprecated

- `getApplication(settings)` — use `getHttpApplication()` for server-side code
  or `getWorkerApplication(settings)` for Service Workers (#213)

## [0.35.0] - 2026-03-04

### Added

- `@alexi/core`: global settings registry (`conf`) — a lazy proxy equivalent to
  Django's `django.conf.settings`; access any setting via `conf.MY_SETTING`
  after `getApplication()` has been called; `configureSettings(settings)`,
  `resetSettings()`, and `isSettingsConfigured()` helpers are also exported from
  `@alexi/core` (#210)

### Fixed

- `@alexi/admin`: `AdminRouter` now falls back to the globally registered
  default backend (via `getBackend("default")`) when no explicit `backend`
  argument is provided — resolves authentication failures that occurred when
  different settings files were used in the same process (#210)

## [0.34.0] - 2026-03-04

### Added

- `@alexi/auth`: `AbstractUser` base model with standard Django-style fields
  (`id`, `email`, `password`, `firstName`, `lastName`, `isAdmin`, `isActive`,
  `dateJoined`, `lastLogin`), `static hashPassword(plain): Promise<string>`, and
  `verifyPassword(plain): Promise<boolean>` instance method — hashing uses
  PBKDF2-SHA256 via the Web Crypto API (works in Deno and browser/Service
  Worker, no native dependencies); stored format:
  `pbkdf2_sha256$600000$<salt_b64>$<hash_b64>` (#208)
- `@alexi/auth`: `AUTH_USER_MODEL` now accepts a model class directly (e.g.
  `export const AUTH_USER_MODEL = UserModel`) in addition to the legacy file
  path string — passing the class avoids a dynamic import and is the recommended
  pattern going forward; the legacy string path remains fully supported for
  backwards compatibility (#208)
- `@alexi/admin`: admin login now calls `user.verifyPassword(password)` as an
  instance method when `AUTH_USER_MODEL` is a class, keeping the password
  hashing logic co-located with the model (#208)
- `@alexi/core/management`: `createsuperuser` now calls
  `UserModel.hashPassword(password)` as a static method when `AUTH_USER_MODEL`
  is a class; field name updated from `passwordHash` to `password` to match
  Django convention (#208)

## [0.33.0] - 2026-03-04

### Added

- `@alexi/db`: `DenoKVConfig` now accepts a `url` field for connecting to a
  remote Deno Deploy KV database — `Deno.openKv(url)` is called when `url` is
  set, and `DENO_KV_ACCESS_TOKEN` is picked up automatically by the Deno
  runtime; `url` takes precedence over `path` when both are provided (#206)
- `@alexi/create`: `startproject` now scaffolds `project/production.ts`
  alongside `project/settings.ts` — the file sets `DEBUG = false`, requires
  `SECRET_KEY` from the environment (no dev fallback), and configures
  `DATABASES` using `url: Deno.env.get("DENO_KV_URL")`; intended for use with
  `--env-file .env.production.local` to run management commands (e.g.
  `createsuperuser`) against a production Deno Deploy KV locally (#206)

## [0.32.4] - 2026-03-03

### Fixed

- `@alexi/core/management`: `migrate`, `showmigrations`, and `sqlmigrate`
  commands now call `configure()` before accessing the ORM — previously they
  failed with "Alexi ORM is not configured" because no database setup was
  performed before `getBackend()` was called; all three commands now accept a
  `--settings` argument (#111, #204)
- `@alexi/db`: `MigrationLoader` Windows path bug — `file://${realPath}`
  produced an invalid `file://C:\...` URL on Windows; backslashes are now
  normalised to forward slashes and the URL is correctly formed as
  `file:///C:/...`; path separators in `appLabel` derivation are also normalised
  (#110, #205)
- `@alexi/db`: `DenoKVBackend.getSchemaEditor()` returned the legacy
  `DenoKVSchemaEditor` which was missing `addColumn()` and other
  `IBackendSchemaEditor` methods; it now returns `DenoKVMigrationSchemaEditor`
  which fully implements the interface (#112, #205)

## [0.32.3] - 2026-03-03

### Fixed

- `@alexi/core/management`: `migrate`, `makemigrations`, `showmigrations`, and
  `sqlmigrate` commands are now registered as built-ins in `ManagementUtility` —
  they were never available because `loadCommandsFromImportFn` exited early when
  `commandsModule` was absent, and `src/db/commands/mod.ts` was empty; the
  orphaned `src/db/commands/` directory has been removed (#202)

## [0.32.2] - 2026-03-03

### Fixed

- `@alexi/db`: `Model.save()`, `Model.delete()`, and `Model.refresh()` now work
  in Service Worker contexts — the unnecessary `dynamic import()` in
  `_resolveBackend` (which is disallowed in `ServiceWorkerGlobalScope`) has been
  replaced with a static import, consistent with how `QuerySet` and `Manager`
  already import `setup.ts`; `ForeignKey.fetch()` received the same fix (#200)

## [0.32.1] - 2026-03-02

### Fixed

- `@alexi/core/management`: extracted shared `resolveSettingsPath` and
  `toImportUrl` utilities into `settings_utils.ts`, exported from
  `@alexi/core/management` — eliminates duplicated logic across commands (#198)
- `@alexi/auth`: fixed `createsuperuser` command not accepting `--settings` with
  a file path (e.g. `--settings=./project/settings.ts`) — the old implementation
  hardcoded a path template causing double-path construction and a double
  `.settings.ts` extension (#198)
- `@alexi/staticfiles`: fixed cosmetic log message in `collectstatic` that
  always appended `.settings.ts` to the settings argument regardless of input
  format (#198)

## [0.32.0] - 2026-03-02

### Added

- `@alexi/views`: Django-style `TEMPLATES` setting — configure template
  directories via `TEMPLATES: [{ BACKEND: "alexi", DIRS: [...] }]` in settings;
  `runserver` auto-registers templates at startup and `bundle` embeds them in SW
  bundles (#195)

### Fixed

- `@alexi/create`: scaffolded projects now use a shared `templates/<name>/`
  directory for all HTML templates, served by the server directly via
  `templateView` — eliminates the broken SPA shell redirect loop (#196)
- `@alexi/create`: removed the static `index.html` SPA shell that caused
  infinite redirect loops on first load (#196)
- `@alexi/create`: Service Worker is now a progressive enhancement
  (fire-and-forget registration in `base.html`) instead of a required bootstrap
  step (#196)

## [0.31.0] - 2026-03-02

### Added

- `@alexi/create`: scaffolded projects now include a fully functional Posts UI
  (list + create form) powered by Service Worker + HTMX and the REST backend
  instead of just a welcome page (#190, #193)
- `@alexi/create`: `post_list.html` and `post_form.html` templates with
  HTMX-powered navigation and form submission
- `@alexi/create`: `http.ts` entry point moved to `project/http.ts` to keep the
  project root tidy (#190, #193)

### Changed

- `@alexi/staticfiles`: `AppConfig` fields `staticfiles`, `staticDir`, and
  `templatesDir` replaced with `ASSETFILES_DIRS` and `STATICFILES_DIRS`
  settings-level configuration (#192)

## [0.30.0] - 2026-03-02

### Added

- `@alexi/core`: isomorphic `getApplication()` factory — Django-style entry
  point that initialises databases, resolves URL patterns, builds the middleware
  chain, and returns a ready-to-use `Application` instance. Works in both Deno
  server and Service Worker contexts (#188, #189)
- `@alexi/core`: `Application` class with `handler()` method for request
  dispatch
- `@alexi/create`: scaffolded projects now include `http.ts` — a production
  server entrypoint for `deno serve` and Deno Deploy (#188, #189)
- `@alexi/create`: Playwright-based E2E browser tests for scaffolded projects,
  covering static file serving, Service Worker lifecycle, and HTMX content
  rendering

### Fixed

- `@alexi/create`: scaffolded browser worker's `mod.ts` now re-exports `default`
  from `app.ts`, fixing SW app config resolution
- `@alexi/create`: Service Worker registration now uses `{ type: "module" }` to
  match the ES module output from the bundler
- `@alexi/create`: worker settings use static imports instead of dynamic
  `import()` which is disallowed in Service Workers per HTML spec
- `@alexi/create`: SPA shell `render()` guards against `htmx` not yet loaded
  when the deferred script hasn't executed
- `@alexi/create`: `homeView` is now wired to the root route (`""`) in
  scaffolded worker URL patterns
- `@alexi/core`: `setup.ts` uses static import of `@alexi/db` instead of dynamic
  `import()` for Service Worker compatibility
- `@alexi/web`: `runserver` now auto-injects `staticFilesMiddleware` by scanning
  installed apps for static file directories
- `@alexi/types`: added `appPath` to `AppConfig` interface for explicit app
  directory resolution

## [0.29.2] - 2026-03-01

### Fixed

- `@alexi/create`: `deno run -A jsr:@alexi/create` no longer crashes with "Must
  be a file URL" — version is now embedded as a constant instead of reading
  `deno.jsonc` at runtime (#184, #185)

## [0.29.1] - 2026-03-01

### Fixed

- `@alexi/create`: scaffolded projects now use the correct `@alexi/*` version in
  `deno.jsonc` instead of hardcoded `@^0.18` (#182, #183)
- `@alexi/create`: added missing `@alexi/core/management` subpath to generated
  import map (#183)
- `@alexi/create`: CLI `--version` flag now reads version dynamically from
  `deno.jsonc` instead of hardcoded `0.15.0` (#183)
- `@alexi/restframework`: `@action` decorator rewritten to use TC39 stage 3
  decorators (Deno 2.x default) — custom ViewSet actions like `publish` were
  silently not registered with `DefaultRouter`, causing 404s (#183)

### Changed

- `@alexi/create`: merged `project/settings.ts` and `project/web.settings.ts`
  into a single `project/settings.ts`; deno tasks now use
  `--settings ./project/settings.ts` (#183)

## [0.29.0] - 2026-03-01

### Changed

- `startapp` command now generates a single unified app structure for all
  platforms — no more `--type` flag or separate
  server/desktop/browser/cli/library templates. Every app gets both a server
  module and a browser worker module following Django conventions (#180, #181)
- Example app replaced: Todo (Board + Todo models) → Posts (single PostModel
  with title, content, published flag) inspired by the Django tutorial
- Scaffold README rewritten for the unified architecture

### Removed

- `startapp` app types (`server`, `desktop`, `mobile`, `cli`, `library`,
  `browser`) — replaced by a single unified structure
- `AppTypeCommand` class — `startapp` is now a single `StartappCommand`
- Desktop (`WebUI`) and UI (SPA) app templates removed from scaffold
- Old Todo example app templates (BoardModel, TodoModel, SPA components)

## [0.28.0] - 2026-03-01

### Added

- `browser` app type for `startapp` command: scaffolds a browser app with two
  separate entry points — `worker.ts` (Service Worker context) and `document.ts`
  (DOM context) — using `staticfiles[]` in `AppConfig` (#179)
- `StaticfileConfig` interface in `@alexi/types` for declaring multiple bundle
  entry points per app
- `staticfiles?: StaticfileConfig[]` property on `AppConfig`

### Changed

- `startapp` command `web` type renamed to `server`
- `bundle` command updated to handle `staticfiles[]` in `AppConfig`

### Removed

- `startapp` app types `sw` and `ui` removed; use `browser` type instead

## [0.27.0] - 2026-03-01

### Added

- `setup()` function exported from `@alexi/core` for universal framework
  initialization (works in both server and browser contexts)
- `@alexi/core/management` sub-path export for all server-only code:
  `Application`, `BaseCommand`, `ManagementUtility`, `failure`, `success`,
  `CommandOptions`, `CommandResult`, `IArgumentParser`, `MakemigrationsCommand`,
  `MigrateCommand`, and all other management utilities

### Changed

- `DATABASES` config key replaces the old `DATABASE` key in settings and
  `setup()` call — allows multiple named backends

### Breaking Changes

- `Application`, `BaseCommand`, `ManagementUtility`, `failure`, `success`, and
  all other server-only exports have been moved from `@alexi/core` to
  `@alexi/core/management`. Update imports:
  ```typescript
  // Before
  import { Application, BaseCommand, ManagementUtility } from "@alexi/core";
  // After
  import {
    Application,
    BaseCommand,
    ManagementUtility,
  } from "@alexi/core/management";
  ```
- `@alexi/core` now only exports `setup` and `DatabasesConfig`
- `DATABASE` renamed to `DATABASES` in settings and `setup()` options:
  ```typescript
  // Before
  await setup({ DATABASE: backend });
  // After
  await setup({ DATABASES: { default: backend } });
  ```

## [0.26.4] - 2026-02-28

### Fixed

- SW bundle no longer fails in scaffolded projects because `buildSWBundle` now
  auto-detects `deno.jsonc` (generated by `alexi startproject`) vs `deno.json`
  when no explicit `configPath` is provided; previously it always defaulted to
  `deno.json`, causing `esbuild-deno-loader` to error with "No such file or
  directory" and all 16 Playwright e2e browser tests to fail with a MIME-type
  error on `bundle.js` (#175)

## [0.26.3] - 2026-02-28

### Fixed

- SW bundle Windows fix was incomplete in v0.26.2; the virtual entry re-export
  now uses an absolute `file://` URL (via `toFileUrl()`) instead of a relative
  path, so `deno-resolver` resolves imports correctly on all platforms
  regardless of the virtual entry's namespace or importer value (#172)

## [0.26.2] - 2026-02-28

### Fixed

- SW bundle no longer fails on Windows with "Relative import path not prefixed"
  when templates are embedded; the virtual entry esbuild plugin now uses a
  filename-only path instead of an absolute Windows path, which was causing
  `@luca/esbuild-deno-loader` to construct an invalid namespace URL (#172)

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
