/**
 * SyncBackend - Orchestrates Local and Remote Database Backends
 *
 * Provides transparent synchronization between a local backend (typically
 * IndexedDB) and a remote backend (typically RestBackend). Follows an
 * online-first approach for reads and local-first approach for writes:
 *
 * **Reads (execute, getById, count):**
 * 1. If authenticated → fetch from REST API
 * 2. If offline or unauthenticated → read from local backend
 *
 * **Writes (insert, update, delete):**
 * 1. Write to local backend first (immediate, works offline)
 * 2. Send to REST API (sync with server)
 * 3. Update local with server response (reconcile IDs, timestamps, etc.)
 *
 * @module
 *
 * @example Basic usage
 * ```ts
 * import { IndexedDBBackend } from "@alexi/db/backends/indexeddb";
 * import { RestBackend } from "@alexi/db/backends/rest";
 * import { SyncBackend } from "@alexi/db/backends/sync";
 *
 * const local = new IndexedDBBackend({ name: "myapp" });
 * const remote = new RestBackend({ apiUrl: "https://api.example.com" });
 * const sync = new SyncBackend(local, remote);
 *
 * await sync.connect();
 *
 * // All ORM operations now sync automatically
 * const task = await TaskModel.objects.using(sync).create({ title: "Hello" });
 * ```
 *
 * @example With Alexi setup
 * ```ts
 * import { setup, getBackend, setBackend } from "@alexi/db";
 * import { RestBackend } from "@alexi/db/backends/rest";
 * import { SyncBackend } from "@alexi/db/backends/sync";
 *
 * // 1. Setup local backend
 * await setup({ database: { engine: "indexeddb", name: "myapp" } });
 * const localBackend = getBackend();
 *
 * // 2. Create REST + Sync backends
 * const restBackend = new RestBackend({ apiUrl: "https://api.example.com" });
 * await restBackend.connect();
 * const syncBackend = new SyncBackend(localBackend, restBackend);
 * await syncBackend.connect();
 *
 * // 3. Replace global backend
 * setBackend(syncBackend);
 * ```
 */

import { DatabaseBackend } from "../backend.ts";
import type { SchemaEditor, Transaction } from "../backend.ts";
import type { Model } from "../../models/model.ts";
import type {
  Aggregations,
  CompiledQuery,
  QueryState,
} from "../../query/types.ts";
import { RestApiError } from "../rest/backend.ts";
import type { RestBackend } from "../rest/backend.ts";

// =============================================================================
// Types
// =============================================================================

/**
 * SyncBackend configuration
 */
export interface SyncBackendConfig {
  /** Enable debug logging. Default: `false` */
  debug?: boolean;

  /**
   * When `true`, REST failures during writes are swallowed — the local
   * write succeeds and the remote sync is deferred. When `false`, the
   * local write is rolled back on remote failure.
   *
   * Default: `true` (offline-friendly)
   */
  failSilently?: boolean;
}

/**
 * Result from a sync operation containing local and remote data.
 *
 * Useful for inspecting what happened during a write:
 *
 * ```ts
 * const result: SyncResult = {
 *   local: { id: 1, title: "Hello" },
 *   remote: { id: 42, title: "Hello" },
 *   synced: true,
 * };
 * ```
 */
export interface SyncResult<T = Record<string, unknown>> {
  /** Data from the local backend */
  local: T;
  /** Data from the remote backend (null if offline or failed) */
  remote: T | null;
  /** Whether the remote sync succeeded */
  synced: boolean;
  /** Error if the remote sync failed */
  error?: Error;
}

// =============================================================================
// SyncBackend Class
// =============================================================================

/**
 * SyncBackend - Orchestrates local and remote database operations
 *
 * This backend is fully generic and doesn't contain any application-specific
 * logic. It delegates all actual storage to the local and remote backends.
 *
 * ### Error Handling
 *
 * - **Auth errors (401/403)** are always propagated, even in `failSilently`
 *   mode — the user needs to re-authenticate.
 * - **Network/server errors** are swallowed in `failSilently` mode (default).
 * - **Local errors** are always propagated.
 *
 * ### Limitations
 *
 * - `updateMany` and `deleteMany` only run against the local backend
 *   (REST APIs typically don't support bulk mutation by query).
 * - `aggregate` only runs against the local backend.
 * - `beginTransaction` only runs against the local backend.
 */
