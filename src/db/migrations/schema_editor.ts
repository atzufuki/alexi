/**
 * Migration Schema Editor
 *
 * Provides schema modification operations for migrations with support for
 * the deprecation model (never delete data, rename to _deprecated_*).
 *
 * @module
 */

import type { Model } from "../models/model.ts";
import type { Field } from "../fields/field.ts";

// Use unknown for generic field type in migration context
// deno-lint-ignore no-explicit-any
type AnyField = Field<any>;
import type { DatabaseBackend } from "../backends/backend.ts";

// ============================================================================
// Types
// ============================================================================

/**
 * Information about a deprecated item
 */
export interface DeprecationInfo {
  /** Type of deprecated item (model, field) */
  type: "model" | "field";
  /** Original name */
  originalName: string;
  /** New deprecated name */
  deprecatedName: string;
  /** Migration that created the deprecation */
  migrationName: string;
  /** Table name (for fields) or original table name (for models) */
  tableName: string;
  /** Timestamp of deprecation */
  deprecatedAt: Date;
}

/**
 * Options for altering a field
 */
export interface AlterFieldOptions {
  /** Custom function to transform data during migration */
  transform?: (oldValue: unknown) => unknown;
  /** Whether to preserve null values (default: true) */
  preserveNulls?: boolean;
}

/**
 * Options for creating an index
 */
export interface CreateIndexOptions {
  /** Custom index name */
  name?: string;
  /** Whether the index should be unique */
  unique?: boolean;
  /** Partial index condition (PostgreSQL only) */
  where?: string;
}

/**
 * SQL statement for logging/dry-run
 */
export interface SQLStatement {
  /** The SQL query */
  sql: string;
  /** Query parameters */
  params?: unknown[];
  /** Description of what this statement does */
  description?: string;
}

// ============================================================================
// Abstract Schema Editor Interface
// ============================================================================

/**
 * Interface for backend-specific schema editors
 *
 * Each database backend must implement this interface to support migrations.
 */
export interface IBackendSchemaEditor {
  // Basic operations
  createTable(model: typeof Model): Promise<void>;
  dropTable(tableName: string): Promise<void>;
  renameTable(oldName: string, newName: string): Promise<void>;
  tableExists(tableName: string): Promise<boolean>;

  // Column operations
  addColumn(
    tableName: string,
    columnName: string,
    field: AnyField,
  ): Promise<void>;
  dropColumn(tableName: string, columnName: string): Promise<void>;
  renameColumn(
    tableName: string,
    oldName: string,
    newName: string,
  ): Promise<void>;
  alterColumn(
    tableName: string,
    columnName: string,
    field: AnyField,
  ): Promise<void>;

  // Index operations
  createIndex(
    tableName: string,
    columns: string[],
    options?: CreateIndexOptions,
  ): Promise<void>;
  dropIndex(indexName: string): Promise<void>;

  // Data operations
  copyColumnData(
    tableName: string,
    sourceColumn: string,
    targetColumn: string,
    transform?: string,
  ): Promise<void>;

  // Constraint operations
  addForeignKey(
    tableName: string,
    columnName: string,
    referencedTable: string,
    referencedColumn: string,
    onDelete?: string,
  ): Promise<void>;
  dropConstraint(tableName: string, constraintName: string): Promise<void>;

  // Utility
  executeRaw(sql: string, params?: unknown[]): Promise<void>;
  getGeneratedSQL(): SQLStatement[];
}

// ============================================================================
// Migration Schema Editor
// ============================================================================

