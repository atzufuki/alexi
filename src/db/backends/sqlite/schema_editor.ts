/**
 * SQLite Schema Editor
 *
 * Handles table creation, modification and index management for SQLite.
 *
 * **SQLite DDL limitations:**
 * - `ALTER TABLE` only supports `ADD COLUMN` natively (no DROP/RENAME column).
 *   The `removeField` method raises an error to make this explicit.
 * - There is no native boolean, UUID, or JSON type; these are stored as
 *   `INTEGER`, `TEXT`, and `TEXT` respectively.
 *
 * @module
 */

import { Model, ModelRegistry } from "../../models/model.ts";
import type { SchemaEditor } from "../backend.ts";
import { FIELD_TYPE_MAP } from "./types.ts";

// ============================================================================
// Internal helpers
// ============================================================================

/**
 * Get the Alexi field-type string from a field instance.
 */
function getFieldType(field: unknown): string | null {
  if (!field || typeof field !== "object") return null;
  const f = field as Record<string, unknown>;
  if (typeof f._type === "string") return f._type;
  const ctor = (field as { constructor?: { name?: string } }).constructor;
  return ctor?.name ?? null;
}

/**
 * Get common field options from a field instance.
 */
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
// SQLite type descriptor
// ============================================================================

/**
 * A minimal synchronous-like DB interface used by the schema editor.
 * The backend passes a wrapper that delegates to the real `@db/sqlite` `Database`.
 */
export interface SQLiteDB {
  /** Execute a SQL string with no result expectation. */
  exec(sql: string): void;
  /** Prepare a statement and return an object with an `all()` method. */
  prepare<T = Record<string, unknown>>(
    sql: string,
  ): { all(...params: unknown[]): T[] };
}

// ============================================================================
// SQLiteSchemaEditor
// ============================================================================

/**
 * Schema editor for SQLite.
 *
 * Creates and modifies database schema using DDL statements.
 * Pass an open {@link SQLiteDB} handle (from `@db/sqlite`) when constructing.
 *
 * @category Backends
 */
export class SQLiteSchemaEditor implements SchemaEditor {
  private _db: SQLiteDB;

  /** @param db - An open SQLite database handle. */
  constructor(db: SQLiteDB) {
    this._db = db;
  }

  /**
   * Quote an identifier (table or column name).
   */
  private quote(name: string): string {
    return `"${name}"`;
  }