export class SyncBackend extends DatabaseBackend {
  private _localBackend: DatabaseBackend;
  private _restBackend: RestBackend;
  private _debug: boolean;
  private _failSilently: boolean;

  constructor(
    localBackend: DatabaseBackend,
    restBackend: RestBackend,
    config: SyncBackendConfig = {},
  ) {
    super({
      engine: "sync",
      name: localBackend.config.name,
    });

    this._localBackend = localBackend;
    this._restBackend = restBackend;
    this._debug = config.debug ?? false;
    this._failSilently = config.failSilently ?? true;
  }

  // ===========================================================================
  // Accessors
  // ===========================================================================

  /** The local backend (typically IndexedDB) */
  get localBackend(): DatabaseBackend {
    return this._localBackend;
  }

  /** The remote REST backend */
  get restBackend(): RestBackend {
    return this._restBackend;
  }

  /**
   * Check if the user is authenticated for remote operations.
   * Delegates to `restBackend.isAuthenticated()`.
   */
  isAuthenticated(): boolean {
    return this._restBackend.isAuthenticated();
  }

  // ===========================================================================
  // Connection Management
  // ===========================================================================

  async connect(): Promise<void> {
    await this._localBackend.connect();
    await this._restBackend.connect();
    this._connected = true;
    this._log("Connected (local + remote)");
  }

  async disconnect(): Promise<void> {
    await this._localBackend.disconnect();
    await this._restBackend.disconnect();
    this._connected = false;
    this._log("Disconnected");
  }

  // ===========================================================================
  // Query Execution
  // ===========================================================================

  /**
   * Execute a query.
   *
   * Strategy:
   * - If authenticated → fetch from REST API
   * - If offline or unauthenticated → read from local backend
   *
   * Auth errors (401/403) are always propagated so the UI can redirect
   * to a login page.
   */
  async execute<T extends Model>(
    state: QueryState<T>,
  ): Promise<Record<string, unknown>[]> {
    if (this._restBackend.isAuthenticated()) {
      try {
        const remoteResults = await this._restBackend.execute(state);

        this._log(`Fetched ${remoteResults.length} records from API`);

        return remoteResults;
      } catch (error) {
        this._log("Remote execute failed, falling back to local:", error);

        // Always propagate auth errors — user needs to re-login
        if (error instanceof RestApiError && error.isAuthError()) {
          throw error;
        }

        if (!this._failSilently && !(error instanceof RestApiError)) {
          throw error;
        }
      }
    }

    return this._localBackend.execute(state);
  }

  async executeRaw<R = unknown>(
    query: string,
    params?: unknown[],
  ): Promise<R[]> {
    return this._localBackend.executeRaw(query, params);
  }

  // ===========================================================================
  // CRUD Operations
  // ===========================================================================

  /**
   * Insert a new record.
   *
   * Strategy:
   * 1. Insert into local DB first (get local ID)
   * 2. POST to REST API
   * 3. Reconcile local record with server response (IDs, timestamps, etc.)
   */
  async insert<T extends Model>(
    instance: T,
  ): Promise<Record<string, unknown>> {
    // Step 1: Insert locally
    const localResult = await this._localBackend.insert(instance);
    const localId = String(localResult.id);

    this._log(`Inserted locally: ${instance.constructor.name}/${localId}`);

    // Step 2: Try to sync to remote
    if (this._restBackend.isAuthenticated()) {
      try {
        const remoteResult = await this._restBackend.insert(instance);
        const remoteId = String(remoteResult.id);

        this._log(`Synced to remote: ${instance.constructor.name}/${remoteId}`);

        // Step 3: Reconcile
        if (
          localId !== remoteId || this._hasNewData(localResult, remoteResult)
        ) {
          await this._reconcileRecord(instance, localId, remoteResult);
          this._log(`Reconciled local record: ${localId} -> ${remoteId}`);
          return remoteResult;
        }

        return remoteResult;
      } catch (error) {
        this._log("Remote insert failed:", error);

        if (!this._failSilently) {
          // Rollback local insert
          try {
            await this._localBackend.delete(instance);
          } catch {
            // Ignore rollback errors
          }
          throw error;
        }
      }
    }

    return localResult;
  }

