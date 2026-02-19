/**
 * Sqlmigrate Command
 *
 * Display SQL statements for a migration without executing them.
 *
 * @module @alexi/db/commands/sqlmigrate
 */

import { BaseCommand, failure, success } from "@alexi/core";
import type {
  CommandOptions,
  CommandResult,
  IArgumentParser,
} from "@alexi/core";
import { MigrationLoader } from "../migrations/loader.ts";
import {
  type IBackendSchemaEditor,
  MigrationSchemaEditor,
} from "../migrations/schema_editor.ts";
import { PostgresMigrationSchemaEditor } from "../migrations/schema/postgres.ts";
import { getBackend, getBackendByName } from "../setup.ts";
import type { DatabaseBackend } from "../backends/backend.ts";

// =============================================================================
// SqlmigrateCommand Class
// =============================================================================

/**
 * Display SQL for a migration
 *
 * @example Show forward SQL for a migration
 * ```bash
 * deno run -A manage.ts sqlmigrate users 0001_init_user
 * ```
 *
 * @example Show backward SQL (rollback)
 * ```bash
 * deno run -A manage.ts sqlmigrate users 0001_init_user --backwards
 * ```
 */
export class SqlmigrateCommand extends BaseCommand {
  readonly name = "sqlmigrate";
  readonly help = "Display SQL statements for a migration";
  override readonly description =
    "Shows the SQL that would be generated for a specific migration, " +
    "without actually executing it. Useful for reviewing changes before " +
    "applying them or for generating SQL scripts.";

  override readonly examples = [
    "manage.ts sqlmigrate users 0001_init_user       - Show forward SQL",
    "manage.ts sqlmigrate users 0001_init_user -b    - Show backward SQL",
    "manage.ts sqlmigrate users 0001 --no-color      - Disable syntax highlighting",
  ];

  // ===========================================================================
  // Argument Configuration
  // ===========================================================================

  override addArguments(parser: IArgumentParser): void {
    parser.addArgument("app", {
      type: "string",
      required: true,
      help: "App label (e.g., 'users')",
    });

    parser.addArgument("migration", {
      type: "string",
      required: true,
      help: "Migration name or prefix (e.g., '0001_init_user' or '0001')",
    });

    parser.addArgument("--backwards", {
      type: "boolean",
      alias: "-b",
      default: false,
      help: "Show SQL for rolling back the migration",
    });

    parser.addArgument("--database", {
      type: "string",
      required: false,
      help: "Database backend name",
    });

    parser.addArgument("--migrations-dir", {
      type: "string",
      required: false,
      help: "Path to migrations directory",
    });

    parser.addArgument("--no-color", {
      type: "boolean",
      default: false,
      help: "Disable syntax highlighting",
    });
  }

  // ===========================================================================
  // Command Execution
  // ===========================================================================

