/**
 * Migration Recorders
 *
 * Backend-specific implementations for tracking migrations and deprecations.
 *
 * @module @alexi/db/migrations/recorders
 */

// Interfaces
export type {
  DeprecationRecord,
  IDeprecationRecorder,
  IMigrationRecorder,
  MigrationRecord,
} from "./interfaces.ts";

// PostgreSQL implementations
export { PostgresMigrationRecorder } from "./postgres_migration.ts";
export { PostgresDeprecationRecorder } from "./postgres_deprecation.ts";

// DenoKV implementations
export { DenoKVMigrationRecorder } from "./denokv_migration.ts";
export { DenoKVDeprecationRecorder } from "./denokv_deprecation.ts";

// Factory functions
export {
  createDeprecationRecorder,
  createMigrationRecorder,
} from "./factory.ts";
