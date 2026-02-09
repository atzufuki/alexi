/**
 * DenoKV Backend implementation for Alexi ORM
 *
 * This backend uses Deno's built-in KV store for data persistence.
 * DenoKV is a key-value database that supports atomic operations.
 *
 * NOTE: This module requires `--unstable-kv` flag when running Deno.
 * Users should add `"lib": ["deno.ns", "deno.unstable"]` to their
 * deno.json compilerOptions if they want type checking to pass.
 *
 * @module
 */

// Type declarations for Deno KV (unstable API)
// These allow the module to compile without --unstable-kv flag
declare namespace Deno {
  export interface Kv {
    get<T>(key: KvKey): Promise<KvEntryMaybe<T>>;
    set(key: KvKey, value: unknown): Promise<KvCommitResult>;
    delete(key: KvKey): Promise<void>;
    list<T>(
      selector: KvListSelector,
      options?: KvListOptions,
    ): KvListIterator<T>;
    atomic(): AtomicOperation;
    close(): void;
  }

  export type KvKey = readonly KvKeyPart[];
  export type KvKeyPart = string | number | bigint | boolean | Uint8Array;

  export interface KvEntry<T> {
    key: KvKey;
    value: T;
    versionstamp: string;
  }

  export interface KvEntryMaybe<T> {
    key: KvKey;
    value: T | null;
    versionstamp: string | null;
  }

  export interface KvCommitResult {
    ok: true;
    versionstamp: string;
  }

  export interface KvListSelector {
    prefix?: KvKey;
    start?: KvKey;
    end?: KvKey;
  }

  export interface KvListOptions {
    limit?: number;
    cursor?: string;
    reverse?: boolean;
    consistency?: "strong" | "eventual";
    batchSize?: number;
  }

  export interface KvListIterator<T> extends AsyncIterableIterator<KvEntry<T>> {
    cursor: string;
  }

  export interface AtomicOperation {
    check(...checks: AtomicCheck[]): this;
    set(key: KvKey, value: unknown): this;
    delete(key: KvKey): this;
    sum(key: KvKey, n: bigint): this;
    min(key: KvKey, n: bigint): this;
    max(key: KvKey, n: bigint): this;
    commit(): Promise<KvCommitResult>;
  }

  export interface AtomicCheck {
    key: KvKey;
    versionstamp: string | null;
  }

  export function openKv(path?: string): Promise<Kv>;
}

import type { Model } from "../../models/model.ts";
import type {
  Aggregations,
  CompiledQuery,
  QueryOperation,
  QueryState,
} from "../../query/types.ts";
import {
  DatabaseBackend,
  type DatabaseConfig,
  type SchemaEditor,
  type Transaction,
} from "../backend.ts";

// ============================================================================
// DenoKV Configuration
// ============================================================================

/**
 * DenoKV-specific configuration
 */
export interface DenoKVConfig extends DatabaseConfig {
  engine: "denokv";
  /** Path to the KV database file (optional, uses default if not specified) */
  path?: string;
}

// ============================================================================
// DenoKV Transaction
// ============================================================================

/**
 * Transaction implementation for DenoKV
 */
class DenoKVTransaction implements Transaction {
  private _kv: Deno.Kv;
  private _operations: Array<{
    type: "set" | "delete";
    key: Deno.KvKey;
    value?: unknown;
  }> = [];
  private _active = true;

  constructor(kv: Deno.Kv) {
    this._kv = kv;
  }

  get isActive(): boolean {
    return this._active;
  }

  /**
   * Queue a set operation
   */
  queueSet(key: Deno.KvKey, value: unknown): void {
    this._operations.push({ type: "set", key, value });
  }

  /**
   * Queue a delete operation
   */
  queueDelete(key: Deno.KvKey): void {
    this._operations.push({ type: "delete", key });
  }

  async commit(): Promise<void> {
    if (!this._active) {
      throw new Error("Transaction is no longer active");
    }

    const atomic = this._kv.atomic();

    for (const op of this._operations) {
      if (op.type === "set") {
        atomic.set(op.key, op.value);
      } else {
        atomic.delete(op.key);
      }
    }

    const result = await atomic.commit();
    this._active = false;

    if (!result || !result.ok) {
      throw new Error("DenoKV atomic transaction failed");
    }
  }

  async rollback(): Promise<void> {
    // DenoKV doesn't have true rollback, we just discard queued operations
    this._operations = [];
    this._active = false;
  }
}

// ============================================================================
// DenoKV Schema Editor
// ============================================================================

