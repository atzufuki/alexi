/**
 * SQLite Backend Types
 *
 * Type definitions for the SQLite database backend.
 *
 * @module
 */

import type { DatabaseConfig } from "../backend.ts";

/**
 * SQLite-specific configuration.
 *
 * SQLite is a file-based, zero-config SQL database ideal for local
 * development, CI, single-file deployments and embedded use cases.
 *
 * @example
 * ```ts
 * // File-based database
 * const backend = new SQLiteBackend({ path: "./data/app.db" });
 *
 * // In-memory database (useful for tests)
 * const backend = new SQLiteBackend({ path: ":memory:" });
 * ```
 */
export interface SQLiteConfig extends Omit<DatabaseConfig, "engine" | "name"> {
  /**
   * Backend engine identifier.
   *
   * Defaults to `"sqlite"` when omitted.
   *
   * @default "sqlite"
   */
  engine?: "sqlite";

  /**
   * Logical database name (defaults to the `path` value when omitted).
   */
  name?: string;

  /**
   * File system path to the SQLite database file.
   *
   * Use `":memory:"` for an in-memory database (data is lost on disconnect).
   * Defaults to `":memory:"` when not provided.
   *
   * @default ":memory:"
   */
  path?: string;

  /**
   * Enable verbose console logging of all SQL statements and parameters.
   *
   * @default false
   */
  debug?: boolean;
}

/**
 * Map Alexi field types to SQLite column type affinities.
 *
 * SQLite uses a dynamic type system with five storage classes:
 * NULL, INTEGER, REAL, TEXT, BLOB. These affinities guide type coercion.
 */
export const FIELD_TYPE_MAP: Record<string, string> = {
  AutoField: "INTEGER PRIMARY KEY AUTOINCREMENT",
  BigAutoField: "INTEGER PRIMARY KEY AUTOINCREMENT",
  CharField: "TEXT",
  TextField: "TEXT",
  IntegerField: "INTEGER",
  BigIntegerField: "INTEGER",
  SmallIntegerField: "INTEGER",
  PositiveIntegerField: "INTEGER CHECK ({column} >= 0)",
  PositiveBigIntegerField: "INTEGER CHECK ({column} >= 0)",
  PositiveSmallIntegerField: "INTEGER CHECK ({column} >= 0)",
  FloatField: "REAL",
  DecimalField: "TEXT", // stored as string to preserve precision
  BooleanField: "INTEGER", // 0 = false, 1 = true
  DateField: "TEXT", // ISO 8601: YYYY-MM-DD
  DateTimeField: "TEXT", // ISO 8601: YYYY-MM-DDTHH:MM:SS.sssZ
  TimeField: "TEXT", // HH:MM:SS
  DurationField: "INTEGER", // milliseconds
  UUIDField: "TEXT",
  JSONField: "TEXT", // JSON-serialized string
  BinaryField: "BLOB",
  ForeignKey: "INTEGER",
  OneToOneField: "INTEGER UNIQUE",
};

/**
 * SQL lookup operators for SQLite WHERE clauses.
 *
 * SQLite does not support `ILIKE` natively; case-insensitive comparisons
 * use `LOWER(column) = LOWER(value)` or `LIKE` with
 * `PRAGMA case_sensitive_like = OFF` (default).
 */
export const LOOKUP_OPERATORS: Record<string, string> = {
  exact: "= ?",
  iexact: "LIKE ? COLLATE NOCASE",
  contains: "LIKE ?",
  icontains: "LIKE ? COLLATE NOCASE",
  startswith: "LIKE ?",
  istartswith: "LIKE ? COLLATE NOCASE",
  endswith: "LIKE ?",
  iendswith: "LIKE ? COLLATE NOCASE",
  gt: "> ?",
  gte: ">= ?",
  lt: "< ?",
  lte: "<= ?",
  in: "IN (?)",
  range: "BETWEEN ? AND ?",
  isnull: "IS NULL",
  regex: "REGEXP ?",
  iregex: "REGEXP ?", // custom REGEXP function needed
};
