/**
 * DenoKV Migration Schema Editor
 *
 * Implements IBackendSchemaEditor for DenoKV with deprecation support.
 *
 * DenoKV is a schemaless key-value store, so "schema" operations are
 * conceptual - they track metadata about the expected data structure.
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

// DenoKV type definitions
interface DenoKv {
  get<T>(key: Deno.KvKey): Promise<{ value: T | null; versionstamp: string }>;
  set(
    key: Deno.KvKey,
    value: unknown,
  ): Promise<{ ok: boolean; versionstamp: string }>;
  delete(key: Deno.KvKey): Promise<void>;
  list<T>(selector: { prefix: Deno.KvKey }): AsyncIterableIterator<{
    key: Deno.KvKey;
    value: T;
    versionstamp: string;
  }>;
}

// ============================================================================
// DenoKV Migration Schema Editor
// ============================================================================

/**
 * DenoKV schema editor for migrations
 *
 * Since DenoKV is schemaless, this editor manages metadata about the
 * expected structure and handles data migrations (renaming keys, etc.).
 *
 * Schema metadata is stored under the `_schema` prefix:
 * - `["_schema", "tables", tableName]` - Table metadata
 * - `["_schema", "columns", tableName, columnName]` - Column metadata
 * - `["_schema", "indexes", indexName]` - Index metadata
 */
export class DenoKVMigrationSchemaEditor implements IBackendSchemaEditor {
  private _kv: DenoKv;
  private _dryRun: boolean;
  private _statements: SQLStatement[] = [];

  constructor(kv: DenoKv, options?: { dryRun?: boolean }) {
    this._kv = kv;
    this._dryRun = options?.dryRun ?? false;
  }

  // ==========================================================================
  // Table Operations
  // ==========================================================================

  async createTable(model: typeof Model): Promise<void> {
    const tableName = model.getTableName();

    this._log(`CREATE TABLE ${tableName}`);

    if (this._dryRun) return;

    // Store table metadata
    await this._kv.set(["_schema", "tables", tableName], {
      name: tableName,
      model: model.name,
      createdAt: new Date().toISOString(),
    });

    // Store column metadata for each field
    // deno-lint-ignore no-explicit-any
    const instance = new (model as any)();
    for (const [fieldName, field] of Object.entries(instance)) {
      if (fieldName.startsWith("_") || fieldName === "pk") continue;
      if (!field || typeof field !== "object") continue;

      await this._kv.set(["_schema", "columns", tableName, fieldName], {
        name: fieldName,
        type:
          (field as { constructor?: { name?: string } }).constructor?.name ??
            "unknown",
      });
    }
  }

  async dropTable(tableName: string): Promise<void> {
    this._log(`DROP TABLE ${tableName}`);

    if (this._dryRun) return;

    // Delete all records in the table
    for await (const entry of this._kv.list({ prefix: [tableName] })) {
      await this._kv.delete(entry.key);
    }

    // Delete column metadata
    for await (
      const entry of this._kv.list({
        prefix: ["_schema", "columns", tableName],
      })
    ) {
      await this._kv.delete(entry.key);
    }

    // Delete table metadata
    await this._kv.delete(["_schema", "tables", tableName]);
  }

  async renameTable(oldName: string, newName: string): Promise<void> {
    this._log(`RENAME TABLE ${oldName} TO ${newName}`);

    if (this._dryRun) return;

    // Move all records from old table to new table
    for await (const entry of this._kv.list({ prefix: [oldName] })) {
      const oldKey = entry.key;
      const newKey = [newName, ...oldKey.slice(1)];

      await this._kv.set(newKey, entry.value);
      await this._kv.delete(oldKey);
    }

    // Update column metadata
    for await (
      const entry of this._kv.list({ prefix: ["_schema", "columns", oldName] })
    ) {
      const columnName = entry.key[3];
      await this._kv.set(
        ["_schema", "columns", newName, columnName],
        entry.value,
      );
      await this._kv.delete(entry.key);
    }

    // Update table metadata
    const oldMeta = await this._kv.get(["_schema", "tables", oldName]);
    if (oldMeta.value) {
      await this._kv.set(["_schema", "tables", newName], {
        ...(oldMeta.value as Record<string, unknown>),
        name: newName,
        renamedFrom: oldName,
        renamedAt: new Date().toISOString(),
      });
      await this._kv.delete(["_schema", "tables", oldName]);
    }
  }

  async tableExists(tableName: string): Promise<boolean> {
    if (this._dryRun) return false;

    const result = await this._kv.get(["_schema", "tables", tableName]);
    return result.value !== null;
  }

  // ==========================================================================
  // Column Operations
  // ==========================================================================

  async addColumn(
    tableName: string,
    columnName: string,
    _field: AnyField,
  ): Promise<void> {
    this._log(`ADD COLUMN ${tableName}.${columnName}`);

    if (this._dryRun) return;

    // Store column metadata
    await this._kv.set(["_schema", "columns", tableName, columnName], {
      name: columnName,
      type: (_field as { constructor?: { name?: string } }).constructor?.name ??
        "unknown",
      addedAt: new Date().toISOString(),
    });

    // DenoKV is schemaless - no need to actually add the column
    // Existing records will just not have this field until updated
  }

  async dropColumn(tableName: string, columnName: string): Promise<void> {
    this._log(`DROP COLUMN ${tableName}.${columnName}`);

    if (this._dryRun) return;

    // Remove column from all records
    for await (
      const entry of this._kv.list<Record<string, unknown>>({
        prefix: [tableName],
      })
    ) {
      if (
        entry.value && typeof entry.value === "object" &&
        columnName in entry.value
      ) {
        const updated = { ...entry.value };
        delete updated[columnName];
        await this._kv.set(entry.key, updated);
      }
    }

    // Delete column metadata
    await this._kv.delete(["_schema", "columns", tableName, columnName]);
  }