  async handle(options: CommandOptions): Promise<CommandResult> {
    const appLabel = options.args.app as string;
    const migrationName = options.args.migration as string;
    const backwards = options.args.backwards as boolean;
    const databaseName = options.args.database as string | undefined;
    const migrationsDir = options.args["migrations-dir"] as string | undefined;
    const noColor = options.args["no-color"] as boolean;

    try {
      // Get database backend
      const backend = databaseName
        ? getBackendByName(databaseName)
        : getBackend();

      if (!backend) {
        return failure("No database backend configured. Check your settings.");
      }

      // Load migrations
      const loader = new MigrationLoader();
      const rootDir = migrationsDir ?? Deno.cwd();
      await loader.loadFromDirectory(rootDir);

      if (!loader.hasMigrations()) {
        return failure("No migrations found.");
      }

      // Find the migration
      const migration = this._findMigration(loader, appLabel, migrationName);
      if (!migration) {
        return failure(
          `Migration '${migrationName}' not found in app '${appLabel}'.`,
        );
      }

      // Check if backward is possible
      if (backwards && !migration.migration.canReverse()) {
        return failure(
          `Migration '${migration.migration.name}' cannot be reversed (no backwards() method).`,
        );
      }

      // Create schema editor in dry-run mode
      const backendSchemaEditor = this._createSchemaEditor(
        backend,
        migration.migration.name,
      );

      if (!backendSchemaEditor) {
        return failure(
          "Could not create schema editor. Ensure database backend supports SQL generation.",
        );
      }

      // Create migration schema editor with dry-run mode
      const migrationSchemaEditor = new MigrationSchemaEditor(
        backend,
        backendSchemaEditor,
        migration.migration.name,
        { dryRun: true },
      );

      // Execute the migration in dry-run mode
      if (backwards) {
        if (!migration.migration.backwards) {
          return failure(
            `Migration ${migration.migration.getFullName()} cannot be reversed (no backwards() method)`,
          );
        }
        await migration.migration.backwards(migrationSchemaEditor);
      } else {
        await migration.migration.forwards(migrationSchemaEditor);
      }

      // Get generated SQL
      const statements = backendSchemaEditor.getGeneratedSQL();

      // Display header
      const direction = backwards ? "BACKWARDS" : "FORWARDS";
      const fullName = migration.migration.getFullName();

      this.stdout.log(`-- ${direction} SQL for: ${fullName}`);
      this.stdout.log(`-- Generated at: ${new Date().toISOString()}`);
      this.stdout.log(`-- ` + "=".repeat(60));
      this.stdout.log("");

      if (statements.length === 0) {
        this.stdout.log("-- No SQL statements generated.");
        this.stdout.log("-- (This migration may only contain data operations)");
      } else {
        for (const stmt of statements) {
          // Format and display SQL
          const sql = this._formatSQL(stmt.sql, noColor);
          this.stdout.log(sql + ";");
          this.stdout.log("");
        }
      }

      // Display summary
      this.stdout.log(`-- ` + "=".repeat(60));
      this.stdout.log(`-- Total: ${statements.length} statement(s)`);

      return success();
    } catch (error) {
      this.error(error instanceof Error ? error.message : String(error));
      return failure();
    }
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  private _findMigration(
    loader: MigrationLoader,
    appLabel: string,
    nameOrPrefix: string,
  ) {
    const migrations = loader.getMigrationsForApp(appLabel);

    // Try exact match first
    let found = migrations.find(
      (m) => m.migration.name === nameOrPrefix,
    );

    if (found) {
      return found;
    }

    // Try prefix match (e.g., "0001" matches "0001_init_user")
    const matches = migrations.filter(
      (m) => m.migration.name.startsWith(nameOrPrefix),
    );

    if (matches.length === 1) {
      return matches[0];
    }

    if (matches.length > 1) {
      this.warn(`Multiple migrations match '${nameOrPrefix}':`);
      for (const m of matches) {
        this.warn(`  - ${m.migration.name}`);
      }
      return null;
    }

    return null;
  }

  private _createSchemaEditor(
    backend: DatabaseBackend,
    _migrationName: string,
  ): IBackendSchemaEditor | null {
    // Check if backend is PostgreSQL
    const backendType = backend.constructor.name;

    if (backendType === "PostgresBackend" || backendType.includes("Postgres")) {
      // Get the pool from the backend
      // deno-lint-ignore no-explicit-any
      const pool = (backend as any)._pool ?? (backend as any).pool;

      if (pool) {
        return new PostgresMigrationSchemaEditor(pool, { dryRun: true });
      }
    }

    // For other backends, try to use a generic approach
    // Create a mock schema editor that collects SQL statements
    return new DryRunSchemaEditor();
  }

  private _formatSQL(sql: string, noColor: boolean): string {
    if (noColor) {
      return sql;
    }

    // Simple syntax highlighting using ANSI colors
    // Keywords
    const keywords = [
      "CREATE",
      "TABLE",
      "ALTER",
      "DROP",
      "ADD",
      "COLUMN",
      "INDEX",
      "CONSTRAINT",
      "PRIMARY",
      "KEY",
      "FOREIGN",
      "REFERENCES",
      "UNIQUE",
      "NOT",
      "NULL",
      "DEFAULT",
      "IF",
      "EXISTS",
      "CASCADE",
      "ON",
      "DELETE",
      "UPDATE",
      "SET",
      "WHERE",
      "RENAME",
      "TO",
      "TYPE",
      "USING",
      "CHECK",
    ];

    let result = sql;

    for (const keyword of keywords) {
      // Match whole words only
      const regex = new RegExp(`\\b(${keyword})\\b`, "gi");
      result = result.replace(regex, "\x1b[36m$1\x1b[0m"); // Cyan
    }

    // Types
    const types = [
      "INTEGER",
      "BIGINT",
      "SMALLINT",
      "VARCHAR",
      "TEXT",
      "BOOLEAN",
      "DATE",
      "TIMESTAMP",
      "TIME",
      "INTERVAL",
      "UUID",
      "BYTEA",
      "JSONB",
      "JSON",
      "SERIAL",
      "BIGSERIAL",
      "SMALLSERIAL",
      "NUMERIC",
      "DOUBLE PRECISION",
      "WITH TIME ZONE",
    ];

    for (const type of types) {
      const regex = new RegExp(`\\b(${type})\\b`, "gi");
      result = result.replace(regex, "\x1b[33m$1\x1b[0m"); // Yellow
    }

    return result;
  }
}

// =============================================================================
// Dry Run Schema Editor
// =============================================================================

import type { Model } from "../models/model.ts";
import type { Field } from "../fields/field.ts";
import type {
  CreateIndexOptions,
  SQLStatement,
} from "../migrations/schema_editor.ts";

// deno-lint-ignore no-explicit-any
type AnyField = Field<any>;

/**
 * A schema editor that doesn't execute anything but collects SQL statements.
 * Used for backends that don't have native dry-run support.
 */
class DryRunSchemaEditor implements IBackendSchemaEditor {
  private _statements: SQLStatement[] = [];

