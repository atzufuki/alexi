/**
 * IndexedDB Backend implementation for Alexi ORM
 *
 * This backend uses the browser's IndexedDB API for data persistence.
 * IndexedDB is an asynchronous key-value database available in browsers.
 *
 * NOTE: This module requires DOM types. Users should either:
 * - Run in a browser environment
 * - Add "dom" to their TypeScript lib config
 * - Use `/// <reference lib="dom" />` in their entry point
 *
 * @module
 */

// Type declarations for IndexedDB APIs (browser environment)
declare const indexedDB: IDBFactory;
declare interface IDBFactory {
  open(name: string, version?: number): IDBOpenDBRequest;
  deleteDatabase(name: string): IDBOpenDBRequest;
}
declare interface IDBDatabase {
  readonly name: string;
  readonly version: number;
  readonly objectStoreNames: DOMStringList;
  close(): void;
  createObjectStore(
    name: string,
    options?: IDBObjectStoreParameters,
  ): IDBObjectStore;
  deleteObjectStore(name: string): void;
  transaction(
    storeNames: string | string[],
    mode?: IDBTransactionMode,
  ): IDBTransaction;
}
declare interface IDBObjectStoreParameters {
  keyPath?: string | string[] | null;
  autoIncrement?: boolean;
}
declare interface IDBTransaction {
  readonly objectStoreNames: DOMStringList;
  readonly mode: IDBTransactionMode;
  readonly db: IDBDatabase;
  readonly error: DOMException | null;
  objectStore(name: string): IDBObjectStore;
  abort(): void;
  commit(): void;
  oncomplete: ((this: IDBTransaction, ev: Event) => unknown) | null;
  onerror: ((this: IDBTransaction, ev: Event) => unknown) | null;
  onabort: ((this: IDBTransaction, ev: Event) => unknown) | null;
}
declare type IDBTransactionMode = "readonly" | "readwrite" | "versionchange";
declare interface IDBObjectStore {
  readonly name: string;
  readonly keyPath: string | string[] | null;
  readonly indexNames: DOMStringList;
  readonly transaction: IDBTransaction;
  readonly autoIncrement: boolean;
  add(value: unknown, key?: IDBValidKey): IDBRequest<IDBValidKey>;
  clear(): IDBRequest<undefined>;
  count(query?: IDBValidKey | IDBKeyRange): IDBRequest<number>;
  delete(query: IDBValidKey | IDBKeyRange): IDBRequest<undefined>;
  get(query: IDBValidKey | IDBKeyRange): IDBRequest<unknown>;
  getAll(
    query?: IDBValidKey | IDBKeyRange | null,
    count?: number,
  ): IDBRequest<unknown[]>;
  put(value: unknown, key?: IDBValidKey): IDBRequest<IDBValidKey>;
  openCursor(
    query?: IDBValidKey | IDBKeyRange | null,
    direction?: IDBCursorDirection,
  ): IDBRequest<IDBCursorWithValue | null>;
}
declare type IDBCursorDirection = "next" | "nextunique" | "prev" | "prevunique";
declare interface IDBCursor {
  readonly direction: IDBCursorDirection;
  readonly key: IDBValidKey;
  readonly primaryKey: IDBValidKey;
  readonly request: IDBRequest;
  readonly source: IDBObjectStore | IDBIndex;
  advance(count: number): void;
  continue(key?: IDBValidKey): void;
  continuePrimaryKey(key: IDBValidKey, primaryKey: IDBValidKey): void;
  delete(): IDBRequest<undefined>;
  update(value: unknown): IDBRequest<IDBValidKey>;
}
declare interface IDBCursorWithValue extends IDBCursor {
  readonly value: unknown;
}
declare interface IDBIndex {
  readonly name: string;
  readonly objectStore: IDBObjectStore;
  readonly keyPath: string | string[];
  readonly multiEntry: boolean;
  readonly unique: boolean;
}
declare interface IDBRequest<T = unknown> {
  readonly error: DOMException | null;
  readonly result: T;
  readonly source: IDBObjectStore | IDBIndex | IDBCursor | null;
  readonly readyState: IDBRequestReadyState;
  readonly transaction: IDBTransaction | null;
  onsuccess: ((this: IDBRequest<T>, ev: Event) => unknown) | null;
  onerror: ((this: IDBRequest<T>, ev: Event) => unknown) | null;
}
declare interface Event {
  readonly target: EventTarget | null;
  readonly type: string;
  preventDefault(): void;
  stopPropagation(): void;
}
declare interface EventTarget {
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
  dispatchEvent(event: Event): boolean;
}
declare type EventListener = (event: Event) => void;
declare type IDBRequestReadyState = "pending" | "done";
declare interface IDBOpenDBRequest extends IDBRequest<IDBDatabase> {
  onblocked: ((this: IDBOpenDBRequest, ev: Event) => unknown) | null;
  onupgradeneeded:
    | ((this: IDBOpenDBRequest, ev: IDBVersionChangeEvent) => unknown)
    | null;
}
declare interface IDBVersionChangeEvent extends Event {
  readonly oldVersion: number;
  readonly newVersion: number | null;
}
declare type IDBValidKey =
  | number
  | string
  | Date
  | BufferSource
  | IDBValidKey[];
