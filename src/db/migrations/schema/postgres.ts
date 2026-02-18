/**
 * PostgreSQL Migration Schema Editor
 *
 * Implements IBackendSchemaEditor for PostgreSQL with deprecation support.
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

// deno-lint-ignore no-explicit-any
type AnyField = Field<any>;

// Import pg types
import type { Pool } from "npm:pg@8";

// ============================================================================
// Field Type Detection (shared with existing schema_editor.ts)
// ============================================================================

const FIELD_TYPE_MAP: Record<string, string> = {
  AutoField: "SERIAL PRIMARY KEY",
  BigAutoField: "BIGSERIAL PRIMARY KEY",
  SmallAutoField: "SMALLSERIAL PRIMARY KEY",
  IntegerField: "INTEGER",
  BigIntegerField: "BIGINT",
  SmallIntegerField: "SMALLINT",
  PositiveIntegerField: "INTEGER CHECK ({column} >= 0)",
  PositiveSmallIntegerField: "SMALLINT CHECK ({column} >= 0)",
  PositiveBigIntegerField: "BIGINT CHECK ({column} >= 0)",
  FloatField: "DOUBLE PRECISION",
  DecimalField: "NUMERIC",
  CharField: "VARCHAR(255)",
  TextField: "TEXT",
  BooleanField: "BOOLEAN",
  DateField: "DATE",
  DateTimeField: "TIMESTAMP WITH TIME ZONE",
  TimeField: "TIME",
  DurationField: "INTERVAL",
  UUIDField: "UUID",
  BinaryField: "BYTEA",
  JSONField: "JSONB",
  ArrayField: "JSONB",
  ForeignKey: "INTEGER",
  OneToOneField: "INTEGER UNIQUE",
};

function getFieldType(field: unknown): string | null {
  if (!field || typeof field !== "object") {
    return null;
  }
  const fieldObj = field as Record<string, unknown>;
  if (typeof fieldObj._type === "string") {
    return fieldObj._type;
  }
  const constructor =
    (field as { constructor?: { name?: string } }).constructor;
  if (constructor?.name) {
    return constructor.name;
  }
  return null;
}

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
  };
}

// ============================================================================
// PostgreSQL Migration Schema Editor
// ============================================================================

/**
 * PostgreSQL schema editor for migrations
 *
 * Implements all operations needed for the migration system including
 * table/column creation, renaming (for deprecation), and data copying.
 */
export class PostgresMigrationSchemaEditor implements IBackendSchemaEditor {
  private _pool: Pool;
  private _schema: string;
  private _dryRun: boolean;
  private _statements: SQLStatement[] = [];

  constructor(
    pool: Pool,
    options?: { schema?: string; dryRun?: boolean },
  ) {
    this._pool = pool;
    this._schema = options?.schema ?? "public";
    this._dryRun = options?.dryRun ?? false;
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  private quote(name: string): string {
    return `"${name}"`;
  }

  private qualifiedTable(tableName: string): string {
    return `"${this._schema}"."${tableName}"`;
  }

  private async execute(sql: string, params?: unknown[]): Promise<void> {
    this._statements.push({
      sql,
      params,
      description: sql.substring(0, 50) + "...",
    });

    if (!this._dryRun) {
      await this._pool.query(sql, params);
    }
  }

  // ==========================================================================
  // Table Operations
  // ==========================================================================

  async createTable(model: typeof Model): Promise<void> {
    const tableName = model.getTableName();
    // deno-lint-ignore no-explicit-any
    const instance = new (model as any)();
    const columns: string[] = [];
    const constraints: string[] = [];

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
    }

    if (columns.length === 0) {
      throw new Error(`Model ${model.name} has no valid fields`);
    }

    const allParts = [...columns, ...constraints];
    const sql = `CREATE TABLE IF NOT EXISTS ${
      this.qualifiedTable(tableName)
    } (\n  ${allParts.join(",\n  ")}\n)`;

    await this.execute(sql);
  }

  async dropTable(tableName: string): Promise<void> {
    await this.execute(
      `DROP TABLE IF EXISTS ${this.qualifiedTable(tableName)} CASCADE`,
    );
  }

  async renameTable(oldName: string, newName: string): Promise<void> {
    await this.execute(
      `ALTER TABLE ${this.qualifiedTable(oldName)} RENAME TO ${
        this.quote(newName)
      }`,
    );
  }