/**
 * Schema editor for DenoKV
 *
 * Note: DenoKV is schema-less, so most operations are no-ops.
 * We track "tables" using a metadata key.
 */
class DenoKVSchemaEditor implements SchemaEditor {
  private _kv: Deno.Kv;

  constructor(kv: Deno.Kv) {
    this._kv = kv;
  }

  async createTable(model: typeof Model): Promise<void> {
    const tableName = model.getTableName();
    // Store table metadata
    await this._kv.set(["_meta", "tables", tableName], {
      name: tableName,
      createdAt: new Date().toISOString(),
    });
  }

  async dropTable(model: typeof Model): Promise<void> {
    const tableName = model.getTableName();

    // Delete all records in the table
    const iter = this._kv.list({ prefix: [tableName] });
    const atomic = this._kv.atomic();
    let count = 0;

    for await (const entry of iter) {
      atomic.delete(entry.key);
      count++;

      // Commit in batches to avoid memory issues
      if (count >= 100) {
        await atomic.commit();
        count = 0;
      }
    }

    if (count > 0) {
      await atomic.commit();
    }

    // Delete table metadata
    await this._kv.delete(["_meta", "tables", tableName]);
  }

  async addField(_model: typeof Model, _fieldName: string): Promise<void> {
    // No-op for DenoKV (schema-less)
  }

  async removeField(_model: typeof Model, _fieldName: string): Promise<void> {
    // No-op for DenoKV (schema-less)
  }

  async createIndex(
    model: typeof Model,
    fields: string[],
    options?: { name?: string; unique?: boolean },
  ): Promise<void> {
    const tableName = model.getTableName();
    const indexName = options?.name ?? `${tableName}_${fields.join("_")}_idx`;

    // Store index metadata
    await this._kv.set(["_meta", "indexes", tableName, indexName], {
      fields,
      unique: options?.unique ?? false,
      createdAt: new Date().toISOString(),
    });
  }

  async dropIndex(model: typeof Model, indexName: string): Promise<void> {
    const tableName = model.getTableName();
    await this._kv.delete(["_meta", "indexes", tableName, indexName]);
  }
}

// ============================================================================
// DenoKV Backend
// ============================================================================

/**
 * DenoKV database backend
 *
 * Uses Deno's built-in KV store for persistence.
 * Data is stored with keys in the format: [tableName, id]
 *
 * @example
 * ```ts
 * const backend = new DenoKVBackend({ name: 'myapp' });
 * await backend.connect();
 *
 * // Use with models
 * Article.objects.using(backend).all().fetch();
 * ```
 */
export class DenoKVBackend extends DatabaseBackend {
  private _kv: Deno.Kv | null = null;
  private _idCounters: Map<string, number> = new Map();

  constructor(config: DenoKVConfig | { name: string; path?: string }) {
    super({
      engine: "denokv",
      name: config.name,
      options: { path: (config as DenoKVConfig).path },
    });
  }

  /**
   * Get the KV instance
   */
  get kv(): Deno.Kv {
    if (!this._kv) {
      throw new Error("DenoKV backend is not connected");
    }
    return this._kv;
  }

  // ============================================================================
  // Connection Management
  // ============================================================================

  async connect(): Promise<void> {
    if (this._connected) {
      return;
    }

    const path = this._config.options?.path as string | undefined;
    this._kv = await Deno.openKv(path);
    this._connected = true;
  }

  async disconnect(): Promise<void> {
    if (this._kv) {
      this._kv.close();
      this._kv = null;
    }
    this._connected = false;
  }

  // ============================================================================
  // Query Execution
  // ============================================================================

  async execute<T extends Model>(
    state: QueryState<T>,
  ): Promise<Record<string, unknown>[]> {
    this.ensureConnected();

    const instance = new state.model();
    const tableName = instance.getTableName();
    const results: Record<string, unknown>[] = [];

    // Scan all records in the table
    const iter = this._kv!.list<Record<string, unknown>>({
      prefix: [tableName],
    });

    for await (const entry of iter) {
      const record = entry.value;

      // Apply filters
      if (this.matchesFilters(record, state.filters)) {
        results.push(record);
      }
    }

    // Apply ordering
    const sorted = this.sortRecords(results, state.ordering);

    // Apply limit and offset
    const limited = this.applyLimitOffset(sorted, state.limit, state.offset);

    // Apply field selection if specified
    if (state.selectFields.length > 0) {
      return limited.map((record) => {
        const selected: Record<string, unknown> = {};
        for (const field of state.selectFields) {
          selected[field] = record[field];
        }
        return selected;
      });
    }

    return limited;
  }