  /**
   * Update an existing record.
   *
   * Strategy:
   * 1. Update local DB
   * 2. PUT to REST API
   */
  async update<T extends Model>(instance: T): Promise<void> {
    await this._localBackend.update(instance);

    this._log(`Updated locally: ${instance.constructor.name}`);

    if (this._restBackend.isAuthenticated()) {
      try {
        await this._restBackend.update(instance);
        this._log(`Synced update to remote: ${instance.constructor.name}`);
      } catch (error) {
        this._log("Remote update failed:", error);

        if (!this._failSilently) {
          throw error;
        }
      }
    }
  }

  /**
   * Delete a record.
   *
   * Strategy:
   * 1. Delete from local DB
   * 2. DELETE from REST API
   */
  async delete<T extends Model>(instance: T): Promise<void> {
    await this._localBackend.delete(instance);

    this._log(`Deleted locally: ${instance.constructor.name}`);

    if (this._restBackend.isAuthenticated()) {
      try {
        await this._restBackend.delete(instance);
        this._log(`Synced delete to remote: ${instance.constructor.name}`);
      } catch (error) {
        this._log("Remote delete failed:", error);

        if (!this._failSilently) {
          throw error;
        }
      }
    }
  }

  /**
   * Delete a record by table name and ID.
   */
  async deleteById(tableName: string, id: unknown): Promise<void> {
    await this._localBackend.deleteById(tableName, id);

    this._log(`Deleted by ID locally: ${tableName}/${id}`);

    if (this._restBackend.isAuthenticated()) {
      try {
        await this._restBackend.deleteById(tableName, id);
        this._log(`Synced delete by ID to remote: ${tableName}/${id}`);
      } catch (error) {
        this._log("Remote delete by ID failed:", error);

        if (!this._failSilently) {
          throw error;
        }
      }
    }
  }

  /**
   * Get a record by ID.
   *
   * Strategy:
   * - If authenticated → try remote first, fall back to local
   * - If not authenticated → read from local
   */
  async getById<T extends Model>(
    model: new () => T,
    id: unknown,
  ): Promise<Record<string, unknown> | null> {
    if (this._restBackend.isAuthenticated()) {
      try {
        const result = await this._restBackend.getById(model, id);
        if (result) {
          this._log(`Got by ID from remote: ${model.name}/${id}`);
          return result;
        }
      } catch (error) {
        this._log("Remote getById failed, falling back to local:", error);
      }
    }

    return this._localBackend.getById(model, id);
  }

  /**
   * Check if a record exists by ID.
   */
  async existsById<T extends Model>(
    model: new () => T,
    id: unknown,
  ): Promise<boolean> {
    if (this._restBackend.isAuthenticated()) {
      try {
        return await this._restBackend.existsById(model, id);
      } catch {
        // Fall back to local
      }
    }

    return this._localBackend.existsById(model, id);
  }

  // ===========================================================================
  // Bulk Operations
  // ===========================================================================

  async bulkInsert<T extends Model>(
    instances: T[],
  ): Promise<Record<string, unknown>[]> {
    const results: Record<string, unknown>[] = [];

    for (const instance of instances) {
      const result = await this.insert(instance);
      results.push(result);
    }

    return results;
  }

  async bulkUpdate<T extends Model>(
    instances: T[],
    fields: string[],
  ): Promise<number> {
    const count = await this._localBackend.bulkUpdate(instances, fields);

    if (this._restBackend.isAuthenticated()) {
      for (const instance of instances) {
        try {
          await this._restBackend.update(instance);
        } catch (error) {
          this._log("Remote bulk update item failed:", error);

          if (!this._failSilently) {
            throw error;
          }
        }
      }
    }

    return count;
  }

