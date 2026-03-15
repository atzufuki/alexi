/**
 * Migration Base Class
 *
 * Base class for all database migrations. Migrations define schema changes
 * using an imperative `forwards()` method and a required `backwards()`
 * method for reversibility.
 *
 * @module
 */

import type { MigrationSchemaEditor } from "./schema_editor.ts";

// ============================================================================
// Errors
// ============================================================================

/**
 * Thrown when attempting to reverse a migration that explicitly declares
 * itself as non-reversible (e.g. {@link DataMigration}).
 *
 * If you need a truly irreversible schema migration, extend {@link Migration}
 * directly and implement `backwards()` to throw this error with an explanation.
 */
export class IrreversibleMigrationError extends Error {
  constructor(migrationName: string) {
    super(
      `Migration "${migrationName}" is not reversible. ` +
        `If you need to roll back, implement backwards() manually or restore from a backup.`,
    );
    this.name = "IrreversibleMigrationError";
  }
}

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
 * Abstract base class for schema migrations.
 *
 * Every migration **must** implement both `forwards()` and `backwards()`.
 * This is enforced at compile time — there is no optional `backwards()`.
 *
 * For migrations where backwards is genuinely impossible (e.g. irreversible
 * data transformations), use {@link DataMigration} instead, which documents
 * the intent explicitly and throws {@link IrreversibleMigrationError} at
 * runtime if a rollback is attempted.
 *
 * @example
 * ```ts
 * import { Migration } from "@alexi/db/migrations";
 * import type { MigrationSchemaEditor } from "@alexi/db/migrations";
 * import { Model, AutoField, CharField, EmailField } from "@alexi/db";
 *
 * // Snapshot model - frozen at this migration's point in time
 * class UserModel extends Model {
 *   static meta = { dbTable: "users" };
 *   id = new AutoField({ primaryKey: true });
 *   email = new CharField({ maxLength: 255 });
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
   * Reverse the migration.
   *
   * Implement this method to undo the changes made in `forwards()`.
   * Use deprecation methods instead of hard deletion for safety.
   *
   * This method is **abstract** — every migration must provide an
   * implementation. If a rollback is genuinely impossible, use
   * {@link DataMigration} which documents that intent explicitly.
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
   * Check if this migration can be reversed.
   *
   * Always returns `true` for {@link Migration} subclasses since
   * `backwards()` is required. {@link DataMigration} overrides this to
   * return `false`.
   *
   * @returns `true` if the migration can be safely rolled back
   */
  canReverse(): boolean {
    return true;
  }
}

// ============================================================================
// Data Migration Helper
// ============================================================================

/**
 * Base class for data migrations — migrations that transform data rather
 * than schema, and where rollback is genuinely not possible.
 *
 * `DataMigration` satisfies the abstract `backwards()` contract by providing
 * an implementation that throws {@link IrreversibleMigrationError} at runtime.
 * This makes the non-reversibility explicit and intentional rather than
 * accidental.
 *
 * Override `backwards()` if your data migration can be reversed.
 *
 * @example Non-reversible data migration
 * ```ts
 * import { DataMigration } from "@alexi/db/migrations";
 * import type { MigrationSchemaEditor } from "@alexi/db/migrations";
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
 *   // backwards() is intentionally non-reversible — provided by DataMigration
 * }
 * ```
 *
 * @example Reversible data migration (override backwards)
 * ```ts
 * import { DataMigration } from "@alexi/db/migrations";
 * import type { MigrationSchemaEditor } from "@alexi/db/migrations";
 *
 * export default class Migration0004 extends DataMigration {
 *   name = "0004_backfill_slugs";
 *
 *   async forwards(_schema: MigrationSchemaEditor): Promise<void> {
 *     // ... backfill slug field from title
 *   }
 *
 *   override async backwards(_schema: MigrationSchemaEditor): Promise<void> {
 *     // ... clear slug field
 *   }
 * }
 * ```
 */
export abstract class DataMigration extends Migration {
  /**
   * {@inheritDoc Migration.canReverse}
   *
   * Always returns `false` for `DataMigration` unless `backwards()` is
   * overridden in a subclass.
   */
  override canReverse(): boolean {
    return false;
  }

  /**
   * Throws {@link IrreversibleMigrationError}.
   *
   * Override this method in subclasses where the data migration can be
   * meaningfully reversed.
   *
   * @throws {IrreversibleMigrationError} Always, unless overridden.
   */
  override async backwards(_schema: MigrationSchemaEditor): Promise<void> {
    throw new IrreversibleMigrationError(this.name);
  }
}
