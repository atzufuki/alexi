/**
 * DenoKV Deprecation Recorder
 *
 * Tracks deprecated models and fields using DenoKV.
 * Stores deprecation records under `["_alexi", "deprecations", ...]` prefix.
 *
 * @module
 */

import type { DeprecationInfo } from "../schema_editor.ts";
import type { DeprecationRecord, IDeprecationRecorder } from "./interfaces.ts";

// ============================================================================
// Types
// ============================================================================

/**
 * Minimal DenoKV interface for deprecation tracking
 */
interface KVStore {
  get<T>(
    key: Deno.KvKey,
  ): Promise<{ value: T | null; versionstamp: string | null }>;
  set(
    key: Deno.KvKey,
    value: unknown,
    options?: { expireIn?: number },
  ): Promise<unknown>;
  delete(key: Deno.KvKey): Promise<void>;
  list<T>(selector: { prefix: Deno.KvKey }): AsyncIterableIterator<{
    key: Deno.KvKey;
    value: T;
    versionstamp: string;
  }>;
}

/**
 * Stored deprecation data in KV
 */
interface StoredDeprecationRecord {
  type: "model" | "field";
  originalName: string;
  deprecatedName: string;
  migrationName: string;
  tableName: string;
  deprecatedAt: string; // ISO string
  cleanedUp: boolean;
  cleanedUpAt: string | null; // ISO string or null
}

// ============================================================================
// DenoKV Deprecation Recorder
// ============================================================================

/**
 * DenoKV Deprecation Recorder
 *
 * Tracks deprecated tables and columns in DenoKV under the `["_alexi", "deprecations"]` prefix.
 *
 * Storage structure:
 * ```
 * ["_alexi", "deprecations", "_deprecated_0001_email"] → {
 *   type: "field",
 *   originalName: "email",
 *   deprecatedName: "_deprecated_0001_email",
 *   migrationName: "users.0002_remove_email",
 *   tableName: "users",
 *   deprecatedAt: "2024-01-15T10:30:00Z",
 *   cleanedUp: false,
 *   cleanedUpAt: null
 * }
 * ```
 *
 * @example
 * ```ts
 * const kv = await Deno.openKv();
 * const recorder = new DenoKVDeprecationRecorder(kv);
 *
 * // Record a deprecation
 * await recorder.record({
 *   type: "field",
 *   originalName: "email",
 *   deprecatedName: "_deprecated_0001_email",
 *   migrationName: "0001_initial",
 *   tableName: "users",
 *   deprecatedAt: new Date(),
 * });
 *
 * // Get all deprecations
 * const deprecations = await recorder.getAll();
 *
 * // Mark as cleaned up
 * await recorder.markCleanedUp("_deprecated_0001_email");
 * ```
 */
export class DenoKVDeprecationRecorder implements IDeprecationRecorder {
  private _kv: KVStore;
  private _prefix: Deno.KvKey = ["_alexi", "deprecations"];

  constructor(kv: KVStore) {
    this._kv = kv;
  }

  // ==========================================================================
  // Key Helpers
  // ==========================================================================

  private _getDeprecationKey(deprecatedName: string): Deno.KvKey {
    return [...this._prefix, deprecatedName];
  }

  private _toRecord(stored: StoredDeprecationRecord): DeprecationRecord {
    return {
      id: stored.deprecatedName, // Use deprecatedName as ID for KV
      type: stored.type,
      originalName: stored.originalName,
      deprecatedName: stored.deprecatedName,
      migrationName: stored.migrationName,
      tableName: stored.tableName,
      deprecatedAt: new Date(stored.deprecatedAt),
      cleanedUp: stored.cleanedUp,
      cleanedUpAt: stored.cleanedUpAt ? new Date(stored.cleanedUpAt) : null,
    };
  }

  // ==========================================================================
  // Table Management (no-op for KV)
  // ==========================================================================

  /**
   * Ensure storage is ready (no-op for KV - always ready)
   */
  async ensureTable(): Promise<void> {
    // DenoKV doesn't need table creation - it's schemaless
    return Promise.resolve();
  }