/**
 * Migration Schema Editor
 *
 * High-level API for schema changes in migrations. This wraps backend-specific
 * schema editors and provides the deprecation model.
 *
 * ## Deprecation Model
 *
 * Instead of deleting data, deprecation renames columns/tables:
 * - `deprecateField("email")` → renames column to `_deprecated_0001_email`
 * - `deprecateModel(User)` → renames table to `_deprecated_0001_users`
 *
 * This allows:
 * - Safe rollbacks (data is still there)
 * - Freeing names for reuse
 * - Audit trail of what was deprecated
 *
 * ## AlterField via Deprecation
 *
 * When altering a field type, we use a safe multi-step process:
 * 1. Add new column with the new type
 * 2. Copy data from old column (with optional transform)
 * 3. Deprecate old column
 * 4. Rename new column to original name
 *
 * @example
 * ```ts
 * async forwards(schema: MigrationSchemaEditor): Promise<void> {
 *   // Create a new model
 *   await schema.createModel(UserModel);
 *
 *   // Add a field
 *   await schema.addField(UserModel, "email", new EmailField());
 *
 *   // Alter a field type (safe: uses add/copy/deprecate/rename)
 *   await schema.alterField(UserModel, "age", new CharField({ maxLength: 3 }));
 * }
 *
 * async backwards(schema: MigrationSchemaEditor): Promise<void> {
 *   // Deprecate instead of delete
 *   await schema.deprecateField(UserModel, "email");
 *   await schema.deprecateModel(UserModel);
 * }
 * ```
 */
export class MigrationSchemaEditor {
  private _backend: DatabaseBackend;
  private _backendEditor: IBackendSchemaEditor;
  private _migrationName: string;
  private _dryRun: boolean;
  private _verbosity: number;
  private _deprecations: DeprecationInfo[] = [];
  private _statements: SQLStatement[] = [];

  constructor(
    backend: DatabaseBackend,
    backendEditor: IBackendSchemaEditor,
    migrationName: string,
    options?: { dryRun?: boolean; verbosity?: number },
  ) {
    this._backend = backend;
    this._backendEditor = backendEditor;
    this._migrationName = migrationName;
    this._dryRun = options?.dryRun ?? false;
    this._verbosity = options?.verbosity ?? 1;
  }

  // ==========================================================================
  // Model Operations
  // ==========================================================================

  /**
   * Create a table for a model
   *
   * Creates the table with all fields defined on the model.
   *
   * @param model - Model class (snapshot model with static meta)
   */
  async createModel(model: typeof Model): Promise<void> {
    this._log(`Creating table for ${model.name}...`);
    await this._backendEditor.createTable(model);
    this._logVerbose(`  Created table: ${this._getTableName(model)}`);
  }

  /**
   * Deprecate a model (rename table to _deprecated_*)
   *
   * This preserves all data but frees the table name for reuse.
   *
   * @param model - Model class to deprecate
   * @returns Deprecation info for tracking
   */
  async deprecateModel(model: typeof Model): Promise<DeprecationInfo> {
    const tableName = this._getTableName(model);
    const deprecatedName = this._getDeprecatedName(tableName);

    this._log(`Deprecating model ${model.name}...`);

    await this._backendEditor.renameTable(tableName, deprecatedName);

    const info: DeprecationInfo = {
      type: "model",
      originalName: tableName,
      deprecatedName,
      migrationName: this._migrationName,
      tableName,
      deprecatedAt: new Date(),
    };

    this._deprecations.push(info);
    this._logVerbose(`  Renamed ${tableName} → ${deprecatedName}`);

    return info;
  }

  /**
   * Restore a deprecated model (reverse deprecation)
   *
   * @param originalTableName - Original table name before deprecation
   * @param migrationName - Migration that created the deprecation
   */
  async restoreModel(
    originalTableName: string,
    migrationName?: string,
  ): Promise<void> {
    const deprecatedName = this._getDeprecatedName(
      originalTableName,
      migrationName,
    );

    this._log(`Restoring model ${originalTableName}...`);

    // Check if deprecated table exists
    const exists = await this._backendEditor.tableExists(deprecatedName);
    if (!exists) {
      throw new Error(
        `Cannot restore: deprecated table '${deprecatedName}' does not exist`,
      );
    }

    await this._backendEditor.renameTable(deprecatedName, originalTableName);
    this._logVerbose(`  Renamed ${deprecatedName} → ${originalTableName}`);
  }

  // ==========================================================================
  // Field Operations
  // ==========================================================================

  /**
   * Add a field to an existing model
   *
   * @param model - Model class (snapshot model)
   * @param fieldName - Name of the field to add
   * @param field - Field instance defining the column
   */
  async addField(
    model: typeof Model,
    fieldName: string,
    field: AnyField,
  ): Promise<void> {
    const tableName = this._getTableName(model);

    this._log(`Adding field ${fieldName} to ${model.name}...`);
    await this._backendEditor.addColumn(tableName, fieldName, field);
    this._logVerbose(`  Added column: ${fieldName}`);
  }