declare interface IDBKeyRange {
  readonly lower: unknown;
  readonly upper: unknown;
  readonly lowerOpen: boolean;
  readonly upperOpen: boolean;
  includes(key: unknown): boolean;
}
declare interface DOMStringList {
  readonly length: number;
  contains(string: string): boolean;
  item(index: number): string | null;
  [index: number]: string;
}

import type { Model } from "../../models/model.ts";
import type {
  Aggregations,
  CompiledQuery,
  ParsedFilter,
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
// IndexedDB Configuration
// ============================================================================

/**
 * IndexedDB-specific configuration
 */
export interface IndexedDBConfig extends DatabaseConfig {
  engine: "indexeddb";
  /** Database version (used for schema migrations) */
  version?: number;
}

// ============================================================================
// IndexedDB Transaction
// ============================================================================

/**
 * Transaction implementation for IndexedDB
 *
 * Note: IndexedDB transactions auto-commit when all requests complete.
 * This wrapper tracks operations and commits them together.
 */
class IndexedDBTransaction implements Transaction {
  private _db: IDBDatabase;
  private _operations: Array<{
    type: "put" | "delete";
    storeName: string;
    key?: IDBValidKey;
    value?: unknown;
  }> = [];
  private _active = true;

  constructor(db: IDBDatabase) {
    this._db = db;
  }

  get isActive(): boolean {
    return this._active;
  }

  /**
   * Queue a put operation
   */
  queuePut(storeName: string, value: unknown, key?: IDBValidKey): void {
    this._operations.push({ type: "put", storeName, value, key });
  }

  /**
   * Queue a delete operation
   */
  queueDelete(storeName: string, key: IDBValidKey): void {
    this._operations.push({ type: "delete", storeName, key });
  }

  // deno-lint-ignore require-await
  async commit(): Promise<void> {
    if (!this._active) {
      throw new Error("Transaction is no longer active");
    }

    // Group operations by store name
    const storeNames = [...new Set(this._operations.map((op) => op.storeName))];

    if (storeNames.length === 0) {
      this._active = false;
      return;
    }

    // Create a transaction covering all stores
    const tx = this._db.transaction(storeNames, "readwrite");

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => {
        this._active = false;
        resolve();
      };

      tx.onerror = () => {
        this._active = false;
        reject(tx.error);
      };

      tx.onabort = () => {
        this._active = false;
        reject(new Error("IndexedDB transaction aborted"));
      };

      for (const op of this._operations) {
        const store = tx.objectStore(op.storeName);
        if (op.type === "put") {
          if (op.key !== undefined) {
            store.put(op.value, op.key);
          } else {
            store.put(op.value);
          }
        } else {
          store.delete(op.key!);
        }
      }
    });
  }

  // deno-lint-ignore require-await
  async rollback(): Promise<void> {
    // Discard queued operations
    this._operations = [];
    this._active = false;
  }
}

