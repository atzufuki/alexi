/**
 * SQLite Database Backend for Alexi ORM
 *
 * Provides lightweight, file-based SQL database support using
 * `jsr:@db/sqlite` native Deno bindings.
 *
 * Suitable for local development, CI pipelines, single-file deployments,
 * and embedded use cases where a full Postgres server is not available.
 *
 * Requires `--unstable-ffi` at runtime.
 *
 * @example
 * ```ts
 * import { SQLiteBackend } from "@alexi/db/backends/sqlite";
 *
 * // File-based database
 * const backend = new SQLiteBackend({ path: "./data/app.db" });
 * await backend.connect();
 *
 * // In-memory database (tests, ephemeral data)
 * const backend = new SQLiteBackend({ path: ":memory:" });
 * await backend.connect();
 * ```
 *
 * @module
 */

import type { Model } from "../../models/model.ts";
import type {
  Aggregations,
  CompiledQuery,
  ParsedFilter,
  QueryState,
} from "../../query/types.ts";
import {
  DatabaseBackend,
  type SchemaEditor,
  type Transaction,
} from "../backend.ts";
import type { SQLiteConfig } from "./types.ts";
import {
  fromSQLiteValue,
  SQLiteQueryBuilder,
  toSQLiteValue,
} from "./query_builder.ts";
import { SQLiteSchemaEditor } from "./schema_editor.ts";

// ============================================================================
// @db/sqlite driver shim
// ============================================================================

// We import @db/sqlite dynamically so that this module can be type-checked
// without requiring the --unstable-ffi flag at check time.
// deno-lint-ignore no-explicit-any
type SQLiteDatabase = any;

// We load @db/sqlite eagerly using a top-level await so the FFI library is
// fully initialised before Deno's test sanitizer starts tracking resources.
// This prevents false-positive "dynamic library leak" errors in tests.
// The dynamic import (rather than a static import) is intentional: it keeps
// this module type-checkable without --unstable-ffi.
// deno-lint-ignore no-explicit-any
const { Database: _SQLiteDatabase } = await import(
  "jsr:@db/sqlite@0.12"
) as any;

async function openDatabase(path: string): Promise<SQLiteDatabase> {
  return new _SQLiteDatabase(path);
}

// ============================================================================
// SQLite Transaction
// ============================================================================

/**
 * Transaction implementation for SQLite.
 *
 * SQLite uses `BEGIN` / `COMMIT` / `ROLLBACK` statements.
 * Because SQLite connections are single-threaded and serialized,
 * only one transaction may be active at a time.
 *
 * @category Backends
 */
class SQLiteTransaction implements Transaction {
  private _db: SQLiteDatabase;
  private _active = true;

  /** @param db - The open SQLite database handle. */
  constructor(db: SQLiteDatabase) {
    this._db = db;
  }

  /** Whether the transaction is still open. */
  get isActive(): boolean {
    return this._active;
  }

  /** Commit the transaction and release the connection. */
  async commit(): Promise<void> {
    if (!this._active) throw new Error("Transaction is no longer active");
    try {
      this._db.exec("COMMIT");
    } finally {
      this._active = false;
    }
    await Promise.resolve();
  }

  /** Roll back the transaction and release the connection. */
  async rollback(): Promise<void> {
    if (!this._active) throw new Error("Transaction is no longer active");
    try {
      this._db.exec("ROLLBACK");
    } finally {
      this._active = false;
    }
    await Promise.resolve();
  }
}

// ============================================================================
// SQLiteBackend
// ============================================================================

/**
 * SQLite database backend for Alexi ORM.
 *
 * Uses `jsr:@db/sqlite` (native Deno bindings via FFI) for synchronous,
 * file-based SQL storage.  All public API methods are `async` to match the
 * `DatabaseBackend` contract; internally the SQLite driver is synchronous.
 *
 * **Requires:** `--unstable-ffi`
 *
 * @example
 * ```ts
 * import { SQLiteBackend } from "@alexi/db/backends/sqlite";
 * import { setup } from "@alexi/core";
 *
 * await setup({
 *   DATABASES: {
 *     default: new SQLiteBackend({ path: "./data/app.db" }),
 *   },
 * });
 * ```
 *
 * @category Backends
 */
export class SQLiteBackend extends DatabaseBackend {
  private _db: SQLiteDatabase | null = null;
  private _path: string;
  private _debug: boolean;

  /**
   * @param config - SQLite configuration options.
   */
  constructor(config: SQLiteConfig) {
    super({
      engine: config.engine ?? "sqlite",
      name: config.name ?? config.path ?? ":memory:",
    });
    this._path = config.path ?? ":memory:";
    this._debug = config.debug ?? false;
  }

