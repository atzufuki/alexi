# Changelog

All notable changes to Alexi are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