// ============================================================================
// IndexedDB Schema Editor
// ============================================================================

/**
 * Schema editor for IndexedDB
 *
 * Note: IndexedDB schema changes (creating/deleting object stores) can only
 * happen during a version upgrade. This editor tracks pending changes and
 * applies them when the database is reopened with a higher version.
 */
class IndexedDBSchemaEditor implements SchemaEditor {
  private _db: IDBDatabase;
  private _pendingChanges: Array<{
    type: "createStore" | "deleteStore" | "createIndex" | "deleteIndex";
    storeName: string;
    indexName?: string;
    fields?: string[];
    unique?: boolean;
  }> = [];

  constructor(db: IDBDatabase) {
    this._db = db;
  }

  /**
   * Get pending schema changes
   */
  getPendingChanges(): typeof this._pendingChanges {
    return [...this._pendingChanges];
  }

  // deno-lint-ignore require-await
  async createTable(model: typeof Model): Promise<void> {
    const tableName = model.getTableName();

    // Check if store already exists
    if (this._db.objectStoreNames.contains(tableName)) {
      return;
    }

    // Queue the change - will be applied on next version upgrade
    this._pendingChanges.push({
      type: "createStore",
      storeName: tableName,
    });
  }

  // deno-lint-ignore require-await
  async dropTable(model: typeof Model): Promise<void> {
    const tableName = model.getTableName();

    if (!this._db.objectStoreNames.contains(tableName)) {
      return;
    }

    this._pendingChanges.push({
      type: "deleteStore",
      storeName: tableName,
    });
  }

  async addField(_model: typeof Model, _fieldName: string): Promise<void> {
    // No-op for IndexedDB (schema-less within object stores)
  }

  async removeField(_model: typeof Model, _fieldName: string): Promise<void> {
    // No-op for IndexedDB (schema-less within object stores)
  }

  // deno-lint-ignore require-await
  async createIndex(
    model: typeof Model,
    fields: string[],
    options?: { name?: string; unique?: boolean },
  ): Promise<void> {
    const tableName = model.getTableName();
    const indexName = options?.name ?? `${tableName}_${fields.join("_")}_idx`;

    this._pendingChanges.push({
      type: "createIndex",
      storeName: tableName,
      indexName,
      fields,
      unique: options?.unique ?? false,
    });
  }

  // deno-lint-ignore require-await
  async dropIndex(model: typeof Model, indexName: string): Promise<void> {
    const tableName = model.getTableName();

    this._pendingChanges.push({
      type: "deleteIndex",
      storeName: tableName,
      indexName,
    });
  }

  /**
   * Check if there are pending changes that require a version upgrade
   */
  hasPendingChanges(): boolean {
    return this._pendingChanges.length > 0;
  }
}

// ============================================================================
// IndexedDB Backend
// ============================================================================

/**
 * IndexedDB database backend
 *
 * Uses the browser's IndexedDB for persistence.
 * Data is stored in object stores with auto-incrementing IDs.
 *
 * @example
 * ```ts
 * const backend = new IndexedDBBackend({ name: 'myapp', version: 1 });
 * await backend.connect();
 *
 * // Use with models
 * Article.objects.using(backend).all().fetch();
 * ```
 */
export class IndexedDBBackend extends DatabaseBackend {
  private _db: IDBDatabase | null = null;
  private _version: number = 0;
  private _storeNames: Set<string> = new Set();
  private _ensureStoreQueue: Promise<void> = Promise.resolve();

  constructor(
    config: IndexedDBConfig | { name: string; version?: number },
  ) {
    super({
      engine: "indexeddb",
      name: config.name,
      options: {},
    });
    // Version is determined dynamically - we use existing version or 1 for new DBs
  }

  /**
   * Get the IDBDatabase instance
   */
  get db(): IDBDatabase {
    if (!this._db) {
      throw new Error("IndexedDB backend is not connected");
    }
    return this._db;
  }