  // ==========================================================================
  // Recording
  // ==========================================================================

  /**
   * Record a deprecation
   *
   * @param info - Deprecation information
   */
  async record(info: DeprecationInfo): Promise<void> {
    const stored: StoredDeprecationRecord = {
      type: info.type,
      originalName: info.originalName,
      deprecatedName: info.deprecatedName,
      migrationName: info.migrationName,
      tableName: info.tableName,
      deprecatedAt: info.deprecatedAt.toISOString(),
      cleanedUp: false,
      cleanedUpAt: null,
    };

    await this._kv.set(this._getDeprecationKey(info.deprecatedName), stored);
  }

  /**
   * Record multiple deprecations
   *
   * @param infos - Array of deprecation information
   */
  async recordMany(infos: DeprecationInfo[]): Promise<void> {
    for (const info of infos) {
      await this.record(info);
    }
  }

  /**
   * Remove a deprecation record (for rollback)
   *
   * @param deprecatedName - The deprecated name to remove
   */
  async remove(deprecatedName: string): Promise<void> {
    await this._kv.delete(this._getDeprecationKey(deprecatedName));
  }

  // ==========================================================================
  // Querying
  // ==========================================================================

  /**
   * Get all deprecations
   *
   * @param includeCleanedUp - Whether to include cleaned up deprecations
   */
  async getAll(includeCleanedUp = false): Promise<DeprecationRecord[]> {
    const records: DeprecationRecord[] = [];

    for await (
      const entry of this._kv.list<StoredDeprecationRecord>({
        prefix: this._prefix,
      })
    ) {
      if (entry.value) {
        if (includeCleanedUp || !entry.value.cleanedUp) {
          records.push(this._toRecord(entry.value));
        }
      }
    }

    // Sort by deprecatedAt
    return records.sort(
      (a, b) => a.deprecatedAt.getTime() - b.deprecatedAt.getTime(),
    );
  }

  /**
   * Get deprecations for a specific migration
   *
   * @param migrationName - Migration name
   */
  async getForMigration(migrationName: string): Promise<DeprecationRecord[]> {
    const all = await this.getAll(true);
    return all
      .filter((r) => r.migrationName === migrationName)
      .sort((a, b) => a.deprecatedAt.getTime() - b.deprecatedAt.getTime());
  }

  /**
   * Get deprecations for a specific table
   *
   * @param tableName - Table name
   */
  async getForTable(tableName: string): Promise<DeprecationRecord[]> {
    const all = await this.getAll(true);
    return all
      .filter((r) => r.tableName === tableName)
      .sort((a, b) => a.deprecatedAt.getTime() - b.deprecatedAt.getTime());
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  /**
   * Mark a deprecation as cleaned up
   *
   * @param deprecatedName - The deprecated name
   */
  async markCleanedUp(deprecatedName: string): Promise<void> {
    const key = this._getDeprecationKey(deprecatedName);
    const result = await this._kv.get<StoredDeprecationRecord>(key);

    if (result.value) {
      const updated: StoredDeprecationRecord = {
        ...result.value,
        cleanedUp: true,
        cleanedUpAt: new Date().toISOString(),
      };
      await this._kv.set(key, updated);
    }
  }

  /**
   * Get pending deprecations that can be cleaned up
   *
   * Only returns deprecations older than the specified number of days.
   *
   * @param minAgeDays - Minimum age in days (default: 30)
   */
  async getPendingCleanup(minAgeDays = 30): Promise<DeprecationRecord[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - minAgeDays);

    const all = await this.getAll(false); // Only non-cleaned-up
    return all.filter((r) => r.deprecatedAt < cutoffDate);
  }

  /**
   * Clear all deprecation records (for testing)
   */
  async clear(): Promise<void> {
    const keysToDelete: Deno.KvKey[] = [];

    for await (const entry of this._kv.list({ prefix: this._prefix })) {
      keysToDelete.push(entry.key);
    }

    for (const key of keysToDelete) {
      await this._kv.delete(key);
    }
  }
}