  /**
   * Drop a field from a model
   *
   * **Warning:** This permanently deletes the column and its data.
   * Use `deprecateField()` instead if you want to preserve data.
   *
   * This is primarily useful in `backwards()` methods to drop fields
   * that were added in `forwards()`.
   *
   * @param model - Model class
   * @param fieldName - Field name to drop
   */
  async dropField(model: typeof Model, fieldName: string): Promise<void> {
    const tableName = this._getTableName(model);

    this._log(`Dropping field ${fieldName} from ${model.name}...`);
    await this._backendEditor.dropColumn(tableName, fieldName);
    this._logVerbose(`  Dropped column: ${fieldName}`);
  }

  /**
   * Deprecate a field (rename column to _deprecated_*)
   *
   * This preserves the data but frees the column name for reuse.
   *
   * @param model - Model class
   * @param fieldName - Field name to deprecate
   * @returns Deprecation info for tracking
   */
  async deprecateField(
    model: typeof Model,
    fieldName: string,
  ): Promise<DeprecationInfo> {
    const tableName = this._getTableName(model);
    const deprecatedName = this._getDeprecatedName(fieldName);

    this._log(`Deprecating field ${fieldName} on ${model.name}...`);

    await this._backendEditor.renameColumn(
      tableName,
      fieldName,
      deprecatedName,
    );

    const info: DeprecationInfo = {
      type: "field",
      originalName: fieldName,
      deprecatedName,
      migrationName: this._migrationName,
      tableName,
      deprecatedAt: new Date(),
    };

    this._deprecations.push(info);
    this._logVerbose(`  Renamed ${fieldName} → ${deprecatedName}`);

    return info;
  }

  /**
   * Restore a deprecated field (reverse deprecation)
   *
   * @param model - Model class
   * @param originalFieldName - Original field name before deprecation
   * @param migrationName - Migration that created the deprecation (optional)
   */
  async restoreField(
    model: typeof Model,
    originalFieldName: string,
    migrationName?: string,
  ): Promise<void> {
    const tableName = this._getTableName(model);
    const deprecatedName = this._getDeprecatedName(
      originalFieldName,
      migrationName,
    );

    this._log(`Restoring field ${originalFieldName} on ${model.name}...`);

    await this._backendEditor.renameColumn(
      tableName,
      deprecatedName,
      originalFieldName,
    );
    this._logVerbose(`  Renamed ${deprecatedName} → ${originalFieldName}`);
  }

  /**
   * Alter a field's type or constraints
   *
   * Uses the safe deprecation pattern:
   * 1. Add new column with temp name and new type
   * 2. Copy data from old column (with optional transform)
   * 3. Deprecate old column
   * 4. Rename new column to original name
   *
   * @param model - Model class
   * @param fieldName - Field name to alter
   * @param newField - New field definition
   * @param options - Alter options (transform function, etc.)
   */
  async alterField(
    model: typeof Model,
    fieldName: string,
    newField: AnyField,
    options?: AlterFieldOptions,
  ): Promise<void> {
    const tableName = this._getTableName(model);
    const tempName = `_temp_${fieldName}`;

    this._log(`Altering field ${fieldName} on ${model.name}...`);

    // Step 1: Add new column with temporary name
    this._logVerbose(`  Step 1: Adding temp column ${tempName}`);
    await this._backendEditor.addColumn(tableName, tempName, newField);

    // Step 2: Copy data from old column to new column
    this._logVerbose(`  Step 2: Copying data ${fieldName} → ${tempName}`);
    const transform = options?.transform
      ? this._buildTransformExpression(options.transform)
      : undefined;
    await this._backendEditor.copyColumnData(
      tableName,
      fieldName,
      tempName,
      transform,
    );

    // Step 3: Deprecate old column
    this._logVerbose(`  Step 3: Deprecating old column ${fieldName}`);
    const deprecatedName = this._getDeprecatedName(fieldName);
    await this._backendEditor.renameColumn(
      tableName,
      fieldName,
      deprecatedName,
    );

    this._deprecations.push({
      type: "field",
      originalName: fieldName,
      deprecatedName,
      migrationName: this._migrationName,
      tableName,
      deprecatedAt: new Date(),
    });

    // Step 4: Rename temp column to original name
    this._logVerbose(`  Step 4: Renaming ${tempName} → ${fieldName}`);
    await this._backendEditor.renameColumn(tableName, tempName, fieldName);
  }

