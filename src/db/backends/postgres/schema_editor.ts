/**
 * PostgreSQL Schema Editor
 *
 * Handles table creation, modification, and index management for PostgreSQL.
 *
 * @module
 */

import type { Model } from "../../models/model.ts";
import type { SchemaEditor } from "../backend.ts";
import { FIELD_TYPE_MAP } from "./types.ts";

// Import pg types
import type { Pool } from "npm:pg@8";

// ============================================================================
// Field Type Detection
// ============================================================================

/**
 * Get field type from a field instance
 */
function getFieldType(field: unknown): string | null {
  if (!field || typeof field !== "object") {
    return null;
  }

  // Check for field type indicator
  const fieldObj = field as Record<string, unknown>;
  if (typeof fieldObj._type === "string") {
    return fieldObj._type;
  }

  // Try constructor name
  const constructor =
    (field as { constructor?: { name?: string } }).constructor;
  if (constructor?.name) {
    return constructor.name;
  }

  return null;
}

/**
 * Get field options (maxLength, etc.)
 */
function getFieldOptions(field: unknown): Record<string, unknown> {
  if (!field || typeof field !== "object") {
    return {};
  }
  const fieldObj = field as Record<string, unknown>;
  return {
    maxLength: fieldObj._maxLength ?? fieldObj.maxLength,
    primaryKey: fieldObj._primaryKey ?? fieldObj.primaryKey,
    null: fieldObj._null ?? fieldObj.null,
    blank: fieldObj._blank ?? fieldObj.blank,
    default: fieldObj._default ?? fieldObj.default,
    unique: fieldObj._unique ?? fieldObj.unique,
    dbIndex: fieldObj._dbIndex ?? fieldObj.dbIndex,
    precision: fieldObj._precision ?? fieldObj.precision,
    scale: fieldObj._scale ?? fieldObj.scale,
    relatedModel: fieldObj._relatedModel ?? fieldObj.relatedModel,
    onDelete: fieldObj._onDelete ?? fieldObj.onDelete,
  };
}

// ============================================================================
// PostgreSQL Schema Editor
// ============================================================================

/**
 * Schema editor for PostgreSQL
 *
 * Creates and modifies database schema using DDL statements.
 */
export class PostgresSchemaEditor implements SchemaEditor {
  private _pool: Pool;
  private _schema: string;

  constructor(pool: Pool, schema = "public") {
    this._pool = pool;
    this._schema = schema;
  }

  /**
   * Quote an identifier (table/column name)
   */
  private quote(name: string): string {
    return `"${name}"`;
  }

  /**
   * Get fully qualified table name
   */
  private qualifiedTable(tableName: string): string {
    return `"${this._schema}"."${tableName}"`;
  }

  /**
   * Create a table for a model
   */
  async createTable(model: typeof Model): Promise<void> {
    const tableName = model.getTableName();
    // deno-lint-ignore no-explicit-any
    const instance = new (model as any)();
    const columns: string[] = [];
    const constraints: string[] = [];

    // Get all field definitions from the instance
    for (const [fieldName, field] of Object.entries(instance)) {
      if (fieldName.startsWith("_") || fieldName === "pk") {
        continue;
      }

      const fieldType = getFieldType(field);
      if (!fieldType) {
        continue;
      }

      const columnDef = this.buildColumnDefinition(fieldName, fieldType, field);
      if (columnDef) {
        columns.push(columnDef);
      }

      // Handle foreign key constraints
      if (fieldType === "ForeignKey" || fieldType === "OneToOneField") {
        const options = getFieldOptions(field);
        if (options.relatedModel) {
          const relatedTable = this.getRelatedTableName(
            options.relatedModel as string,
          );
          const onDelete = this.mapOnDelete(options.onDelete as string);
          constraints.push(
            `CONSTRAINT "fk_${tableName}_${fieldName}" ` +
              `FOREIGN KEY ("${fieldName}_id") REFERENCES ${
                this.qualifiedTable(relatedTable)
              }("id") ` +
              `ON DELETE ${onDelete}`,
          );
        }
      }
    }

    if (columns.length === 0) {
      throw new Error(`Model ${model.name} has no valid fields`);
    }

    const allParts = [...columns, ...constraints];
    const sql = `CREATE TABLE IF NOT EXISTS ${
      this.qualifiedTable(tableName)
    } (\n  ${allParts.join(",\n  ")}\n)`;

    await this._pool.query(sql);
  }

  /**
   * Build column definition for a field
   */
  private buildColumnDefinition(
    fieldName: string,
    fieldType: string,
    field: unknown,
  ): string | null {
    const options = getFieldOptions(field);
    let columnName = fieldName;
    let sqlType = FIELD_TYPE_MAP[fieldType];

    if (!sqlType) {
      // Unknown field type - skip
      return null;
    }

    // Handle ForeignKey column naming
    if (fieldType === "ForeignKey" || fieldType === "OneToOneField") {
      columnName = `${fieldName}_id`;
      sqlType = "INTEGER";
      if (fieldType === "OneToOneField") {
        sqlType += " UNIQUE";
      }
    }

    // Handle VARCHAR with maxLength
    if (fieldType === "CharField" && options.maxLength) {
      sqlType = `VARCHAR(${options.maxLength})`;
    }

    // Handle NUMERIC with precision/scale
    if (fieldType === "DecimalField") {
      const precision = options.precision ?? 10;
      const scale = options.scale ?? 2;
      sqlType = `NUMERIC(${precision}, ${scale})`;
    }

    // Handle check constraints in type (like PositiveIntegerField)
    if (sqlType.includes("{column}")) {
      sqlType = sqlType.replace(/{column}/g, this.quote(columnName));
    }

    // Build column definition
    const parts: string[] = [this.quote(columnName), sqlType];

    // Add constraints
    if (options.null === false && !options.primaryKey) {
      parts.push("NOT NULL");
    }

    if (options.unique && !fieldType.includes("AutoField")) {
      parts.push("UNIQUE");
    }

    if (options.default !== undefined && options.default !== null) {
      const defaultValue = this.formatDefault(options.default, fieldType);
      if (defaultValue !== null) {
        parts.push(`DEFAULT ${defaultValue}`);
      }
    }

    return parts.join(" ");
  }