  async renameColumn(
    tableName: string,
    oldName: string,
    newName: string,
  ): Promise<void> {
    this._log(`RENAME COLUMN ${tableName}.${oldName} TO ${newName}`);

    if (this._dryRun) return;

    // Rename column in all records
    for await (
      const entry of this._kv.list<Record<string, unknown>>({
        prefix: [tableName],
      })
    ) {
      if (
        entry.value && typeof entry.value === "object" && oldName in entry.value
      ) {
        const updated = { ...entry.value };
        updated[newName] = updated[oldName];
        delete updated[oldName];
        await this._kv.set(entry.key, updated);
      }
    }

    // Update column metadata
    const oldMeta = await this._kv.get([
      "_schema",
      "columns",
      tableName,
      oldName,
    ]);
    if (oldMeta.value) {
      await this._kv.set(["_schema", "columns", tableName, newName], {
        ...(oldMeta.value as Record<string, unknown>),
        name: newName,
        renamedFrom: oldName,
        renamedAt: new Date().toISOString(),
      });
      await this._kv.delete(["_schema", "columns", tableName, oldName]);
    }
  }

  async alterColumn(
    tableName: string,
    columnName: string,
    _field: AnyField,
  ): Promise<void> {
    this._log(`ALTER COLUMN ${tableName}.${columnName}`);

    if (this._dryRun) return;

    // Update column metadata
    const existing = await this._kv.get([
      "_schema",
      "columns",
      tableName,
      columnName,
    ]);
    await this._kv.set(["_schema", "columns", tableName, columnName], {
      ...(existing.value as Record<string, unknown> ?? {}),
      name: columnName,
      type: (_field as { constructor?: { name?: string } }).constructor?.name ??
        "unknown",
      alteredAt: new Date().toISOString(),
    });

    // Note: Actual data transformation would need to be done separately
    // since we don't know how to convert between types automatically
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

    this._log(
      `CREATE INDEX ${indexName} ON ${tableName}(${columns.join(", ")})`,
    );

    if (this._dryRun) return;

    // Store index metadata
    // DenoKV doesn't have native indexes, but we track the intent
    await this._kv.set(["_schema", "indexes", indexName], {
      name: indexName,
      tableName,
      columns,
      unique: options?.unique ?? false,
      createdAt: new Date().toISOString(),
    });

    // For unique indexes, we could create secondary keys
    // This is a conceptual placeholder - actual implementation would
    // depend on the specific indexing strategy
  }

  async dropIndex(indexName: string): Promise<void> {
    this._log(`DROP INDEX ${indexName}`);

    if (this._dryRun) return;

    await this._kv.delete(["_schema", "indexes", indexName]);
  }

  // ==========================================================================
  // Data Operations
  // ==========================================================================

  async copyColumnData(
    tableName: string,
    sourceColumn: string,
    targetColumn: string,
    _transform?: string,
  ): Promise<void> {
    this._log(`COPY DATA ${tableName}.${sourceColumn} TO ${targetColumn}`);

    if (this._dryRun) return;

    // Copy data from source to target column
    for await (
      const entry of this._kv.list<Record<string, unknown>>({
        prefix: [tableName],
      })
    ) {
      if (
        entry.value && typeof entry.value === "object" &&
        sourceColumn in entry.value
      ) {
        const updated = { ...entry.value };
        updated[targetColumn] = updated[sourceColumn];
        // Note: We ignore transform as it's SQL-specific
        // Custom transforms would need to be handled in the migration itself
        await this._kv.set(entry.key, updated);
      }
    }
  }

  // ==========================================================================
  // Constraint Operations
  // ==========================================================================

  async addForeignKey(
    tableName: string,
    columnName: string,
    referencedTable: string,
    referencedColumn: string,
    _onDelete = "CASCADE",
  ): Promise<void> {
    this._log(
      `ADD FK ${tableName}.${columnName} -> ${referencedTable}.${referencedColumn}`,
    );

    if (this._dryRun) return;

    // Store FK metadata (DenoKV doesn't enforce constraints)
    await this._kv.set(
      ["_schema", "constraints", tableName, `fk_${columnName}`],
      {
        type: "foreign_key",
        column: columnName,
        referencedTable,
        referencedColumn,
        createdAt: new Date().toISOString(),
      },
    );
  }

  async dropConstraint(
    tableName: string,
    constraintName: string,
  ): Promise<void> {
    this._log(`DROP CONSTRAINT ${tableName}.${constraintName}`);

    if (this._dryRun) return;

    await this._kv.delete([
      "_schema",
      "constraints",
      tableName,
      constraintName,
    ]);
  }

  // ==========================================================================
  // Raw SQL (No-op for DenoKV)
  // ==========================================================================

  async executeRaw(sql: string, _params?: unknown[]): Promise<void> {
    this._log(`RAW: ${sql}`);
    // DenoKV doesn't support SQL - this is a no-op
    // Log a warning in non-dry-run mode
    if (!this._dryRun) {
      console.warn("executeRaw() is not supported for DenoKV backend");
    }
  }

  // ==========================================================================
  // Generated SQL (for dry-run mode)
  // ==========================================================================

  getGeneratedSQL(): SQLStatement[] {
    return [...this._statements];
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  private _log(operation: string): void {
    this._statements.push({
      sql: operation,
      description: operation,
    });
  }
}