  async tableExists(tableName: string): Promise<boolean> {
    if (this._dryRun) {
      return false;
    }

    const result = await this._pool.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = $1 AND table_name = $2
      )`,
      [this._schema, tableName],
    );
    return result.rows[0]?.exists === true;
  }

  // ==========================================================================
  // Column Operations
  // ==========================================================================

  async addColumn(
    tableName: string,
    columnName: string,
    field: AnyField,
  ): Promise<void> {
    const fieldType = getFieldType(field);
    if (!fieldType) {
      throw new Error(`Cannot determine type for field ${columnName}`);
    }

    const columnDef = this.buildColumnDefinition(columnName, fieldType, field);
    if (!columnDef) {
      throw new Error(`Cannot build column definition for field ${columnName}`);
    }

    await this.execute(
      `ALTER TABLE ${this.qualifiedTable(tableName)} ADD COLUMN ${columnDef}`,
    );
  }

  async dropColumn(tableName: string, columnName: string): Promise<void> {
    await this.execute(
      `ALTER TABLE ${this.qualifiedTable(tableName)} DROP COLUMN IF EXISTS ${
        this.quote(columnName)
      }`,
    );
  }

  async renameColumn(
    tableName: string,
    oldName: string,
    newName: string,
  ): Promise<void> {
    await this.execute(
      `ALTER TABLE ${this.qualifiedTable(tableName)} RENAME COLUMN ${
        this.quote(oldName)
      } TO ${this.quote(newName)}`,
    );
  }

  async alterColumn(
    tableName: string,
    columnName: string,
    field: AnyField,
  ): Promise<void> {
    const fieldType = getFieldType(field);
    if (!fieldType) {
      throw new Error(`Cannot determine type for field ${columnName}`);
    }

    const options = getFieldOptions(field);
    let sqlType = FIELD_TYPE_MAP[fieldType];

    if (!sqlType) {
      throw new Error(`Unknown field type: ${fieldType}`);
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

    await this.execute(
      `ALTER TABLE ${this.qualifiedTable(tableName)} ALTER COLUMN ${
        this.quote(columnName)
      } TYPE ${sqlType}`,
    );

    // Handle NULL constraint
    if (options.null === false) {
      await this.execute(
        `ALTER TABLE ${this.qualifiedTable(tableName)} ALTER COLUMN ${
          this.quote(columnName)
        } SET NOT NULL`,
      );
    } else if (options.null === true) {
      await this.execute(
        `ALTER TABLE ${this.qualifiedTable(tableName)} ALTER COLUMN ${
          this.quote(columnName)
        } DROP NOT NULL`,
      );
    }
  }

  // ==========================================================================
  // Index Operations
  // ==========================================================================

  async createIndex(
    tableName: string,
    columns: string[],
    options?: CreateIndexOptions,
  ): Promise<void> {
    const indexName = options?.name ?? `idx_${tableName}_${columns.join("_")}`;
    const unique = options?.unique ? "UNIQUE " : "";
    const columnList = columns.map((c) => this.quote(c)).join(", ");

    let sql = `CREATE ${unique}INDEX IF NOT EXISTS ${
      this.quote(indexName)
    } ON ${this.qualifiedTable(tableName)} (${columnList})`;

    if (options?.where) {
      sql += ` WHERE ${options.where}`;
    }

    await this.execute(sql);
  }

  async dropIndex(indexName: string): Promise<void> {
    await this.execute(
      `DROP INDEX IF EXISTS "${this._schema}".${this.quote(indexName)}`,
    );
  }

  // ==========================================================================
  // Data Operations
  // ==========================================================================

  async copyColumnData(
    tableName: string,
    sourceColumn: string,
    targetColumn: string,
    transform?: string,
  ): Promise<void> {
    const source = transform ?? this.quote(sourceColumn);

    await this.execute(
      `UPDATE ${this.qualifiedTable(tableName)} SET ${
        this.quote(targetColumn)
      } = ${source}`,
    );
  }

  // ==========================================================================
  // Constraint Operations
  // ==========================================================================

  async addForeignKey(
    tableName: string,
    columnName: string,
    referencedTable: string,
    referencedColumn: string,
    onDelete = "CASCADE",
  ): Promise<void> {
    const constraintName = `fk_${tableName}_${columnName}`;

    await this.execute(
      `ALTER TABLE ${this.qualifiedTable(tableName)} ` +
        `ADD CONSTRAINT ${this.quote(constraintName)} ` +
        `FOREIGN KEY (${this.quote(columnName)}) ` +
        `REFERENCES ${this.qualifiedTable(referencedTable)}(${
          this.quote(referencedColumn)
        }) ` +
        `ON DELETE ${onDelete}`,
    );
  }

  async dropConstraint(
    tableName: string,
    constraintName: string,
  ): Promise<void> {
    await this.execute(
      `ALTER TABLE ${
        this.qualifiedTable(tableName)
      } DROP CONSTRAINT IF EXISTS ${this.quote(constraintName)}`,
    );
  }

  // ==========================================================================
  // Raw SQL
  // ==========================================================================

  async executeRaw(sql: string, params?: unknown[]): Promise<void> {
    await this.execute(sql, params);
  }

  // ==========================================================================
  // Generated SQL (for dry-run mode)
  // ==========================================================================

  getGeneratedSQL(): SQLStatement[] {
    return [...this._statements];
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

    if (!sqlType) {
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

    // Handle check constraints
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

  private formatDefault(value: unknown, fieldType: string): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    if (typeof value === "function") {
      if (fieldType === "DateTimeField") return "CURRENT_TIMESTAMP";
      if (fieldType === "DateField") return "CURRENT_DATE";
      if (fieldType === "TimeField") return "CURRENT_TIME";
      if (fieldType === "UUIDField") return "gen_random_uuid()";
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
}