  /**
   * Get the current database version
   */
  get version(): number {
    return this._version;
  }

  // ============================================================================
  // Connection Management
  // ============================================================================

  async connect(): Promise<void> {
    if (this._connected) {
      return;
    }

    // First, open without version to get current version
    const currentVersion = await this._getCurrentVersion();
    this._version = currentVersion || 1;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this._config.name, this._version);

      request.onerror = () => {
        reject(request.error);
      };

      request.onsuccess = () => {
        this._db = request.result;
        this._connected = true;

        // Track existing store names
        for (let i = 0; i < this._db.objectStoreNames.length; i++) {
          this._storeNames.add(this._db.objectStoreNames[i]);
        }

        // Update version to actual version
        this._version = this._db.version;

        resolve();
      };

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as unknown as IDBOpenDBRequest).result;

        // Create the _meta store for tracking metadata
        if (!db.objectStoreNames.contains("_meta")) {
          db.createObjectStore("_meta", { keyPath: "key" });
        }
      };
    });
  }

  /**
   * Get the current database version without triggering an upgrade
   */
  // deno-lint-ignore require-await
  private async _getCurrentVersion(): Promise<number> {
    return new Promise((resolve) => {
      // Open without version to get current version
      const request = indexedDB.open(this._config.name);

      request.onsuccess = () => {
        const db = request.result;
        const version = db.version;
        db.close();
        resolve(version);
      };

      request.onerror = () => {
        // Database doesn't exist yet
        resolve(0);
      };
    });
  }

  // deno-lint-ignore require-await
  async disconnect(): Promise<void> {
    if (this._db) {
      this._db.close();
      this._db = null;
    }
    this._connected = false;
    this._storeNames.clear();
  }

  /**
   * Ensure an object store exists, creating it if necessary via version upgrade.
   * Calls are serialized via a promise queue to prevent concurrent upgrades from
   * racing to close and reopen the IDB connection.
   *
   * Any caller that needs to use `this._db` after this call must also await
   * `this._ensureStoreQueue` to ensure no concurrent upgrade is in progress.
   */
  async ensureStore(storeName: string): Promise<void> {
    if (this._storeNames.has(storeName)) {
      // Even if this store already exists, wait for any in-flight upgrade to
      // finish before the caller proceeds to use this._db.
      await this._ensureStoreQueue;
      return;
    }

    // Chain onto the existing queue so only one upgrade runs at a time.
    // The double-check inside _doEnsureStore handles the case where a previous
    // queued call already created this store.
    const queued = this._ensureStoreQueue.then(() =>
      this._doEnsureStore(storeName)
    );
    // Keep a reference to the current tail so new callers chain off this.
    this._ensureStoreQueue = queued.catch(() => {});
    return queued;
  }

  /**
   * Internal implementation of ensureStore – must only be called from the
   * serialised queue inside ensureStore().
   */
  // deno-lint-ignore require-await
  private async _doEnsureStore(storeName: string): Promise<void> {
    // Double-check: a previous queued call may have already created the store.
    if (this._storeNames.has(storeName)) {
      return;
    }

    // Need to upgrade the database version to create new store
    const newVersion = this._version + 1;
    this._db?.close();

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this._config.name, newVersion);

      request.onerror = () => {
        reject(request.error);
      };

      request.onsuccess = () => {
        this._db = request.result;
        this._version = newVersion;
        this._storeNames.add(storeName);
        resolve();
      };

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as unknown as IDBOpenDBRequest).result;

        // Create the new object store with auto-incrementing id
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, {
            keyPath: "id",
            autoIncrement: true,
          });
        }

        // Also ensure _meta store exists
        if (!db.objectStoreNames.contains("_meta")) {
          db.createObjectStore("_meta", { keyPath: "key" });
        }
      };
    });
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

    // Ensure the store exists, then wait for all queued upgrades to settle
    // before using this._db (a concurrent upgrade closes/reopens the connection).
    await this.ensureStore(tableName);
    await this._ensureStoreQueue;

    // Resolve nested FK lookups (e.g., projectRole__project = 123)
    const resolvedFilters = await this.resolveNestedFilters(
      state.model,
      state.filters,
    );

    const results: Record<string, unknown>[] = [];

    // Get all records from the store
    const records = await this._getAllFromStore(tableName);

    // Apply resolved filters
    for (const record of records) {
      if (this.matchesFilters(record, resolvedFilters)) {
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

  // deno-lint-ignore require-await
  async executeRaw<R = unknown>(
    _query: string,
    _params?: unknown[],
  ): Promise<R[]> {
    throw new Error(
      "IndexedDB backend does not support raw SQL queries. Use execute() instead.",
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
    await this.ensureStore(tableName);

    const data = instance.toDB();

    // Check unique field constraints before inserting
    await this._validateUniqueFields(instance, data);

    // If id is null/undefined, IndexedDB will auto-generate it
    const hasId = data.id !== null && data.id !== undefined;

    return new Promise((resolve, reject) => {
      const tx = this._db!.transaction(tableName, "readwrite");
      const store = tx.objectStore(tableName);

      let request: IDBRequest<IDBValidKey>;

      if (hasId) {
        request = store.put(data);
      } else {
        // Remove null id so auto-increment works
        const insertData = { ...data };
        delete insertData.id;
        request = store.add(insertData);
      }

      request.onsuccess = () => {
        // Get the generated ID if auto-incremented
        data.id = request.result as unknown;
        resolve(data);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  async update<T extends Model>(instance: T): Promise<void> {
    this.ensureConnected();

    const tableName = instance.getTableName();
    await this.ensureStore(tableName);

    const data = instance.toDB();
    const id = data.id;

    if (id === null || id === undefined) {
      throw new Error("Cannot update a record without an ID");
    }

    // Check unique field constraints before updating (exclude current record)
    await this._validateUniqueFields(instance, data, id);

    return new Promise((resolve, reject) => {
      const tx = this._db!.transaction(tableName, "readwrite");
      const store = tx.objectStore(tableName);
      const request = store.put(data);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Validate unique field constraints before insert/update
   */
  private async _validateUniqueFields<T extends Model>(
    instance: T,
    data: Record<string, unknown>,
    excludeId?: unknown,
  ): Promise<void> {
    const fields = instance.getFields();
    const tableName = instance.getTableName();

    if (!this._storeNames.has(tableName)) {
      return; // Store doesn't exist yet, no conflicts possible
    }

    for (const [fieldName, field] of Object.entries(fields)) {
      if (field.options.unique && !field.options.primaryKey) {
        const value = data[fieldName];
        if (value === null || value === undefined) continue;

        // Check if any existing record has this value
        const allRecords = await new Promise<Record<string, unknown>[]>(
          (resolve, reject) => {
            const tx = this._db!.transaction(tableName, "readonly");
            const store = tx.objectStore(tableName);
            const request = store.getAll();

            request.onsuccess = () => {
              resolve(request.result as Record<string, unknown>[]);
            };

            request.onerror = () => {
              reject(request.error);
            };
          },
        );

        for (const record of allRecords) {
          // Skip the current record if updating
          if (excludeId !== undefined && record.id === excludeId) continue;

          // Check if field value matches (case-insensitive for strings)
          const existingValue = record[fieldName];
          const matches =
            typeof value === "string" && typeof existingValue === "string"
              ? value.toLowerCase() === existingValue.toLowerCase()
              : value === existingValue;

          if (matches) {
            throw new Error(
              `Unique constraint violation: ${fieldName} with value "${value}" already exists in ${tableName}`,
            );
          }
        }
      }
    }
  }

  // deno-lint-ignore require-await
  async delete<T extends Model>(instance: T): Promise<void> {
    this.ensureConnected();

    const tableName = instance.getTableName();
    const id = instance.pk;

    if (id === null || id === undefined) {
      throw new Error("Cannot delete a record without an ID");
    }

    if (!this._storeNames.has(tableName)) {
      return;
    }

    return new Promise((resolve, reject) => {
      const tx = this._db!.transaction(tableName, "readwrite");
      const store = tx.objectStore(tableName);
      const request = store.delete(id as IDBValidKey);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // deno-lint-ignore require-await
  async deleteById(tableName: string, id: unknown): Promise<void> {
    this.ensureConnected();

    if (id === null || id === undefined) {
      throw new Error("Cannot delete a record without an ID");
    }

    if (!this._storeNames.has(tableName)) {
      return;
    }

    return new Promise((resolve, reject) => {
      const tx = this._db!.transaction(tableName, "readwrite");
      const store = tx.objectStore(tableName);
      const request = store.delete(id as IDBValidKey);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // deno-lint-ignore require-await
  async getById<T extends Model>(
    model: new () => T,
    id: unknown,
  ): Promise<Record<string, unknown> | null> {
    this.ensureConnected();

    const instance = new model();
    const tableName = instance.getTableName();

    if (!this._storeNames.has(tableName)) {
      return null;
    }

    return new Promise((resolve, reject) => {
      const tx = this._db!.transaction(tableName, "readonly");
      const store = tx.objectStore(tableName);
      const request = store.get(id as IDBValidKey);

      request.onsuccess = () => {
        resolve((request.result as Record<string, unknown>) ?? null);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  async existsById<T extends Model>(
    model: new () => T,
    id: unknown,
  ): Promise<boolean> {
    const record = await this.getById(model, id);
    return record !== null;
  }

  // ============================================================================
  // Bulk Operations
  // ============================================================================

  async bulkInsert<T extends Model>(
    instances: T[],
  ): Promise<Record<string, unknown>[]> {
    this.ensureConnected();

    if (instances.length === 0) {
      return [];
    }

    const tableName = instances[0].getTableName();
    await this.ensureStore(tableName);

    const results: Record<string, unknown>[] = [];

    return new Promise((resolve, reject) => {
      const tx = this._db!.transaction(tableName, "readwrite");
      const store = tx.objectStore(tableName);

      let completed = 0;
      let hasError = false;

      for (const instance of instances) {
        const data = instance.toDB();
        const hasId = data.id !== null && data.id !== undefined;

        let request: IDBRequest<IDBValidKey>;

        if (hasId) {
          request = store.put(data);
        } else {
          const insertData = { ...data };
          delete insertData.id;
          request = store.add(insertData);
        }

        request.onsuccess = () => {
          if (hasError) return;
          data.id = request.result as unknown;
          results.push(data);
          completed++;

          if (completed === instances.length) {
            resolve(results);
          }
        };

        request.onerror = () => {
          if (hasError) return;
          hasError = true;
          reject(request.error);
        };
      }
    });
  }

  async bulkUpdate<T extends Model>(
    instances: T[],
    _fields: string[],
  ): Promise<number> {
    this.ensureConnected();

    if (instances.length === 0) {
      return 0;
    }

    const tableName = instances[0].getTableName();
    await this.ensureStore(tableName);

    return new Promise((resolve, reject) => {
      const tx = this._db!.transaction(tableName, "readwrite");
      const store = tx.objectStore(tableName);

      let completed = 0;
      let hasError = false;

      for (const instance of instances) {
        const data = instance.toDB();
        const id = data.id;

        if (id === null || id === undefined) {
          continue;
        }

        const request = store.put(data);

        request.onsuccess = () => {
          if (hasError) return;
          completed++;

          if (completed === instances.length) {
            resolve(completed);
          }
        };

        request.onerror = () => {
          if (hasError) return;
          hasError = true;
          reject(request.error);
        };
      }

      // Handle empty valid updates
      if (completed === 0 && instances.length === 0) {
        resolve(0);
      }
    });
  }

  async updateMany<T extends Model>(
    state: QueryState<T>,
    values: Record<string, unknown>,
  ): Promise<number> {
    this.ensureConnected();

    const records = await this.execute(state);
    const instance = new state.model();
    const tableName = instance.getTableName();

    if (records.length === 0) {
      return 0;
    }

    return new Promise((resolve, reject) => {
      const tx = this._db!.transaction(tableName, "readwrite");
      const store = tx.objectStore(tableName);

      let completed = 0;
      let hasError = false;

      for (const record of records) {
        const updated = { ...record, ...values };
        const request = store.put(updated);

        request.onsuccess = () => {
          if (hasError) return;
          completed++;

          if (completed === records.length) {
            resolve(completed);
          }
        };

        request.onerror = () => {
          if (hasError) return;
          hasError = true;
          reject(request.error);
        };
      }
    });
  }

  async deleteMany<T extends Model>(state: QueryState<T>): Promise<number> {
    this.ensureConnected();

    const records = await this.execute(state);
    const instance = new state.model();
    const tableName = instance.getTableName();

    if (records.length === 0) {
      return 0;
    }

    return new Promise((resolve, reject) => {
      const tx = this._db!.transaction(tableName, "readwrite");
      const store = tx.objectStore(tableName);

      let completed = 0;
      let hasError = false;

      for (const record of records) {
        const request = store.delete(record.id as IDBValidKey);

        request.onsuccess = () => {
          if (hasError) return;
          completed++;

          if (completed === records.length) {
            resolve(completed);
          }
        };

        request.onerror = () => {
          if (hasError) return;
          hasError = true;
          reject(request.error);
        };
      }
    });
  }

  // ============================================================================
  // Aggregation
  // ============================================================================

  async count<T extends Model>(state: QueryState<T>): Promise<number> {
    this.ensureConnected();

    const instance = new state.model();
    const tableName = instance.getTableName();

    // Ensure the store exists
    if (!this._storeNames.has(tableName)) {
      return 0;
    }

    const records = await this._getAllFromStore(tableName);
    let count = 0;

    for (const record of records) {
      if (this.matchesFilters(record, state.filters)) {
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

  // deno-lint-ignore require-await
  async beginTransaction(): Promise<Transaction> {
    this.ensureConnected();
    return new IndexedDBTransaction(this._db!);
  }

  // ============================================================================
  // Schema Operations
  // ============================================================================

  getSchemaEditor(): SchemaEditor {
    this.ensureConnected();
    return new IndexedDBSchemaEditor(this._db!);
  }

  // deno-lint-ignore require-await
  async tableExists(tableName: string): Promise<boolean> {
    this.ensureConnected();
    return this._db!.objectStoreNames.contains(tableName);
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
   * Get all records from an object store
   */
  // deno-lint-ignore require-await
  private async _getAllFromStore(
    storeName: string,
  ): Promise<Record<string, unknown>[]> {
    return new Promise((resolve, reject) => {
      const tx = this._db!.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result as Record<string, unknown>[]);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Clear all data from a store
   */
  // deno-lint-ignore require-await
  async clearStore(storeName: string): Promise<void> {
    this.ensureConnected();

    if (!this._storeNames.has(storeName)) {
      return;
    }

    return new Promise((resolve, reject) => {
      const tx = this._db!.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Delete the entire database
   */
  async deleteDatabase(): Promise<void> {
    await this.disconnect();

    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(this._config.name);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };

      request.onblocked = () => {
        reject(new Error("Database deletion blocked - close all connections"));
      };
    });
  }

  // ============================================================================
  // Nested Lookup Support
  // ============================================================================

  /**
   * Execute a simple filter query on a table
   *
   * Used by nested lookup resolution to query related tables.
   *
   * @param tableName - The table name to query
   * @param filters - Filters to apply
   * @returns Matching records
   */
  protected async executeSimpleFilter(
    tableName: string,
    filters: ParsedFilter[],
  ): Promise<Record<string, unknown>[]> {
    this.ensureConnected();

    // Ensure the store exists
    await this.ensureStore(tableName);

    const results: Record<string, unknown>[] = [];

    // Get all records from the store
    const records = await this._getAllFromStore(tableName);

    // Apply filters using the base class method
    for (const record of records) {
      if (this.matchesFilters(record, filters)) {
        results.push(record);
      }
    }

    return results;
  }
}
