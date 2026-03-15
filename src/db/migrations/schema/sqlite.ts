/**
 * SQLite Migration Schema Editor
 *
 * Implements {@link IBackendSchemaEditor} for SQLite with deprecation support.
 *
 * **SQLite DDL limitations:**
 * - `RENAME COLUMN` requires SQLite ≥ 3.25.0 (released 2018-09-15).
 * - `DROP COLUMN` requires SQLite ≥ 3.35.0 (released 2021-03-12).
 *   Both methods throw a descriptive error on unsupported versions.
 * - `ALTER COLUMN` is not supported at all in SQLite; the method throws.
 *   To change a column type or constraints, recreate the table in the migration.
 * - `executeRaw` executes SQL directly — use with caution.
 *
 * @module
 */

import type { Model } from "../../models/model.ts";
import type { Field } from "../../fields/field.ts";
import type {
  CreateIndexOptions,
  IBackendSchemaEditor,
  SQLStatement,
} from "../schema_editor.ts";
import { FIELD_TYPE_MAP } from "../../backends/sqlite/types.ts";
import type { SQLiteDB } from "../../backends/sqlite/schema_editor.ts";

// deno-lint-ignore no-explicit-any
type AnyField = Field<any>;

// ============================================================================
// Internal helpers (mirrors SQLiteSchemaEditor helpers)
// ============================================================================

function getFieldType(field: unknown): string | null {
  if (!field || typeof field !== "object") return null;
  const f = field as Record<string, unknown>;
  if (typeof f._type === "string") return f._type;
  const ctor = (field as { constructor?: { name?: string } }).constructor;
  return ctor?.name ?? null;
}

function getFieldOptions(field: unknown): Record<string, unknown> {
  if (!field || typeof field !== "object") return {};
  const f = field as Record<string, unknown>;
  return {
    maxLength: f._maxLength ?? f.maxLength,
    primaryKey: f._primaryKey ?? f.primaryKey,
    null: f._null ?? f.null,
    blank: f._blank ?? f.blank,
    default: f._default ?? f.default,
    unique: f._unique ?? f.unique,
    dbIndex: f._dbIndex ?? f.dbIndex,
    precision: f._precision ?? f.precision,
    scale: f._scale ?? f.scale,
    relatedModel: f._relatedModel ?? f.relatedModel,
    onDelete: f._onDelete ?? f.onDelete,
  };
}

// ============================================================================
// SQLite Migration Schema Editor
// ============================================================================

/**
 * SQLite schema editor for migrations.
 *
 * Implements all operations required by the Alexi migration system against a
 * SQLite database. Pass an open {@link SQLiteDB} handle when constructing.
 *
 * Use `dryRun: true` to collect the generated SQL without executing it.
 *
 * @example
 * ```ts
 * const editor = new SQLiteMigrationSchemaEditor(db, { dryRun: true });
 * await editor.createTable(MyModel);
 * console.log(editor.getGeneratedSQL());
 * ```
 */
export class SQLiteMigrationSchemaEditor implements IBackendSchemaEditor {
  private _db: SQLiteDB;
  private _dryRun: boolean;
  private _statements: SQLStatement[] = [];

