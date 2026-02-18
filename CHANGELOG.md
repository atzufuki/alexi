# Changelog

All notable changes to Alexi are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