  /**
   * Create a table for a model if it does not already exist.
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
      if (columnDef) {
        columns.push(columnDef);
      }
    }

    if (columns.length === 0) {
      throw new Error(`Model ${model.name} has no valid fields`);
    }

    const sql = `CREATE TABLE IF NOT EXISTS ${this.quote(tableName)} (\n  ${
      columns.join(",\n  ")
    }\n)`;

    this._db.exec(sql);
    await Promise.resolve();
  }

  /**
   * Build a single column definition string for the CREATE TABLE statement.
   */
  private buildColumnDefinition(
    fieldName: string,
    fieldType: string,
    field: unknown,
  ): string | null {
    const options = getFieldOptions(field);
    let columnName = fieldName;
    let sqlType = FIELD_TYPE_MAP[fieldType];

    if (!sqlType) return null;

    // ForeignKey and OneToOneField columns are stored as `fieldName_id INTEGER`.
    if (fieldType === "ForeignKey" || fieldType === "OneToOneField") {
      columnName = `${fieldName}_id`;
      sqlType = fieldType === "OneToOneField" ? "INTEGER UNIQUE" : "INTEGER";

      // Inline REFERENCES constraint
      const opts = options;
      if (opts.relatedModel) {
        const refTable = this.getRelatedTableName(opts.relatedModel as string);
        const onDelete = this.mapOnDelete(opts.onDelete as string);
        sqlType += ` REFERENCES ${
          this.quote(refTable)
        }("id") ON DELETE ${onDelete}`;
      }
    }

    // VARCHAR for CharField
    if (fieldType === "CharField" && options.maxLength) {
      sqlType = `TEXT`; // SQLite TEXT is unlimited; maxLength is enforced at ORM level
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

    // UNIQUE (if not already in the type string)
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

  /**
   * Format a default value for SQL.
   */
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

  /**
   * Derive the related table name for a FK `REFERENCES` clause.
   *
   * Looks up the model class from {@link ModelRegistry} so that
   * `meta.dbTable` is respected. Falls back to the legacy lowercased
   * class-name heuristic when the model has not been registered yet
   * (e.g. during early bootstrap or in unit tests that bypass the registry).
   *
   * @param modelName - The model class name string stored on the ForeignKey field.
   */
  private getRelatedTableName(modelName: string): string {
    const modelClass = ModelRegistry.instance.get(modelName);
    if (modelClass) {
      return modelClass.getTableName();
    }
    // Fallback: strip trailing "Model" suffix, lowercase, and pluralise.
    // Must match Model.getTableName() which returns `name.toLowerCase() + "s"`.
    return modelName.replace(/Model$/, "").toLowerCase() + "s";
  }

  /**
   * Map an Alexi `onDelete` option to a SQLite ON DELETE action.
   */
  private mapOnDelete(onDelete?: string): string {
    switch (onDelete?.toUpperCase()) {
      case "CASCADE":
        return "CASCADE";
      case "PROTECT":
        return "RESTRICT";
      case "SET_NULL":
        return "SET NULL";
      case "SET_DEFAULT":
        return "SET DEFAULT";
      case "DO_NOTHING":
        return "NO ACTION";
      default:
        return "CASCADE";
    }
  }

  /**
   * Drop a table for a model if it exists.
   *
   * @param model - The model class whose table should be dropped.
   */
  async dropTable(model: typeof Model): Promise<void> {
    const tableName = model.getTableName();
    this._db.exec(`DROP TABLE IF EXISTS ${this.quote(tableName)}`);
    await Promise.resolve();
  }

  /**
   * Add a new column to an existing table.
   *
   * @param model - The model class that owns the field.
   * @param fieldName - The model property name of the field to add.
   */
  async addField(model: typeof Model, fieldName: string): Promise<void> {
    const tableName = model.getTableName();
    // deno-lint-ignore no-explicit-any
    const instance = new (model as any)();
    const field = (instance as Record<string, unknown>)[fieldName];

    if (!field) {
      throw new Error(`Field ${fieldName} not found on model ${model.name}`);
    }

    const fieldType = getFieldType(field);
    if (!fieldType) {
      throw new Error(`Cannot determine type for field ${fieldName}`);
    }

    const columnDef = this.buildColumnDefinition(fieldName, fieldType, field);
    if (!columnDef) {
      throw new Error(`Cannot build column definition for field ${fieldName}`);
    }

    this._db.exec(
      `ALTER TABLE ${this.quote(tableName)} ADD COLUMN ${columnDef}`,
    );
    await Promise.resolve();
  }

  /**
   * Remove a column from a table.
   *
   * **SQLite limitation:** SQLite does not support `DROP COLUMN` in older
   * versions (< 3.35.0). This method throws an error to make the limitation
   * explicit; callers should recreate the table instead.
   *
   * @throws {Error} Always throws — use table recreation for column removal.
   */
  async removeField(_model: typeof Model, fieldName: string): Promise<void> {
    await Promise.resolve();
    throw new Error(
      `SQLite does not support DROP COLUMN for field "${fieldName}". ` +
        `Recreate the table with the desired schema instead.`,
    );
  }

  /**
   * Create an index on one or more columns.
   *
   * @param model - The model class that owns the table.
   * @param fields - The field names to index.
   * @param options - Optional index name and uniqueness flag.
   */
  async createIndex(
    model: typeof Model,
    fields: string[],
    options?: { name?: string; unique?: boolean },
  ): Promise<void> {
    const tableName = model.getTableName();
    const indexName = options?.name ?? `idx_${tableName}_${fields.join("_")}`;
    const unique = options?.unique ? "UNIQUE " : "";
    const columns = fields.map((f) => this.quote(f)).join(", ");

    this._db.exec(
      `CREATE ${unique}INDEX IF NOT EXISTS ${this.quote(indexName)} ` +
        `ON ${this.quote(tableName)} (${columns})`,
    );
    await Promise.resolve();
  }

  /**
   * Drop an index by name.
   *
   * @param _model - Unused; indexes in SQLite are database-global by name.
   * @param indexName - The name of the index to drop.
   */
  async dropIndex(_model: typeof Model, indexName: string): Promise<void> {
    this._db.exec(`DROP INDEX IF EXISTS ${this.quote(indexName)}`);
    await Promise.resolve();
  }

  /**
   * Check whether a table exists in the database.
   *
   * @param tableName - The table name to check.
   * @returns `true` if the table exists, `false` otherwise.
   */
  async tableExists(tableName: string): Promise<boolean> {
    const rows = this._db.prepare<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM sqlite_master WHERE type='table' AND name=?`,
    ).all(tableName);
    await Promise.resolve();
    return (rows[0]?.cnt ?? 0) > 0;
  }

  /**
   * Get all table names in the database.
   *
   * @returns An array of table name strings.
   */
  async getTables(): Promise<string[]> {
    const rows = this._db.prepare<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`,
    ).all();
    await Promise.resolve();
    return rows.map((r) => r.name);
  }

  /**
   * Get column information for a table.
   *
   * @param tableName - The table to introspect.
   * @returns An array of column descriptors.
   */
  async getColumns(tableName: string): Promise<
    Array<{
      name: string;
      type: string;
      nullable: boolean;
      default: string | null;
    }>
  > {
    const rows = this._db.prepare<{
      name: string;
      type: string;
      notnull: number;
      dflt_value: string | null;
    }>(`PRAGMA table_info(${this.quote(tableName)})`).all();

    await Promise.resolve();

    return rows.map((r) => ({
      name: r.name,
      type: r.type,
      nullable: r.notnull === 0,
      default: r.dflt_value,
    }));
  }
}
