/**
 * Recorder Factory Functions
 *
 * Creates the appropriate recorder based on the backend type.
 *
 * @module
 */

import type { DatabaseBackend } from "../../backends/backend.ts";
import type { IDeprecationRecorder, IMigrationRecorder } from "./interfaces.ts";
import { PostgresMigrationRecorder } from "./postgres_migration.ts";
import { PostgresDeprecationRecorder } from "./postgres_deprecation.ts";
import { DenoKVMigrationRecorder } from "./denokv_migration.ts";
import { DenoKVDeprecationRecorder } from "./denokv_deprecation.ts";

// ============================================================================
// Backend Type Detection
// ============================================================================

/**
 * Check if backend is a DenoKV backend
 */
function isDenoKVBackend(
  backend: DatabaseBackend,
): backend is DatabaseBackend & { kv: Deno.Kv } {
  return "kv" in backend && backend.kv !== undefined;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a migration recorder for the given backend
 *
 * Automatically selects the appropriate implementation based on backend type:
 * - DenoKV backends → DenoKVMigrationRecorder
 * - SQL backends (PostgreSQL, etc.) → PostgresMigrationRecorder
 *
 * @param backend - The database backend
 * @returns The appropriate migration recorder
 *
 * @example
 * ```ts
 * const recorder = createMigrationRecorder(backend);
 * await recorder.recordApplied("users.0001_initial", "users");
 * ```
 */
export function createMigrationRecorder(
  backend: DatabaseBackend,
): IMigrationRecorder {
  if (isDenoKVBackend(backend)) {
    return new DenoKVMigrationRecorder(backend.kv);
  }

  // Default to PostgreSQL recorder for SQL-based backends
  return new PostgresMigrationRecorder(backend);
}

/**
 * Create a deprecation recorder for the given backend
 *
 * Automatically selects the appropriate implementation based on backend type:
 * - DenoKV backends → DenoKVDeprecationRecorder
 * - SQL backends (PostgreSQL, etc.) → PostgresDeprecationRecorder
 *
 * @param backend - The database backend
 * @returns The appropriate deprecation recorder
 *
 * @example
 * ```ts
 * const recorder = createDeprecationRecorder(backend);
 * await recorder.record({
 *   type: "field",
 *   originalName: "email",
 *   deprecatedName: "_deprecated_0001_email",
 *   migrationName: "0001_initial",
 *   tableName: "users",
 *   deprecatedAt: new Date(),
 * });
 * ```
 */
export function createDeprecationRecorder(
  backend: DatabaseBackend,
): IDeprecationRecorder {
  if (isDenoKVBackend(backend)) {
    return new DenoKVDeprecationRecorder(backend.kv);
  }

  // Default to PostgreSQL recorder for SQL-based backends
  return new PostgresDeprecationRecorder(backend);
}
