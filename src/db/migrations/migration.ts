/**
 * Migration Base Class
 *
 * Base class for all database migrations. Migrations define schema changes
 * using imperative `forwards()` and `backwards()` methods.
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
 * - `forwards()`: Apply the migration
 * - `backwards()`: Reverse the migration (unless `reversible = false`)
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
   * Whether this migration is reversible
   *
   * Set to `false` if the migration cannot be reversed (e.g., data loss).
   * A warning will be shown when applying irreversible migrations.
   *
   * @default true
   */
  reversible: boolean = true;

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
   * Reverse the migration
   *
   * Implement this method to undo the changes made in `forwards()`.
   * Use deprecation methods instead of deletion for safety.
   *
   * If `reversible = false`, this method can throw an error or be empty.
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
  abstract backwards(schema: MigrationSchemaEditor): Promise<void>;

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
   * @returns true if reversible
   */
  canReverse(): boolean {
    return this.reversible;
  }
}

// ============================================================================
// Data Migration Helper
// ============================================================================

/**
 * Helper class for data migrations
 *
 * Use this for migrations that need to transform data, not just schema.
 *
 * @example
 * ```ts
 * import { DataMigration } from "@alexi/db/migrations";
 * import { db } from "@alexi/db";
 *
 * export default class Migration0003 extends DataMigration {
 *   name = "0003_normalize_emails";
 *
 *   async forwards(schema: MigrationSchemaEditor): Promise<void> {
 *     const users = await db.executeRaw(`SELECT id, email FROM users`);
 *     for (const user of users) {
 *       await db.executeRaw(
 *         `UPDATE users SET email = $1 WHERE id = $2`,
 *         [user.email.toLowerCase(), user.id]
 *       );
 *     }
 *   }
 *
 *   async backwards(schema: MigrationSchemaEditor): Promise<void> {
 *     // Cannot reverse email normalization
 *     throw new Error("This migration cannot be reversed");
 *   }
 * }
 * ```
 */
export abstract class DataMigration extends Migration {
  /**
   * Data migrations are not reversible by default
   * (override if you implement proper backwards())
   */
  override reversible = false;
}