  async createTable(_model: typeof Model): Promise<void> {
    this._statements.push({
      sql: "-- CREATE TABLE (model-based operation, SQL not available)",
      description: "Create table",
    });
  }

  async dropTable(tableName: string): Promise<void> {
    this._statements.push({
      sql: `DROP TABLE IF EXISTS "${tableName}" CASCADE`,
      description: `Drop table ${tableName}`,
    });
  }

  async renameTable(oldName: string, newName: string): Promise<void> {
    this._statements.push({
      sql: `ALTER TABLE "${oldName}" RENAME TO "${newName}"`,
      description: `Rename table ${oldName} to ${newName}`,
    });
  }

  async tableExists(_tableName: string): Promise<boolean> {
    return false;
  }

  async addColumn(
    tableName: string,
    columnName: string,
    _field: AnyField,
  ): Promise<void> {
    this._statements.push({
      sql:
        `-- ALTER TABLE "${tableName}" ADD COLUMN "${columnName}" (type determined at runtime)`,
      description: `Add column ${columnName} to ${tableName}`,
    });
  }

  async dropColumn(tableName: string, columnName: string): Promise<void> {
    this._statements.push({
      sql: `ALTER TABLE "${tableName}" DROP COLUMN IF EXISTS "${columnName}"`,
      description: `Drop column ${columnName} from ${tableName}`,
    });
  }

  async renameColumn(
    tableName: string,
    oldName: string,
    newName: string,
  ): Promise<void> {
    this._statements.push({
      sql:
        `ALTER TABLE "${tableName}" RENAME COLUMN "${oldName}" TO "${newName}"`,
      description: `Rename column ${oldName} to ${newName}`,
    });
  }

  async alterColumn(
    tableName: string,
    columnName: string,
    _field: AnyField,
  ): Promise<void> {
    this._statements.push({
      sql:
        `-- ALTER TABLE "${tableName}" ALTER COLUMN "${columnName}" (changes determined at runtime)`,
      description: `Alter column ${columnName} in ${tableName}`,
    });
  }

  async createIndex(
    tableName: string,
    columns: string[],
    options?: CreateIndexOptions,
  ): Promise<void> {
    const indexName = options?.name ?? `idx_${tableName}_${columns.join("_")}`;
    const unique = options?.unique ? "UNIQUE " : "";
    this._statements.push({
      sql:
        `CREATE ${unique}INDEX IF NOT EXISTS "${indexName}" ON "${tableName}" (${
          columns.map((c) => `"${c}"`).join(", ")
        })`,
      description: `Create index ${indexName}`,
    });
  }

  async dropIndex(indexName: string): Promise<void> {
    this._statements.push({
      sql: `DROP INDEX IF EXISTS "${indexName}"`,
      description: `Drop index ${indexName}`,
    });
  }

  async copyColumnData(
    tableName: string,
    sourceColumn: string,
    targetColumn: string,
    transform?: string,
  ): Promise<void> {
    const source = transform ?? `"${sourceColumn}"`;
    this._statements.push({
      sql: `UPDATE "${tableName}" SET "${targetColumn}" = ${source}`,
      description: `Copy data from ${sourceColumn} to ${targetColumn}`,
    });
  }

  async addForeignKey(
    tableName: string,
    columnName: string,
    referencedTable: string,
    referencedColumn: string,
    onDelete = "CASCADE",
  ): Promise<void> {
    const constraintName = `fk_${tableName}_${columnName}`;
    this._statements.push({
      sql:
        `ALTER TABLE "${tableName}" ADD CONSTRAINT "${constraintName}" FOREIGN KEY ("${columnName}") REFERENCES "${referencedTable}"("${referencedColumn}") ON DELETE ${onDelete}`,
      description: `Add foreign key ${constraintName}`,
    });
  }

  async dropConstraint(
    tableName: string,
    constraintName: string,
  ): Promise<void> {
    this._statements.push({
      sql:
        `ALTER TABLE "${tableName}" DROP CONSTRAINT IF EXISTS "${constraintName}"`,
      description: `Drop constraint ${constraintName}`,
    });
  }

  async executeRaw(sql: string, _params?: unknown[]): Promise<void> {
    this._statements.push({
      sql,
      description: "Raw SQL",
    });
  }

  getGeneratedSQL(): SQLStatement[] {
    return [...this._statements];
  }
}