  // ==========================================================================
  // Index Operations
  // ==========================================================================

  /**
   * Create an index
   *
   * @param model - Model class
   * @param fields - Field names to index
   * @param options - Index options (name, unique, etc.)
   */
  async createIndex(
    model: typeof Model,
    fields: string[],
    options?: CreateIndexOptions,
  ): Promise<void> {
    const tableName = this._getTableName(model);

    this._log(`Creating index on ${model.name}(${fields.join(", ")})...`);
    await this._backendEditor.createIndex(tableName, fields, options);
  }

  /**
   * Drop an index
   *
   * @param _model - Model class (for context)
   * @param indexName - Name of the index to drop
   */
  async dropIndex(_model: typeof Model, indexName: string): Promise<void> {
    this._log(`Dropping index ${indexName}...`);
    await this._backendEditor.dropIndex(indexName);
  }

  // ==========================================================================
  // Raw SQL
  // ==========================================================================

  /**
   * Execute raw SQL
   *
   * Use sparingly - prefer the higher-level methods.
   *
   * @param sql - SQL statement
   * @param params - Query parameters
   */
  async executeSQL(sql: string, params?: unknown[]): Promise<void> {
    this._logVerbose(`Executing SQL: ${sql}`);
    await this._backendEditor.executeRaw(sql, params);
  }

  // ==========================================================================
  // Backend Selection
  // ==========================================================================

  /**
   * Get a schema editor for a specific backend
   *
   * Use this when you need to run backend-specific operations.
   *
   * @param backendName - Name of the backend to use
   * @returns Schema editor for that backend
   *
   * @example
   * ```ts
   * // Run PostgreSQL-specific SQL
   * const pg = schema.using("postgres");
   * await pg.executeSQL("CREATE EXTENSION IF NOT EXISTS pg_trgm");
   * ```
   */
  using(_backendName: string): MigrationSchemaEditor {
    // TODO: Implement backend switching
    // For now, return self (single backend)
    return this;
  }

  // ==========================================================================
  // Utilities
  // ==========================================================================

  /**
   * Get all deprecations created during this migration
   */
  getDeprecations(): DeprecationInfo[] {
    return [...this._deprecations];
  }

  /**
   * Get all SQL statements (for dry-run mode)
   */
  getStatements(): SQLStatement[] {
    return this._backendEditor.getGeneratedSQL();
  }

  /**
   * Get the current backend
   */
  getBackend(): DatabaseBackend {
    return this._backend;
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  private _getTableName(model: typeof Model): string {
    // Check for static meta.dbTable first (snapshot models)
    const meta = (model as unknown as { meta?: { dbTable?: string } }).meta;
    if (meta?.dbTable) {
      return meta.dbTable;
    }
    // Fall back to Model.getTableName() if available
    if (typeof model.getTableName === "function") {
      return model.getTableName();
    }
    // Last resort: lowercase class name
    return model.name.toLowerCase().replace(/model$/i, "");
  }

  private _getDeprecatedName(
    name: string,
    migrationName?: string,
  ): string {
    const migration = migrationName ?? this._migrationName;
    // Extract just the number part (0001 from 0001_initial)
    const migrationNum = migration.split("_")[0];
    return `_deprecated_${migrationNum}_${name}`;
  }

  private _buildTransformExpression(
    _transform: (oldValue: unknown) => unknown,
  ): string {
    // For now, we can't serialize arbitrary JS functions to SQL
    // This would need backend-specific handling
    // TODO: Support common transforms (CAST, COALESCE, etc.)
    throw new Error(
      "Custom transform functions are not yet supported. " +
        "Use executeSQL() for complex transformations.",
    );
  }

  private _log(message: string): void {
    if (this._verbosity >= 1 && !this._dryRun) {
      console.log(message);
    }
  }

  private _logVerbose(message: string): void {
    if (this._verbosity >= 2) {
      console.log(message);
    }
  }
}