  async updateMany<T extends Model>(
    state: QueryState<T>,
    values: Record<string, unknown>,
  ): Promise<number> {
    // updateMany is complex for sync — delegate to local only
    return this._localBackend.updateMany(state, values);
  }

  async deleteMany<T extends Model>(state: QueryState<T>): Promise<number> {
    // deleteMany is complex for sync — delegate to local only
    return this._localBackend.deleteMany(state);
  }

  // ===========================================================================
  // Aggregation
  // ===========================================================================

  async count<T extends Model>(state: QueryState<T>): Promise<number> {
    if (this._restBackend.isAuthenticated()) {
      try {
        return await this._restBackend.count(state);
      } catch {
        // Fall back to local
      }
    }

    return this._localBackend.count(state);
  }

  async aggregate<T extends Model>(
    state: QueryState<T>,
    aggregations: Aggregations,
  ): Promise<Record<string, number>> {
    return this._localBackend.aggregate(state, aggregations);
  }

  // ===========================================================================
  // Transactions
  // ===========================================================================

  async beginTransaction(): Promise<Transaction> {
    return this._localBackend.beginTransaction();
  }

  // ===========================================================================
  // Schema Operations
  // ===========================================================================

  getSchemaEditor(): SchemaEditor {
    return this._localBackend.getSchemaEditor();
  }

  async tableExists(tableName: string): Promise<boolean> {
    return this._localBackend.tableExists(tableName);
  }

  // ===========================================================================
  // Query Compilation
  // ===========================================================================

  compile<T extends Model>(state: QueryState<T>): CompiledQuery {
    return this._localBackend.compile(state);
  }

  // ===========================================================================
  // Reconciliation Helpers
  // ===========================================================================

  /**
   * Check if the remote result contains new/different data compared to local.
   */
  private _hasNewData(
    local: Record<string, unknown>,
    remote: Record<string, unknown>,
  ): boolean {
    for (const key of Object.keys(remote)) {
      if (key === "id") continue;

      const localVal = local[key];
      const remoteVal = remote[key];

      if (JSON.stringify(localVal) !== JSON.stringify(remoteVal)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Reconcile a local record with the server response.
   *
   * Updates the local record with server-provided data such as:
   * - Server-generated ID (if different from local auto-increment)
   * - Server timestamps (createdAt, updatedAt)
   * - Any computed fields
   */
  private async _reconcileRecord<T extends Model>(
    instance: T,
    localId: string,
    remoteData: Record<string, unknown>,
  ): Promise<void> {
    const modelClass = instance.constructor as typeof Model;
    const remoteId = String(remoteData.id);

    if (localId !== remoteId) {
      // IDs differ: delete old local record, insert with remote data
      try {
        await this._localBackend.delete(instance);
      } catch {
        // May already be gone
      }

      const newInstance = new (modelClass as unknown as new () => T)();
      this._applyDataToInstance(newInstance, remoteData);
      await this._localBackend.insert(newInstance);
    } else {
      // Same ID: update with remote data
      this._applyDataToInstance(instance, remoteData);
      await this._localBackend.update(instance);
    }
  }

  /**
   * Apply a data record to a model instance by calling `.set()` on each field.
   */
  private _applyDataToInstance<T extends Model>(
    instance: T,
    data: Record<string, unknown>,
  ): void {
    const fields = instance as unknown as Record<
      string,
      { set(value: unknown): void }
    >;

    for (const [key, value] of Object.entries(data)) {
      const field = fields[key];
      if (field && typeof field.set === "function") {
        try {
          field.set(value);
        } catch {
          // Field might not support this value type
        }
      }
    }
  }

  // ===========================================================================
  // Logging
  // ===========================================================================

  private _log(...args: unknown[]): void {
    if (this._debug) {
      console.log("[SyncBackend]", ...args);
    }
  }
}