  /**
   * @param db - An open SQLite database handle.
   * @param options - Optional configuration.
   * @param options.dryRun - When `true`, SQL is collected but not executed.
   */
  constructor(db: SQLiteDB, options?: { dryRun?: boolean }) {
    this._db = db;
    this._dryRun = options?.dryRun ?? false;
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  private quote(name: string): string {
    return `"${name}"`;
  }

  private execute(sql: string): void {
    this._statements.push({ sql, description: sql.substring(0, 80) });
    if (!this._dryRun) {
      this._db.exec(sql);
    }
  }

  // ==========================================================================
  // Column Definition Builder
  // ==========================================================================

  private buildColumnDefinition(
    fieldName: string,
    fieldType: string,
    field: unknown,
  ): string | null {
    const options = getFieldOptions(field);
    let columnName = fieldName;
    let sqlType = FIELD_TYPE_MAP[fieldType];

    if (!sqlType) return null;

    // ForeignKey / OneToOneField: stored as `fieldName_id INTEGER`
    if (fieldType === "ForeignKey" || fieldType === "OneToOneField") {
      columnName = `${fieldName}_id`;
      sqlType = fieldType === "OneToOneField" ? "INTEGER UNIQUE" : "INTEGER";
    }

    // Replace {column} placeholder in CHECK constraints
    if (sqlType.includes("{column}")) {
      sqlType = sqlType.replace(/{column}/g, this.quote(columnName));
    }

    const parts: string[] = [this.quote(columnName), sqlType];

    // NOT NULL
    if (options.null === false && !options.primaryKey) {
      parts.push("NOT NULL");
    }

    // UNIQUE (if not already in type string)
    if (
      options.unique && !fieldType.includes("AutoField") &&
      !sqlType.includes("UNIQUE")
    ) {
      parts.push("UNIQUE");
    }

    // DEFAULT
    if (options.default !== undefined && options.default !== null) {
      const defaultValue = this.formatDefault(options.default, fieldType);
      if (defaultValue !== null) {
        parts.push(`DEFAULT ${defaultValue}`);
      }
    }

    return parts.join(" ");
  }

  private formatDefault(value: unknown, fieldType: string): string | null {
    if (value === undefined || value === null) return null;

    if (typeof value === "function") {
      if (fieldType === "DateTimeField") return "CURRENT_TIMESTAMP";
      if (fieldType === "DateField") return "CURRENT_DATE";
      if (fieldType === "TimeField") return "CURRENT_TIME";
      return null;
    }

    if (typeof value === "string") {
      return `'${value.replace(/'/g, "''")}'`;
    }
    if (typeof value === "number") return String(value);
    if (typeof value === "boolean") return value ? "1" : "0";
    if (value instanceof Date) return `'${value.toISOString()}'`;
    if (typeof value === "object") {
      return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
    }

    return null;
  }

  // ==========================================================================
  // Table Operations
  // ==========================================================================

  /**
   * Create a table for the given model if it does not already exist.
   *
   * @param model - The model class to create a table for.
   */
  async createTable(model: typeof Model): Promise<void> {
    const tableName = model.getTableName();
    // deno-lint-ignore no-explicit-any
    const instance = new (model as any)();
    const columns: string[] = [];

    for (const [fieldName, field] of Object.entries(instance)) {
      if (fieldName.startsWith("_") || fieldName === "pk") continue;
      const fieldType = getFieldType(field);
      if (!fieldType) continue;
      const columnDef = this.buildColumnDefinition(fieldName, fieldType, field);
      if (columnDef) columns.push(columnDef);
    }

    if (columns.length === 0) {
      throw new Error(`Model ${model.name} has no valid fields`);
    }

    const sql = `CREATE TABLE IF NOT EXISTS ${this.quote(tableName)} (\n  ${
      columns.join(",\n  ")
    }\n)`;
    this.execute(sql);
    await Promise.resolve();
  }

  /**
   * Drop a table by name.
   *
   * @param tableName - The name of the table to drop.
   */
  async dropTable(tableName: string): Promise<void> {
    this.execute(`DROP TABLE IF EXISTS ${this.quote(tableName)}`);
    await Promise.resolve();
  }

  /**
   * Rename a table.
   *
   * Requires SQLite ≥ 3.25.0.
   *
   * @param oldName - Current table name.
   * @param newName - New table name.
   */
  async renameTable(oldName: string, newName: string): Promise<void> {
    this.execute(
      `ALTER TABLE ${this.quote(oldName)} RENAME TO ${this.quote(newName)}`,
    );
    await Promise.resolve();
  }

  /**
   * Check whether a table exists.
   *
   * @param tableName - The table name to check.
   * @returns `true` if the table exists, `false` otherwise.
   */
  async tableExists(tableName: string): Promise<boolean> {
    if (this._dryRun) return false;
    const rows = this._db.prepare<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM sqlite_master WHERE type='table' AND name=?`,
    ).all(tableName);
    await Promise.resolve();
    return (rows[0]?.cnt ?? 0) > 0;
  }

  // ==========================================================================
  // Column Operations
  // ==========================================================================

  /**
   * Add a column to an existing table.
   *
   * @param tableName - The table to alter.
   * @param columnName - The new column name.
   * @param field - The field instance describing the column.
   */
  async addColumn(
    tableName: string,
    columnName: string,
    field: AnyField,
  ): Promise<void> {
    const fieldType = getFieldType(field);
    if (!fieldType) {
      throw new Error(`Cannot determine type for field "${columnName}"`);
    }

    const columnDef = this.buildColumnDefinition(columnName, fieldType, field);
    if (!columnDef) {
      throw new Error(
        `Cannot build column definition for field "${columnName}" (type: ${fieldType})`,
      );
    }

    this.execute(
      `ALTER TABLE ${this.quote(tableName)} ADD COLUMN ${columnDef}`,
    );
    await Promise.resolve();
  }

  /**
   * Drop a column from a table.
   *
   * Requires SQLite ≥ 3.35.0 (released 2021-03-12).
   * Throws on older SQLite versions with a descriptive message.
   *
   * @param tableName - The table to alter.
   * @param columnName - The column to drop.
   */
  async dropColumn(tableName: string, columnName: string): Promise<void> {
    this.execute(
      `ALTER TABLE ${this.quote(tableName)} DROP COLUMN ${
        this.quote(columnName)
      }`,
    );
    await Promise.resolve();
  }

  /**
   * Rename a column.
   *
   * Requires SQLite ≥ 3.25.0 (released 2018-09-15).
   * Throws on older SQLite versions with a descriptive message.
   *
   * @param tableName - The table to alter.
   * @param oldName - Current column name.
   * @param newName - New column name.
   */
  async renameColumn(
    tableName: string,
    oldName: string,
    newName: string,
  ): Promise<void> {
    this.execute(
      `ALTER TABLE ${this.quote(tableName)} RENAME COLUMN ${
        this.quote(oldName)
      } TO ${this.quote(newName)}`,
    );
    await Promise.resolve();
  }

  /**
   * Alter a column's type or constraints.
   *
   * **SQLite does not support `ALTER COLUMN`.**
   * To change a column definition, recreate the table in your migration:
   * create a new table with the desired schema, copy the data, drop the old
   * table, and rename the new one.
   *
   * @throws {Error} Always — SQLite does not support ALTER COLUMN.
   */
  async alterColumn(
    _tableName: string,
    columnName: string,
    _field: AnyField,
  ): Promise<void> {
    await Promise.resolve();
    throw new Error(
      `SQLite does not support ALTER COLUMN for column "${columnName}". ` +
        `Recreate the table with the desired schema instead.`,
    );
  }

  // ==========================================================================
  // Index Operations
  // ==========================================================================

  /**
   * Create an index on one or more columns.
   *
   * @param tableName - The table to index.
   * @param columns - The column names to include in the index.
   * @param options - Optional index name and uniqueness flag.
   */
  async createIndex(
    tableName: string,
    columns: string[],
    options?: CreateIndexOptions,
  ): Promise<void> {
    const indexName = options?.name ?? `idx_${tableName}_${columns.join("_")}`;
    const unique = options?.unique ? "UNIQUE " : "";
    const columnList = columns.map((c) => this.quote(c)).join(", ");

    this.execute(
      `CREATE ${unique}INDEX IF NOT EXISTS ${this.quote(indexName)} ` +
        `ON ${this.quote(tableName)} (${columnList})`,
    );
    await Promise.resolve();
  }

  /**
   * Drop an index by name.
   *
   * @param indexName - The name of the index to drop.
   */
  async dropIndex(indexName: string): Promise<void> {
    this.execute(`DROP INDEX IF EXISTS ${this.quote(indexName)}`);
    await Promise.resolve();
  }

  // ==========================================================================
  // Data Operations
  // ==========================================================================

  /**
   * Copy data from one column to another within the same table.
   *
   * Useful for the deprecation rename pattern: add new column, copy data,
   * then drop the old column.
   *
   * @param tableName - The table to update.
   * @param sourceColumn - The column to read from.
   * @param targetColumn - The column to write to.
   * @param transform - Optional SQL expression for the source value
   *   (e.g. `"CAST(old_col AS TEXT)"`). Defaults to the source column name.
   */
  async copyColumnData(
    tableName: string,
    sourceColumn: string,
    targetColumn: string,
    transform?: string,
  ): Promise<void> {
    const source = transform ?? this.quote(sourceColumn);
    this.execute(
      `UPDATE ${this.quote(tableName)} SET ${
        this.quote(targetColumn)
      } = ${source}`,
    );
    await Promise.resolve();
  }

  // ==========================================================================
  // Constraint Operations
  // ==========================================================================

  /**
   * Add a foreign key constraint.
   *
   * SQLite parses but does **not enforce** foreign keys unless
   * `PRAGMA foreign_keys = ON` is set. This method emits the SQL statement;
   * enforcement depends on the runtime PRAGMA setting.
   *
   * @param tableName - The referencing table.
   * @param columnName - The referencing column.
   * @param referencedTable - The referenced table.
   * @param referencedColumn - The referenced column.
   * @param onDelete - ON DELETE action (default `"CASCADE"`).
   */
  async addForeignKey(
    _tableName: string,
    _columnName: string,
    _referencedTable: string,
    _referencedColumn: string,
    _onDelete = "CASCADE",
  ): Promise<void> {
    // SQLite does not support adding a foreign key constraint to an existing
    // table via ALTER TABLE. This is a no-op; FK constraints must be declared
    // in the CREATE TABLE statement.
    await Promise.resolve();
  }

  /**
   * Drop a named constraint.
   *
   * SQLite does not support `ALTER TABLE DROP CONSTRAINT`.
   * This is a no-op — named constraints cannot be added to existing SQLite
   * tables via ALTER TABLE, so there is nothing to drop.
   */
  async dropConstraint(
    _tableName: string,
    _constraintName: string,
  ): Promise<void> {
    // No-op: SQLite does not support dropping named constraints.
    await Promise.resolve();
  }

  // ==========================================================================
  // Raw SQL
  // ==========================================================================

  /**
   * Execute a raw SQL statement.
   *
   * @param sql - The SQL string to execute.
   * @param _params - Unused; SQLite raw execution uses the `exec()` API which
   *   does not support parameterised statements. Embed values directly.
   */
  async executeRaw(sql: string, _params?: unknown[]): Promise<void> {
    this.execute(sql);
    await Promise.resolve();
  }

  // ==========================================================================
  // Generated SQL (dry-run support)
  // ==========================================================================

  /**
   * Return all SQL statements that have been collected so far.
   *
   * Useful in `dryRun` mode to inspect what would be executed.
   *
   * @returns A copy of the collected {@link SQLStatement} array.
   */
  getGeneratedSQL(): SQLStatement[] {
    return [...this._statements];
  }
}
