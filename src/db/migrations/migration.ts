/**
 * Migration Base Class
 *
 * Base class for all database migrations. Migrations define schema changes
 * using an imperative `forwards()` method, and optionally a `backwards()`
 * method for reversibility.
 *
 * @module
 */

import type { MigrationSchemaEditor } from "./schema_editor.ts";

// ============================================================================
// Types
// ============================================================================

/**
 * Migration dependency specification
 *
 * A dependency is either:
 * - A string: migration name within the same app (e.g., "0001_initial")
 * - A tuple: [appName, migrationName] for cross-app dependencies
 */
export type MigrationDependency = string | [string, string];

/**
 * Options for migration execution
 */
export interface MigrationOptions {
  /** Run in dry-run mode (log SQL but don't execute) */
  dryRun?: boolean;
  /** Verbosity level (0 = silent, 1 = normal, 2 = verbose) */
  verbosity?: number;
  /** Whether to run in test mode (forward -> backward -> forward) */
  testMode?: boolean;
}

// ============================================================================
// Migration Base Class
// ============================================================================

/**
 * Abstract base class for migrations
 *
 * All migrations should extend this class and implement:
 * - `forwards()`: Apply the migration (required)
 * - `backwards()`: Reverse the migration (optional - omit for non-reversible)
 *
 * @example
 * ```ts
 * import { Migration, MigrationSchemaEditor } from "@alexi/db/migrations";
 * import { Model, AutoField, CharField, EmailField } from "@alexi/db";
 *
 * // Snapshot model - frozen at this migration's point in time
 * class UserModel extends Model {
 *   static meta = { dbTable: "users" };
 *   id = new AutoField({ primaryKey: true });
 *   email = new EmailField({ unique: true });
 *   name = new CharField({ maxLength: 100 });
 * }
 *
 * export default class Migration0001 extends Migration {
 *   name = "0001_create_users";
 *   dependencies = [];
 *
 *   async forwards(schema: MigrationSchemaEditor): Promise<void> {
 *     await schema.createModel(UserModel);
 *     await schema.createIndex(UserModel, ["email"]);
 *   }
 *
 *   async backwards(schema: MigrationSchemaEditor): Promise<void> {
 *     await schema.dropIndex(UserModel, "idx_users_email");
 *     await schema.deprecateModel(UserModel);
 *   }
 * }
 * ```
 */
export abstract class Migration {
  // ==========================================================================
  // Migration Metadata (override in subclasses)
  // ==========================================================================

  /**
   * Migration name (e.g., "0001_initial", "0002_add_user_email")
   *
   * Convention: `NNNN_description` where NNNN is a sequential number
   */
  abstract readonly name: string;

  /**
   * Application name this migration belongs to
   *
   * Set automatically by the migration loader based on the file path
   */
  appLabel: string = "";

  /**
   * Dependencies that must run before this migration
   *
   * Can be:
   * - String: migration name in the same app (e.g., "0001_initial")
   * - Tuple: [appName, migrationName] for cross-app dependencies
   *
   * @example
   * ```ts
   * // Same-app dependency
   * dependencies = ["0001_initial"];
   *
   * // Cross-app dependency
   * dependencies = [["auth", "0001_initial"]];
   * ```
   */
  dependencies: MigrationDependency[] = [];

  /**
   * Description of the migration (optional)
   *
   * Shown in `showmigrations` output
   */
  description?: string;

  // ==========================================================================
  // Migration Operations
  // ==========================================================================

  /**
   * Apply the migration
   *
   * Implement this method to define the schema changes for this migration.
   * Use the schema editor's methods to modify the database structure.
   *
   * @param schema - Schema editor for making changes
   *
   * @example
   * ```ts
   * async forwards(schema: MigrationSchemaEditor): Promise<void> {
   *   await schema.createModel(UserModel);
   *   await schema.addField(UserModel, "email", new EmailField());
   * }
   * ```
   */
  abstract forwards(schema: MigrationSchemaEditor): Promise<void>;

  /**
   * Reverse the migration (optional)
   *
   * Implement this method to undo the changes made in `forwards()`.
   * Use deprecation methods instead of deletion for safety.
   *
   * If not implemented, the migration cannot be reversed. A warning will
   * be shown when applying, and rollback will be blocked.
   *
   * @param schema - Schema editor for making changes
   *
   * @example
   * ```ts
   * async backwards(schema: MigrationSchemaEditor): Promise<void> {
   *   await schema.deprecateField(UserModel, "email");
   *   await schema.deprecateModel(UserModel);
   * }
   * ```
   */
  backwards?(schema: MigrationSchemaEditor): Promise<void>;

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Get full migration identifier
   *
   * @returns Full identifier in format "appLabel.migrationName"
   */
  getFullName(): string {
    if (this.appLabel) {
      return `${this.appLabel}.${this.name}`;
    }
    return this.name;
  }

  /**
   * Parse a dependency into app label and migration name
   *
   * @param dependency - The dependency to parse
   * @returns Tuple of [appLabel, migrationName]
   */
  parseDependency(dependency: MigrationDependency): [string, string] {
    if (typeof dependency === "string") {
      return [this.appLabel, dependency];
    }
    return dependency;
  }

  /**
   * Get all resolved dependencies as full identifiers
   *
   * @returns Array of full dependency identifiers
   */
  getResolvedDependencies(): string[] {
    return this.dependencies.map((dep) => {
      const [app, name] = this.parseDependency(dep);
      return `${app}.${name}`;
    });
  }

  /**
   * Check if this migration can be reversed
   *
   * Returns true if `backwards()` is implemented.
   *
   * @returns true if reversible
   */
  canReverse(): boolean {
    return typeof this.backwards === "function";
  }
}

// ============================================================================
// Data Migration Helper
// ============================================================================

/**
 * Helper class for data migrations
 *
 * Use this for migrations that need to transform data, not just schema.
 * By default, data migrations don't have a `backwards()` method, making
 * them non-reversible. Override `backwards()` to make them reversible.
 *
 * @example Non-reversible data migration
 * ```ts
 * import { DataMigration, MigrationSchemaEditor } from "@alexi/db/migrations";
 *
 * export default class Migration0003 extends DataMigration {
 *   name = "0003_normalize_emails";
 *
 *   async forwards(_schema: MigrationSchemaEditor): Promise<void> {
 *     const users = await UserModel.objects.all().fetch();
 *     for (const user of users.array()) {
 *       user.email.set(user.email.get().toLowerCase());
 *       await user.save();
 *     }
 *   }
 *   // No backwards() - cannot be reversed
 * }
 * ```
 *
 * @example Reversible data migration
 * ```ts
 * import { DataMigration, MigrationSchemaEditor } from "@alexi/db/migrations";
 *
 * export default class Migration0003 extends DataMigration {
 *   name = "0003_normalize_emails";
 *
 *   async forwards(schema: MigrationSchemaEditor): Promise<void> {
 *     await schema.deprecateField(UserModel, "email");
 *     await schema.addField(UserModel, "email", new EmailField());
 *     await schema.executeSQL(`
 *       UPDATE users SET email = LOWER(_deprecated_0003_email)
 *     `);
 *   }
 *
 *   async backwards(schema: MigrationSchemaEditor): Promise<void> {
 *     await schema.dropField(UserModel, "email");
 *     await schema.restoreField(UserModel, "email");
 *   }
 * }
 * ```
 */
export abstract class DataMigration extends Migration {
  // DataMigration doesn't override anything special anymore.
  // It's just a semantic marker for data-only migrations.
  // backwards() is optional by default (inherited from Migration).
}