  /**
   * Format a default value for SQL
   */
  private formatDefault(value: unknown, fieldType: string): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    // Handle callable defaults (like Date.now)
    if (typeof value === "function") {
      if (fieldType === "DateTimeField") {
        return "CURRENT_TIMESTAMP";
      }
      if (fieldType === "DateField") {
        return "CURRENT_DATE";
      }
      if (fieldType === "TimeField") {
        return "CURRENT_TIME";
      }
      if (fieldType === "UUIDField") {
        return "gen_random_uuid()";
      }
      return null;
    }

    if (typeof value === "string") {
      return `'${value.replace(/'/g, "''")}'`;
    }

    if (typeof value === "number") {
      return String(value);
    }

    if (typeof value === "boolean") {
      return value ? "TRUE" : "FALSE";
    }

    if (value instanceof Date) {
      return `'${value.toISOString()}'`;
    }

    if (typeof value === "object") {
      return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
    }

    return null;
  }

  /**
   * Get table name from related model name
   */
  private getRelatedTableName(modelName: string): string {
    // Remove "Model" suffix and convert to lowercase
    return modelName.replace(/Model$/, "").toLowerCase();
  }

  /**
   * Map onDelete option to SQL constraint
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
   * Drop a table for a model
   */
  async dropTable(model: typeof Model): Promise<void> {
    const tableName = model.getTableName();
    await this._pool.query(
      `DROP TABLE IF EXISTS ${this.qualifiedTable(tableName)} CASCADE`,
    );
  }

  /**
   * Add a field to an existing table
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

    await this._pool.query(
      `ALTER TABLE ${this.qualifiedTable(tableName)} ADD COLUMN ${columnDef}`,
    );

    // Add foreign key constraint if needed
    if (fieldType === "ForeignKey" || fieldType === "OneToOneField") {
      const options = getFieldOptions(field);
      if (options.relatedModel) {
        const relatedTable = this.getRelatedTableName(
          options.relatedModel as string,
        );
        const onDelete = this.mapOnDelete(options.onDelete as string);
        await this._pool.query(
          `ALTER TABLE ${this.qualifiedTable(tableName)} ` +
            `ADD CONSTRAINT "fk_${tableName}_${fieldName}" ` +
            `FOREIGN KEY ("${fieldName}_id") REFERENCES ${
              this.qualifiedTable(relatedTable)
            }("id") ` +
            `ON DELETE ${onDelete}`,
        );
      }
    }
  }

  /**
   * Remove a field from a table
   */
  async removeField(model: typeof Model, fieldName: string): Promise<void> {
    const tableName = model.getTableName();

    // Drop any associated constraint first
    await this._pool.query(
      `ALTER TABLE ${this.qualifiedTable(tableName)} ` +
        `DROP CONSTRAINT IF EXISTS "fk_${tableName}_${fieldName}"`,
    );

    // Check if this is a ForeignKey (column name would be fieldName_id)
    // deno-lint-ignore no-explicit-any
    const instance = new (model as any)();
    const field = (instance as Record<string, unknown>)[fieldName];
    const fieldType = getFieldType(field);
    const columnName =
      (fieldType === "ForeignKey" || fieldType === "OneToOneField")
        ? `${fieldName}_id`
        : fieldName;

    await this._pool.query(
      `ALTER TABLE ${
        this.qualifiedTable(tableName)
      } DROP COLUMN IF EXISTS "${columnName}"`,
    );
  }

  /**
   * Create an index
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

    await this._pool.query(
      `CREATE ${unique}INDEX IF NOT EXISTS "${indexName}" ON ${
        this.qualifiedTable(tableName)
      } (${columns})`,
    );
  }

  /**
   * Drop an index
   */
  async dropIndex(_model: typeof Model, indexName: string): Promise<void> {
    await this._pool.query(
      `DROP INDEX IF EXISTS "${this._schema}"."${indexName}"`,
    );
  }

  /**
   * Check if a table exists
   */
  async tableExists(tableName: string): Promise<boolean> {
    const result = await this._pool.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = $1 AND table_name = $2
      )`,
      [this._schema, tableName],
    );
    return result.rows[0]?.exists === true;
  }

  /**
   * Get all tables in the schema
   */
  async getTables(): Promise<string[]> {
    const result = await this._pool.query(
      `SELECT table_name FROM information_schema.tables 
       WHERE table_schema = $1 AND table_type = 'BASE TABLE'
       ORDER BY table_name`,
      [this._schema],
    );
    return result.rows.map((row: { table_name: string }) => row.table_name);
  }

  /**
   * Get column information for a table
   */
  async getColumns(tableName: string): Promise<
    Array<{
      name: string;
      type: string;
      nullable: boolean;
      default: string | null;
    }>
  > {
    const result = await this._pool.query(
      `SELECT 
        column_name as name,
        data_type as type,
        is_nullable = 'YES' as nullable,
        column_default as default
       FROM information_schema.columns 
       WHERE table_schema = $1 AND table_name = $2
       ORDER BY ordinal_position`,
      [this._schema, tableName],
    );
    return result.rows;
  }
}