  async executeRaw<R = unknown>(
    _query: string,
    _params?: unknown[],
  ): Promise<R[]> {
    throw new Error(
      "DenoKV backend does not support raw SQL queries. Use execute() instead.",
    );
  }

  // ============================================================================
  // CRUD Operations
  // ============================================================================

  async insert<T extends Model>(
    instance: T,
  ): Promise<Record<string, unknown>> {
    this.ensureConnected();

    const tableName = instance.getTableName();
    const data = instance.toDB();

    // Generate ID if not provided
    if (data.id === null || data.id === undefined) {
      data.id = await this._generateId(tableName);
    }

    // Store the record
    const key: Deno.KvKey = [tableName, data.id as Deno.KvKeyPart];
    await this._kv!.set(key, data);

    return data;
  }

  async update<T extends Model>(instance: T): Promise<void> {
    this.ensureConnected();

    const tableName = instance.getTableName();
    const data = instance.toDB();
    const id = data.id;

    if (id === null || id === undefined) {
      throw new Error("Cannot update a record without an ID");
    }

    const key: Deno.KvKey = [tableName, id as Deno.KvKeyPart];
    await this._kv!.set(key, data);
  }

  async delete<T extends Model>(instance: T): Promise<void> {
    this.ensureConnected();

    const tableName = instance.getTableName();
    const id = instance.pk;

    if (id === null || id === undefined) {
      throw new Error("Cannot delete a record without an ID");
    }

    const key: Deno.KvKey = [tableName, id as Deno.KvKeyPart];
    await this._kv!.delete(key);
  }

  async deleteById(tableName: string, id: unknown): Promise<void> {
    this.ensureConnected();

    if (id === null || id === undefined) {
      throw new Error("Cannot delete a record without an ID");
    }

    const key: Deno.KvKey = [tableName, id as Deno.KvKeyPart];
    await this._kv!.delete(key);
  }

  // ============================================================================
  // Bulk Operations
  // ============================================================================

  async bulkInsert<T extends Model>(
    instances: T[],
  ): Promise<Record<string, unknown>[]> {
    this.ensureConnected();

    const results: Record<string, unknown>[] = [];
    const atomic = this._kv!.atomic();

    for (const instance of instances) {
      const tableName = instance.getTableName();
      const data = instance.toDB();

      // Generate ID if not provided
      if (data.id === null || data.id === undefined) {
        data.id = await this._generateId(tableName);
      }

      const key: Deno.KvKey = [tableName, data.id as Deno.KvKeyPart];
      atomic.set(key, data);
      results.push(data);
    }

    const result = await atomic.commit();
    if (!result || !result.ok) {
      throw new Error("DenoKV bulk insert failed");
    }

    return results;
  }

  async bulkUpdate<T extends Model>(
    instances: T[],
    _fields: string[],
  ): Promise<number> {
    this.ensureConnected();

    const atomic = this._kv!.atomic();

    for (const instance of instances) {
      const tableName = instance.getTableName();
      const data = instance.toDB();
      const id = data.id;

      if (id !== null && id !== undefined) {
        const key: Deno.KvKey = [tableName, id as Deno.KvKeyPart];
        atomic.set(key, data);
      }
    }

    const result = await atomic.commit();
    if (!result || !result.ok) {
      throw new Error("DenoKV bulk update failed");
    }

    return instances.length;
  }

  async updateMany<T extends Model>(
    state: QueryState<T>,
    values: Record<string, unknown>,
  ): Promise<number> {
    this.ensureConnected();

    const records = await this.execute(state);
    const instance = new state.model();
    const tableName = instance.getTableName();
    const atomic = this._kv!.atomic();

    for (const record of records) {
      const updated = { ...record, ...values };
      const key: Deno.KvKey = [tableName, record.id as Deno.KvKeyPart];
      atomic.set(key, updated);
    }

    const result = await atomic.commit();
    if (!result || !result.ok) {
      throw new Error("DenoKV updateMany failed");
    }

    return records.length;
  }

  async deleteMany<T extends Model>(state: QueryState<T>): Promise<number> {
    this.ensureConnected();

    const records = await this.execute(state);
    const instance = new state.model();
    const tableName = instance.getTableName();
    const atomic = this._kv!.atomic();

    for (const record of records) {
      const key: Deno.KvKey = [tableName, record.id as Deno.KvKeyPart];
      atomic.delete(key);
    }

    const result = await atomic.commit();
    if (!result || !result.ok) {
      throw new Error("DenoKV deleteMany failed");
    }

    return records.length;
  }