  /**
   * The underlying `@db/sqlite` `Database` instance.
   * Throws if the backend has not been connected yet.
   */
  get db(): SQLiteDatabase {
    if (!this._db) throw new Error("SQLiteBackend is not connected");
    return this._db;
  }

  // ============================================================================
  // Connection Management
  // ============================================================================

  /** Open the SQLite database file (or create it). */
  async connect(): Promise<void> {
    if (this._connected) return;
    this._db = await openDatabase(this._path);
    // Allow table names that start with "sqlite_" (needed for tests and
    // custom schemas). This must be set before any DDL is executed.
    this._db.exec("PRAGMA writable_schema=ON");
    // Enable WAL mode for better concurrent read performance.
    this._db.exec("PRAGMA journal_mode=WAL");
    // Enforce foreign key constraints.
    this._db.exec("PRAGMA foreign_keys=ON");
    this._connected = true;
    if (this._debug) {
      console.log(`[SQLiteBackend] Connected to ${this._path}`);
    }
  }

  /** Close the database connection. */
  async disconnect(): Promise<void> {
    if (this._db) {
      this._db.close();
      this._db = null;
    }
    this._connected = false;
    await Promise.resolve();
    if (this._debug) {
      console.log("[SQLiteBackend] Disconnected");
    }
  }

  // ============================================================================
  // Test Isolation
  // ============================================================================

  /**
   * Create an isolated copy of this SQLite database for `migrate --test`.
   *
   * For file-based databases the `.db` file is copied to a temporary path
   * (`<original>.test-<timestamp>.db`).  A new, connected
   * {@link SQLiteBackend} pointing at the copy is returned.
   *
   * In-memory databases (`:memory:`) are already isolated, so a fresh
   * in-memory backend is returned directly — no file copying needed.
   *
   * @returns A new connected backend backed by the temporary copy.
   */
  override async copyForTest(): Promise<SQLiteBackend> {
    if (this._path === ":memory:") {
      // In-memory: return a fresh isolated backend — no file copy needed.
      const copy = new SQLiteBackend({ path: ":memory:" });
      await copy.connect();
      return copy;
    }

    // Disconnect so the file is fully flushed before copying.
    await this.disconnect();

    const tempPath = `${this._path}.test-${Date.now()}.db`;
    await Deno.copyFile(this._path, tempPath);

    // Reconnect the original backend.
    await this.connect();

    const copy = new SQLiteBackend({ path: tempPath, debug: this._debug });
    await copy.connect();
    (copy as SQLiteBackend & { _tempPath?: string })._tempPath = tempPath;
    return copy;
  }

  /**
   * Destroy this temporary copy created by {@link copyForTest}.
   *
   * Disconnects and removes the temporary `.db` file (and WAL/SHM files if
   * they exist).
   */
  override async destroyTestCopy(): Promise<void> {
    await this.disconnect();
    const tempPath = (this as SQLiteBackend & { _tempPath?: string })._tempPath;
    if (tempPath) {
      for (const suffix of ["", "-wal", "-shm"]) {
        try {
          await Deno.remove(tempPath + suffix);
        } catch {
          // Best-effort cleanup.
        }
      }
    }
  }

  // ============================================================================
  // Query Execution
  // ============================================================================

  /**
   * Execute a QueryState and return matching rows.
   */
  async execute<T extends Model>(
    state: QueryState<T>,
  ): Promise<Record<string, unknown>[]> {
    this.ensureConnected();

    const builder = new SQLiteQueryBuilder(state);
    const compiled = builder.buildSelect();

    if (this._debug) {
      console.log("[SQLiteBackend] Execute:", compiled.sql, compiled.params);
    }

    const rows: Record<string, unknown>[] = this.db.prepare(compiled.sql!).all(
      ...compiled.params,
    );

    return rows.map((row) => this.processRow(row, state.model));
  }

  /**
   * Execute a raw SQL query and return all rows.
   *
   * @param query - SQL string with `?` placeholders.
   * @param params - Positional parameter values.
   */
  async executeRaw<R = unknown>(
    query: string,
    params?: unknown[],
  ): Promise<R[]> {
    this.ensureConnected();

    if (this._debug) {
      console.log("[SQLiteBackend] ExecuteRaw:", query, params);
    }

    return this.db.prepare(query).all(...(params ?? [])) as R[];
  }

