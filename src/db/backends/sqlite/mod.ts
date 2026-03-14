/**
 * SQLite Backend for Alexi ORM
 *
 * Lightweight, file-based SQL database backend using native Deno FFI bindings
 * (`jsr:@db/sqlite`). Ideal for local development, CI pipelines, single-file
 * deployments, and embedded use cases.
 *
 * **Requires:** `--unstable-ffi`
 *
 * @example
 * ```ts
 * import { SQLiteBackend } from "@alexi/db/backends/sqlite";
 * import { setup } from "@alexi/core";
 *
 * await setup({
 *   DATABASES: {
 *     default: new SQLiteBackend({ path: "./data/app.db" }),
 *   },
 * });
 * ```
 *
 * @module
 */

export { SQLiteBackend } from "./backend.ts";
export type { SQLiteConfig } from "./types.ts";
export { SQLiteSchemaEditor } from "./schema_editor.ts";
export type { SQLiteDB } from "./schema_editor.ts";
export {
  fromSQLiteValue,
  SQLiteQueryBuilder,
  toSQLiteValue,
} from "./query_builder.ts";
export { FIELD_TYPE_MAP, LOOKUP_OPERATORS } from "./types.ts";