  // ============================================================================
  // Aggregation
  // ============================================================================

  async count<T extends Model>(state: QueryState<T>): Promise<number> {
    this.ensureConnected();

    const instance = new state.model();
    const tableName = instance.getTableName();
    let count = 0;

    const iter = this._kv!.list<Record<string, unknown>>({
      prefix: [tableName],
    });

    for await (const entry of iter) {
      if (this.matchesFilters(entry.value, state.filters)) {
        count++;
      }
    }

    return count;
  }

  async aggregate<T extends Model>(
    state: QueryState<T>,
    aggregations: Aggregations,
  ): Promise<Record<string, number>> {
    this.ensureConnected();

    const records = await this.execute(state);
    const results: Record<string, number> = {};

    for (const [alias, agg] of Object.entries(aggregations)) {
      switch (agg.func) {
        case "COUNT":
          if (agg.distinct && agg.field !== "*") {
            const uniqueValues = new Set(
              records.map((r) => r[agg.field]).filter((v) => v !== null),
            );
            results[alias] = uniqueValues.size;
          } else if (agg.field === "*") {
            results[alias] = records.length;
          } else {
            results[alias] = records.filter((r) => r[agg.field] !== null)
              .length;
          }
          break;

        case "SUM": {
          const sum = records.reduce((acc, r) => {
            const val = r[agg.field];
            return acc + (typeof val === "number" ? val : 0);
          }, 0);
          results[alias] = sum;
          break;
        }

        case "AVG": {
          const values = records
            .map((r) => r[agg.field])
            .filter((v): v is number => typeof v === "number");
          results[alias] = values.length > 0
            ? values.reduce((a, b) => a + b, 0) / values.length
            : 0;
          break;
        }

        case "MIN": {
          const values = records
            .map((r) => r[agg.field])
            .filter((v): v is number => typeof v === "number");
          results[alias] = values.length > 0 ? Math.min(...values) : 0;
          break;
        }

        case "MAX": {
          const values = records
            .map((r) => r[agg.field])
            .filter((v): v is number => typeof v === "number");
          results[alias] = values.length > 0 ? Math.max(...values) : 0;
          break;
        }
      }
    }

    return results;
  }

  // ============================================================================
  // Transactions
  // ============================================================================

  async beginTransaction(): Promise<Transaction> {
    this.ensureConnected();
    return new DenoKVTransaction(this._kv!);
  }

  // ============================================================================
  // Schema Operations
  // ============================================================================

  getSchemaEditor(): SchemaEditor {
    this.ensureConnected();
    return new DenoKVSchemaEditor(this._kv!);
  }

  async tableExists(tableName: string): Promise<boolean> {
    this.ensureConnected();

    const meta = await this._kv!.get(["_meta", "tables", tableName]);
    return meta.value !== null;
  }

  // ============================================================================
  // Query Compilation
  // ============================================================================

  compile<T extends Model>(state: QueryState<T>): CompiledQuery {
    const instance = new state.model();
    const tableName = instance.getTableName();

    const operation: QueryOperation = {
      type: "select",
      table: tableName,
      filters: state.filters,
      ordering: state.ordering,
      fields: state.selectFields,
      limit: state.limit,
      offset: state.offset,
    };

    return {
      operation,
      params: [],
    };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Generate a unique ID for a table
   */
  private async _generateId(tableName: string): Promise<number> {
    const counterKey: Deno.KvKey = ["_meta", "counters", tableName];

    // Use atomic operation to ensure unique IDs
    let newId: number;

    while (true) {
      const current = await this._kv!.get<number>(counterKey);
      newId = (current.value ?? 0) + 1;

      const result = await this._kv!
        .atomic()
        .check(current)
        .set(counterKey, newId)
        .commit();

      if (result && result.ok) {
        break;
      }
      // Retry if there was a conflict
    }

    return newId;
  }

  /**
   * Get a record by ID directly
   */
  async getById<T extends Model>(
    model: new () => T,
    id: unknown,
  ): Promise<Record<string, unknown> | null> {
    this.ensureConnected();

    const instance = new model();
    const tableName = instance.getTableName();
    const key: Deno.KvKey = [tableName, id as Deno.KvKeyPart];

    const entry = await this._kv!.get<Record<string, unknown>>(key);
    return entry.value;
  }

  /**
   * Check if a record exists by ID
   */
  async existsById<T extends Model>(
    model: new () => T,
    id: unknown,
  ): Promise<boolean> {
    const record = await this.getById(model, id);
    return record !== null;
  }
}
