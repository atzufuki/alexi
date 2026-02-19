/**
 * Alexi Database Migrations
 *
 * A Django-inspired migration system for managing database schema changes.
 *
 * ## Features
 *
 * - **Imperative migrations**: Write `forwards()` and `backwards()` methods
 * - **Deprecation model**: Never delete data - use `deprecateField()` and `deprecateModel()`
 * - **Multiple backends**: PostgreSQL, DenoKV with `.using(backend)` pattern
 * - **Safe by default**: All migrations are reversible unless `reversible = false`
 *
 * ## Example Migration
 *
 * ```ts
 * import { Migration, MigrationSchemaEditor } from "@alexi/db/migrations";
 *
 * class UserModel extends Model {
 *   static meta = { dbTable: "users" };
 *   id = new AutoField({ primaryKey: true });
 *   email = new CharField({ maxLength: 255 });
 * }
 *
 * export default class Migration0001 extends Migration {
 *   name = "0001_create_users";
 *   dependencies = [];
 *
 *   async forwards(schema: MigrationSchemaEditor): Promise<void> {
 *     await schema.createModel(UserModel);
 *   }
 *
 *   async backwards(schema: MigrationSchemaEditor): Promise<void> {
 *     await schema.deprecateModel(UserModel);
 *   }
 * }
 * ```
 *
 * @module @alexi/db/migrations
 */

export { DataMigration, Migration } from "./migration.ts";
export type { MigrationDependency, MigrationOptions } from "./migration.ts";

export { MigrationSchemaEditor } from "./schema_editor.ts";
export type { AlterFieldOptions, DeprecationInfo } from "./schema_editor.ts";

export { MigrationLoader } from "./loader.ts";
export { MigrationExecutor } from "./executor.ts";

// Recorder system
export {
  createDeprecationRecorder,
  createMigrationRecorder,
} from "./recorders/factory.ts";
export type {
  DeprecationRecord,
  IDeprecationRecorder,
  IMigrationRecorder,
  MigrationRecord,
} from "./recorders/interfaces.ts";
export { PostgresMigrationRecorder } from "./recorders/postgres_migration.ts";
export { PostgresDeprecationRecorder } from "./recorders/postgres_deprecation.ts";
export { DenoKVMigrationRecorder } from "./recorders/denokv_migration.ts";
export { DenoKVDeprecationRecorder } from "./recorders/denokv_deprecation.ts";

export { fieldToState, ModelState, ProjectState } from "./state.ts";
export type { FieldState, ModelStateData, ProjectStateData } from "./state.ts";

export {
  categorizeChanges,
  formatChange,
  groupChanges,
  StateComparator,
} from "./comparator.ts";
export type {
  AddFieldChange,
  AddIndexChange,
  AlterFieldChange,
  AlterUniqueTogetherChange,
  Change,
  ChangeType,
  CompareOptions,
  CreateModelChange,
  DeleteModelChange,
  RemoveFieldChange,
  RemoveIndexChange,
  RenameFieldChange,
  RenameModelChange,
} from "./comparator.ts";

export { MigrationNamer } from "./namer.ts";
export type { MigrationNameSuggestion, MigrationPrefix } from "./namer.ts";