  /**
   * Process a database row, converting SQLite storage types to JavaScript types.
   */
  private processRow<T extends Model>(
    row: Record<string, unknown>,
    model: new () => T,
  ): Record<string, unknown> {
    const instance = new model();
    const fields = instance.getFields();
    const processed: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(row)) {
      const field = fields[key];
      const fieldType = field?.constructor?.name;
      processed[key] = fromSQLiteValue(value, fieldType);
    }

    return processed;
  }

  // ============================================================================
  // CRUD Operations
  // ============================================================================

  /**
   * Insert a new model instance into the database.
   *
   * @returns The inserted row data, including the generated primary key.
   */
  async insert<T extends Model>(
    instance: T,
  ): Promise<Record<string, unknown>> {
    this.ensureConnected();

    const tableName = instance.getTableName();
    const data = this.prepareData(instance.toDB());

    // Omit null/undefined id to let SQLite AUTOINCREMENT assign it.
    if (data.id === null || data.id === undefined) {
      delete data.id;
    }

    const compiled = SQLiteQueryBuilder.buildInsert(tableName, data);

    if (this._debug) {
      console.log("[SQLiteBackend] Insert:", compiled.sql, compiled.params);
    }

    this.db.exec(compiled.sql!, compiled.params);

    // Retrieve the auto-generated row id.
    const lastId = this.db.lastInsertRowId;
    const rows: Record<string, unknown>[] = this.db.prepare(
      `SELECT * FROM "${tableName}" WHERE rowid = ?`,
    ).all(lastId);

    return this.processRow(
      rows[0] ?? { ...data, id: lastId },
      instance.constructor as new () => T,
    );
  }

  /**
   * Update all fields of an existing model instance.
   */
  async update<T extends Model>(instance: T): Promise<void> {
    this.ensureConnected();

    const tableName = instance.getTableName();
    const data = this.prepareData(instance.toDB());
    const id = data.id;

    if (id === null || id === undefined) {
      throw new Error("Cannot update a record without an ID");
    }

    delete data.id;

    const compiled = SQLiteQueryBuilder.buildUpdate(tableName, id, data);

    if (this._debug) {
      console.log("[SQLiteBackend] Update:", compiled.sql, compiled.params);
    }

    this.db.exec(compiled.sql!, compiled.params);
    await Promise.resolve();
  }

  /**
   * Update only the specified fields of an existing model instance.
   *
   * @param instance - The model instance containing the updated values.
   * @param fields - Model property names of the fields to write.
   */
  async partialUpdate<T extends Model>(
    instance: T,
    fields: string[],
  ): Promise<void> {
    this.ensureConnected();

    const tableName = instance.getTableName();
    const fullData = this.prepareData(instance.toDB());
    const id = fullData.id;

    if (id === null || id === undefined) {
      throw new Error("Cannot update a record without an ID");
    }

    // Keep only the requested fields.
    const data: Record<string, unknown> = {};
    for (const field of fields) {
      if (field in fullData) {
        data[field] = fullData[field];
      }
    }

    if (Object.keys(data).length === 0) return;

    const compiled = SQLiteQueryBuilder.buildUpdate(tableName, id, data);

    if (this._debug) {
      console.log(
        "[SQLiteBackend] PartialUpdate:",
        compiled.sql,
        compiled.params,
      );
    }

    this.db.exec(compiled.sql!, compiled.params);
    await Promise.resolve();
  }

  /**
   * Delete a model instance from the database.
   */
  async delete<T extends Model>(instance: T): Promise<void> {
    this.ensureConnected();

    const tableName = instance.getTableName();
    const id = instance.pk;

    if (id === null || id === undefined) {
      throw new Error("Cannot delete a record without an ID");
    }

    const compiled = SQLiteQueryBuilder.buildDelete(tableName, id);

    if (this._debug) {
      console.log("[SQLiteBackend] Delete:", compiled.sql, compiled.params);
    }

    this.db.exec(compiled.sql!, compiled.params);
    await Promise.resolve();
  }

  /**
   * Delete a record by its table name and primary key value.
   */
  async deleteById(tableName: string, id: unknown): Promise<void> {
    this.ensureConnected();

    if (id === null || id === undefined) {
      throw new Error("Cannot delete a record without an ID");
    }

    const compiled = SQLiteQueryBuilder.buildDelete(tableName, id);

    if (this._debug) {
      console.log(
        "[SQLiteBackend] DeleteById:",
        compiled.sql,
        compiled.params,
      );
    }

    this.db.exec(compiled.sql!, compiled.params);
    await Promise.resolve();
  }

  /**
   * Prepare model data for SQLite storage (type coercion).
   */
  private prepareData(data: Record<string, unknown>): Record<string, unknown> {
    const prepared: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      prepared[key] = toSQLiteValue(value);
    }
    return prepared;
  }

  // ============================================================================
  // Bulk Operations
  // ============================================================================

  /**
   * Insert multiple model instances in a single transaction.
   *
   * @returns Array of inserted row data (with generated PKs).
   */
  async bulkInsert<T extends Model>(
    instances: T[],
  ): Promise<Record<string, unknown>[]> {
    this.ensureConnected();

    if (instances.length === 0) return [];

    const results: Record<string, unknown>[] = [];

    this.db.exec("BEGIN");
    try {
      for (const instance of instances) {
        const tableName = instance.getTableName();
        const data = this.prepareData(instance.toDB());

        if (data.id === null || data.id === undefined) {
          delete data.id;
        }

        const compiled = SQLiteQueryBuilder.buildInsert(tableName, data);
        this.db.exec(compiled.sql!, compiled.params);

        const lastId = this.db.lastInsertRowId;
        const rows: Record<string, unknown>[] = this.db.prepare(
          `SELECT * FROM "${tableName}" WHERE rowid = ?`,
        ).all(lastId);
        results.push(
          this.processRow(
            rows[0] ?? { ...data, id: lastId },
            instance.constructor as new () => T,
          ),
        );
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }

    return results;
  }

  /**
   * Update multiple model instances in a single transaction.
   *
   * @param instances - The model instances to update.
   * @param _fields - (Unused in SQLite; all fields are updated.)
   * @returns The number of successfully updated records.
   */
  async bulkUpdate<T extends Model>(
    instances: T[],
    _fields: string[],
  ): Promise<number> {
    this.ensureConnected();

    if (instances.length === 0) return 0;

    let count = 0;

    this.db.exec("BEGIN");
    try {
      for (const instance of instances) {
        const tableName = instance.getTableName();
        const data = this.prepareData(instance.toDB());
        const id = data.id;

        if (id !== null && id !== undefined) {
          delete data.id;
          const compiled = SQLiteQueryBuilder.buildUpdate(tableName, id, data);
          this.db.exec(compiled.sql!, compiled.params);
          count++;
        }
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }

    return count;
  }

  /**
   * Update multiple rows matching the QueryState with the given values.
   *
   * @param state - The query filter to match rows.
   * @param values - Column → value map of fields to update.
   * @returns The number of rows updated.
   */
  async updateMany<T extends Model>(
    state: QueryState<T>,
    values: Record<string, unknown>,
  ): Promise<number> {
    this.ensureConnected();

    const preparedValues = this.prepareData(values);
    const builder = new SQLiteQueryBuilder(state);
    const compiled = builder.buildUpdateMany(preparedValues);

    if (this._debug) {
      console.log(
        "[SQLiteBackend] UpdateMany:",
        compiled.sql,
        compiled.params,
      );
    }

    this.db.exec(compiled.sql!, compiled.params);
    return this.db.changes;
  }

  /**
   * Delete multiple rows matching the QueryState.
   *
   * @param state - The query filter to match rows.
   * @returns The number of rows deleted.
   */
  async deleteMany<T extends Model>(state: QueryState<T>): Promise<number> {
    this.ensureConnected();

    const builder = new SQLiteQueryBuilder(state);
    const compiled = builder.buildDeleteMany();

    if (this._debug) {
      console.log(
        "[SQLiteBackend] DeleteMany:",
        compiled.sql,
        compiled.params,
      );
    }

    this.db.exec(compiled.sql!, compiled.params);
    return this.db.changes;
  }

  // ============================================================================
  // Aggregation
  // ============================================================================

  /**
   * Count rows matching the QueryState.
   */
  async count<T extends Model>(state: QueryState<T>): Promise<number> {
    this.ensureConnected();

    const builder = new SQLiteQueryBuilder(state);
    const compiled = builder.buildCount();

    if (this._debug) {
      console.log("[SQLiteBackend] Count:", compiled.sql, compiled.params);
    }

    const rows: Array<{ "COUNT(*)": number }> = this.db.prepare(compiled.sql!)
      .all(...compiled.params);
    return Number(rows[0]?.["COUNT(*)"] ?? 0);
  }

  /**
   * Execute aggregate functions (SUM, AVG, MIN, MAX) on the QueryState.
   *
   * @param state - The query state to filter rows.
   * @param aggregations - Map of alias → aggregation descriptor.
   * @returns Map of alias → numeric result.
   */
  async aggregate<T extends Model>(
    state: QueryState<T>,
    aggregations: Aggregations,
  ): Promise<Record<string, number>> {
    this.ensureConnected();

    const builder = new SQLiteQueryBuilder(state);
    const compiled = builder.buildAggregate(aggregations);

    if (this._debug) {
      console.log(
        "[SQLiteBackend] Aggregate:",
        compiled.sql,
        compiled.params,
      );
    }

    const rows: Record<string, unknown>[] = this.db.prepare(compiled.sql!).all(
      ...compiled.params,
    );
    const row = rows[0] ?? {};

    const results: Record<string, number> = {};
    for (const [key, value] of Object.entries(row)) {
      results[key] = typeof value === "number"
        ? value
        : parseFloat(value as string) || 0;
    }

    return results;
  }

  // ============================================================================
  // Transactions
  // ============================================================================

  /**
   * Begin a new database transaction.
   *
   * @returns A {@link Transaction} handle with `commit()` and `rollback()`.
   */
  async beginTransaction(): Promise<Transaction> {
    this.ensureConnected();
    this.db.exec("BEGIN");
    await Promise.resolve();
    return new SQLiteTransaction(this.db);
  }

  // ============================================================================
  // Schema Operations
  // ============================================================================

  /**
   * Return a {@link SQLiteSchemaEditor} for DDL operations.
   */
  getSchemaEditor(): SchemaEditor {
    this.ensureConnected();
    return new SQLiteSchemaEditor(this.db);
  }

  /**
   * Check whether a table exists in the database.
   *
   * @param tableName - The table name to look up.
   */
  async tableExists(tableName: string): Promise<boolean> {
    this.ensureConnected();

    const rows: Array<{ cnt: number }> = this.db.prepare(
      `SELECT COUNT(*) AS cnt FROM sqlite_master WHERE type='table' AND name=?`,
    ).all(tableName);

    await Promise.resolve();
    return (rows[0]?.cnt ?? 0) > 0;
  }

  // ============================================================================
  // Query Compilation
  // ============================================================================

  /**
   * Compile a QueryState into a {@link CompiledQuery} without executing it.
   *
   * @param state - The QueryState to compile.
   */
  compile<T extends Model>(state: QueryState<T>): CompiledQuery {
    return new SQLiteQueryBuilder(state).buildSelect();
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Retrieve a record by its primary key.
   *
   * @param model - The model class.
   * @param id - The primary key value.
   * @returns The row data, or `null` if not found.
   */
  async getById<T extends Model>(
    model: new () => T,
    id: unknown,
  ): Promise<Record<string, unknown> | null> {
    this.ensureConnected();

    const instance = new model();
    const tableName = instance.getTableName();

    const rows: Record<string, unknown>[] = this.db.prepare(
      `SELECT * FROM "${tableName}" WHERE id = ?`,
    ).all(id);

    await Promise.resolve();
    if (rows.length === 0) return null;
    return this.processRow(rows[0], model);
  }

  /**
   * Check whether a record with the given primary key exists.
   *
   * @param model - The model class.
   * @param id - The primary key value.
   */
  async existsById<T extends Model>(
    model: new () => T,
    id: unknown,
  ): Promise<boolean> {
    this.ensureConnected();

    const instance = new model();
    const tableName = instance.getTableName();

    const rows: Array<{ cnt: number }> = this.db.prepare(
      `SELECT COUNT(*) AS cnt FROM "${tableName}" WHERE id = ?`,
    ).all(id);

    await Promise.resolve();
    return (rows[0]?.cnt ?? 0) > 0;
  }

  /**
   * Execute a simple filter query on a table.
   *
   * Used internally by nested lookup resolution to query related tables.
   *
   * @param tableName - The table to query.
   * @param filters - Exact / in-list filter conditions.
   */
  protected async executeSimpleFilter(
    tableName: string,
    filters: ParsedFilter[],
  ): Promise<Record<string, unknown>[]> {
    this.ensureConnected();

    const conditions: string[] = [];
    const params: unknown[] = [];

    for (const filter of filters) {
      if (filter.lookup === "exact") {
        if (filter.value === null) {
          conditions.push(`"${filter.field}" IS NULL`);
        } else {
          conditions.push(`"${filter.field}" = ?`);
          params.push(filter.value);
        }
      } else if (filter.lookup === "in") {
        if (Array.isArray(filter.value) && filter.value.length > 0) {
          const placeholders = filter.value.map(() => "?").join(", ");
          conditions.push(`"${filter.field}" IN (${placeholders})`);
          params.push(...filter.value);
        }
      }
    }

    let sql = `SELECT * FROM "${tableName}"`;
    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(" AND ")}`;
    }

    await Promise.resolve();
    return this.db.prepare(sql).all(...params);
  }
}
