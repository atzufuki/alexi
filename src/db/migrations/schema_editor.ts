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
// Operation Log Types
// ============================================================================

/**
 * Represents a single schema operation recorded during `forwards()`.
 *
 * The executor uses this log to automatically derive `backwards()` by
 * replaying operations in reverse order with their inverse counterparts.
 *
 * @category Migrations
 */
export type ForwardsOp =
  | { type: "createModel"; model: typeof Model }
  | {
    type: "deprecateModel";
    model: typeof Model;
    tableName: string;
  }
  | {
    type: "addField";
    model: typeof Model;
    fieldName: string;
    field: AnyField;
  }
  | { type: "deprecateField"; model: typeof Model; fieldName: string }
  | {
    type: "alterField";
    model: typeof Model;
    fieldName: string;
    newField: AnyField;
    options?: AlterFieldOptions;
  }
  | {
    type: "createIndex";
    model: typeof Model;
    fields: string[];
    options?: CreateIndexOptions;
    resolvedIndexName?: string;
  }
  | { type: "dropIndex"; model: typeof Model; indexName: string }
  | { type: "executeSQL"; sql: string; params?: unknown[] };

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
  columnExists(tableName: string, columnName: string): Promise<boolean>;

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
  private _recordOnly: boolean;
  private _verbosity: number;
  private _deprecations: DeprecationInfo[] = [];
  private _statements: SQLStatement[] = [];
  private _operationLog: ForwardsOp[] = [];

  constructor(
    backend: DatabaseBackend,
    backendEditor: IBackendSchemaEditor,
    migrationName: string,
    options?: { dryRun?: boolean; verbosity?: number; recordOnly?: boolean },
  ) {
    this._backend = backend;
    this._backendEditor = backendEditor;
    this._migrationName = migrationName;
    this._dryRun = options?.dryRun ?? false;
    this._recordOnly = options?.recordOnly ?? false;
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
    if (!this._recordOnly) {
      await this._backendEditor.createTable(model);
    }
    this._operationLog.push({ type: "createModel", model });
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

    if (!this._recordOnly) {
      // If a stale deprecated artifact from a prior rollback cycle exists,
      // drop it before renaming so that repeated rollbacks don't fail.
      const staleExists = await this._backendEditor.tableExists(deprecatedName);
      if (staleExists) {
        this._logVerbose(
          `  Dropping stale deprecated table ${deprecatedName} from prior rollback`,
        );
        await this._backendEditor.dropTable(deprecatedName);
      }
      await this._backendEditor.renameTable(tableName, deprecatedName);
    }

    const info: DeprecationInfo = {
      type: "model",
      originalName: tableName,
      deprecatedName,
      migrationName: this._migrationName,
      tableName,
      deprecatedAt: new Date(),
    };

    this._deprecations.push(info);
    this._operationLog.push({ type: "deprecateModel", model, tableName });
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

    if (!this._recordOnly) {
      // Check if deprecated table exists
      const exists = await this._backendEditor.tableExists(deprecatedName);
      if (!exists) {
        throw new Error(
          `Cannot restore: deprecated table '${deprecatedName}' does not exist`,
        );
      }

      await this._backendEditor.renameTable(deprecatedName, originalTableName);
    }
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
    if (!this._recordOnly) {
      await this._backendEditor.addColumn(tableName, fieldName, field);
    }
    this._operationLog.push({ type: "addField", model, fieldName, field });
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
    if (!this._recordOnly) {
      await this._backendEditor.dropColumn(tableName, fieldName);
    }
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

    if (!this._recordOnly) {
      // If a stale deprecated artifact from a prior rollback cycle exists,
      // drop it before renaming so that repeated rollbacks don't fail.
      const staleExists = await this._backendEditor.columnExists(
        tableName,
        deprecatedName,
      );
      if (staleExists) {
        this._logVerbose(
          `  Dropping stale deprecated column ${deprecatedName} from prior rollback`,
        );
        await this._backendEditor.dropColumn(tableName, deprecatedName);
      }
      await this._backendEditor.renameColumn(
        tableName,
        fieldName,
        deprecatedName,
      );
    }

    const info: DeprecationInfo = {
      type: "field",
      originalName: fieldName,
      deprecatedName,
      migrationName: this._migrationName,
      tableName,
      deprecatedAt: new Date(),
    };

    this._deprecations.push(info);
    this._operationLog.push({ type: "deprecateField", model, fieldName });
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

    if (!this._recordOnly) {
      await this._backendEditor.renameColumn(
        tableName,
        deprecatedName,
        originalFieldName,
      );
    }
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

    if (!this._recordOnly) {
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

    this._operationLog.push({
      type: "alterField",
      model,
      fieldName,
      newField,
      options,
    });
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
    if (!this._recordOnly) {
      await this._backendEditor.createIndex(tableName, fields, options);
    }

    // Resolve the index name the same way the backend would
    const resolvedIndexName = options?.name ??
      `idx_${tableName}_${fields.join("_")}`;
    this._operationLog.push({
      type: "createIndex",
      model,
      fields,
      options,
      resolvedIndexName,
    });
  }

  /**
   * Drop an index
   *
   * @param _model - Model class (for context)
   * @param indexName - Name of the index to drop
   */
  async dropIndex(_model: typeof Model, indexName: string): Promise<void> {
    this._log(`Dropping index ${indexName}...`);
    if (!this._recordOnly) {
      await this._backendEditor.dropIndex(indexName);
    }
    this._operationLog.push({ type: "dropIndex", model: _model, indexName });
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
    if (!this._recordOnly) {
      await this._backendEditor.executeRaw(sql, params);
    }
    this._operationLog.push({ type: "executeSQL", sql, params });
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
   * Get the operation log recorded during `forwards()`.
   *
   * The executor uses this to automatically derive `backwards()` when
   * the migration does not override it.
   */
  getOperationLog(): ForwardsOp[] {
    return [...this._operationLog];
  }

  /**
   * Returns `true` if the operation log contains any `executeSQL` entries.
   *
   * Raw SQL cannot be automatically reversed. When present, the executor
   * will warn and skip auto-reversal unless `backwards()` is overridden.
   */
  hasRawSQL(): boolean {
    return this._operationLog.some((op) => op.type === "executeSQL");
  }

  /**
   * Automatically reverse all recorded `forwards()` operations.
   *
   * Replays the operation log in reverse order, applying the inverse of
   * each operation:
   *
   * | `forwards()` | auto `backwards()` |
   * |---|---|
   * | `createModel` | `deprecateModel` |
   * | `deprecateModel` | `restoreModel` |
   * | `addField` | `deprecateField` |
   * | `deprecateField` | `restoreField` |
   * | `alterField(new)` | restores original column from deprecated slot |
   * | `createIndex` | `dropIndex` |
   * | `dropIndex` | *(skipped — index definition not available)* |
   * | `executeSQL` | *(skipped — cannot auto-reverse raw SQL)* |
   *
   * @param log - The operation log from the corresponding `forwards()` run.
   * @throws {Error} If the log contains `executeSQL` entries (raw SQL cannot be auto-reversed).
   */
  async autoReverse(log: ForwardsOp[]): Promise<void> {
    const hasSql = log.some((op) => op.type === "executeSQL");
    if (hasSql) {
      throw new Error(
        "Cannot auto-reverse: migration contains executeSQL() calls. " +
          "Override backwards() manually or use DataMigration.",
      );
    }

    // Replay in reverse order
    for (const op of [...log].reverse()) {
      switch (op.type) {
        case "createModel":
          await this.deprecateModel(op.model);
          break;

        case "deprecateModel":
          await this.restoreModel(op.tableName, this._migrationName);
          break;

        case "addField":
          await this.deprecateField(
            op.model,
            this._resolveColumnName(op.fieldName, op.field),
          );
          break;

        case "deprecateField":
          await this.restoreField(op.model, op.fieldName, this._migrationName);
          break;

        case "alterField": {
          // forwards() did:
          //   addColumn(_temp_X, newField)
          //   copyData X → _temp_X
          //   renameColumn X → _deprecated_<mig>_X   (original is now deprecated)
          //   renameColumn _temp_X → X               (new column is now X)
          //
          // backwards() must:
          //   1. Rename current X → another temp slot (so the name is free)
          //   2. Rename _deprecated_<mig>_X → X      (restore original)
          //   3. Deprecate the new-type column under a distinguishable name
          //
          // We use _bwd_<X> as the temp slot.
          const tableName = this._getTableName(op.model);
          const deprecatedName = this._getDeprecatedName(op.fieldName);
          const bwdTempName = `_bwd_${op.fieldName}`;

          // Step 1: park the current (new-type) column aside
          if (!this._recordOnly) {
            await this._backendEditor.renameColumn(
              tableName,
              op.fieldName,
              bwdTempName,
            );
            // Step 2: restore the original column from its deprecated slot
            await this._backendEditor.renameColumn(
              tableName,
              deprecatedName,
              op.fieldName,
            );
            // Step 3: rename the parked new-type column to the deprecated slot
            //         (keeps the data accessible, frees _bwd_ name)
            await this._backendEditor.renameColumn(
              tableName,
              bwdTempName,
              deprecatedName,
            );
          }
          break;
        }

        case "createIndex":
          if (op.resolvedIndexName) {
            await this.dropIndex(op.model, op.resolvedIndexName);
          }
          break;

        case "dropIndex":
          // Index definition is not stored — cannot auto-recreate.
          this._logVerbose(
            `  Skipping auto-reverse of dropIndex(${op.indexName}) — index definition not available`,
          );
          break;

        case "executeSQL":
          // Should never reach here due to the guard above, but satisfies exhaustiveness.
          break;
      }
    }
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

  /**
   * Resolve the actual database column name for a field.
   *
   * `ForeignKey` and `OneToOneField` are stored with an `_id` suffix
   * (e.g. field name `"category"` → column `"category_id"`).
   * All other fields use the field name directly.
   */
  private _resolveColumnName(fieldName: string, field: AnyField): string {
    const typeName = (field as unknown as { _type?: string })._type ??
      (field as unknown as { constructor?: { name?: string } }).constructor
        ?.name;
    if (typeName === "ForeignKey" || typeName === "OneToOneField") {
      return `${fieldName}_id`;
    }
    return fieldName;
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
