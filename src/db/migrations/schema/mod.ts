/**
 * Migration Schema Editors
 *
 * Backend-specific schema editors for migrations.
 *
 * @module
 */

export { PostgresMigrationSchemaEditor } from "./postgres.ts";
export { DenoKVMigrationSchemaEditor } from "./denokv.ts";
export { SQLiteMigrationSchemaEditor } from "./sqlite.ts";

import type { DatabaseBackend } from "../../backends/backend.ts";
import type { IBackendSchemaEditor } from "../schema_editor.ts";
import { PostgresMigrationSchemaEditor } from "./postgres.ts";
import { DenoKVMigrationSchemaEditor } from "./denokv.ts";
import { SQLiteMigrationSchemaEditor } from "./sqlite.ts";

// ============================================================================
// Backend Type Detection
// ============================================================================

function isDenoKVBackend(
  backend: DatabaseBackend,
): backend is DatabaseBackend & { kv: Deno.Kv } {
  return "kv" in backend && backend.kv !== undefined;
}

function isSQLiteBackend(
  backend: DatabaseBackend,
): backend is DatabaseBackend & {
  db: {
    exec(sql: string): void;
    prepare(sql: string): { all(...args: unknown[]): unknown[] };
  };
} {
  if (!("db" in backend)) return false;
  const db = (backend as Record<string, unknown>).db;
  if (!db || typeof db !== "object") return false;
  const dbObj = db as Record<string, unknown>;
  return typeof dbObj.exec === "function" &&
    typeof dbObj.prepare === "function";
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a migration schema editor appropriate for the given backend.
 *
 * - DenoKV backends → {@link DenoKVMigrationSchemaEditor}
 * - SQLite backends → {@link SQLiteMigrationSchemaEditor}
 * - All other SQL backends (PostgreSQL, etc.) → {@link PostgresMigrationSchemaEditor}
 *
 * @param backend - The database backend.
 * @returns An {@link IBackendSchemaEditor} implementation for that backend.
 *
 * @example
 * ```ts
 * const editor = createSchemaEditor(backend);
 * await editor.createTable(UserModel);
 * ```
 */
export function createSchemaEditor(
  backend: DatabaseBackend,
): IBackendSchemaEditor {
  if (isDenoKVBackend(backend)) {
    return new DenoKVMigrationSchemaEditor(backend.kv);
  }

  if (isSQLiteBackend(backend)) {
    // Cast through unknown to satisfy the generic `prepare<T>` signature in
    // SQLiteMigrationSchemaEditor's private SQLiteDB interface — the runtime
    // object is identical.
    // deno-lint-ignore no-explicit-any
    return new SQLiteMigrationSchemaEditor(backend.db as unknown as any);
  }

  // Default: PostgreSQL-compatible SQL backend
  return new PostgresMigrationSchemaEditor(
    (backend as unknown as { pool: import("npm:pg@8").Pool }).pool,
  );
}
