/**
 * DenoKV Migration Recorder
 *
 * Tracks which migrations have been applied using DenoKV.
 * Stores migration records under `["_alexi", "migrations", ...]` prefix.
 *
 * @module
 */

import type { IMigrationRecorder, MigrationRecord } from "./interfaces.ts";

// ============================================================================
// Types
// ============================================================================

/**
 * Minimal DenoKV interface for migration tracking
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
 * Stored migration data in KV
 */
interface StoredMigrationRecord {
  name: string;
  appLabel: string;
  appliedAt: string; // ISO string
}

// ============================================================================
// DenoKV Migration Recorder
// ============================================================================

/**
 * DenoKV Migration Recorder
 *
 * Tracks applied migrations in DenoKV under the `["_alexi", "migrations"]` prefix.
 *
 * Storage structure:
 * ```
 * ["_alexi", "migrations", "users.0001_initial"] → {
 *   name: "users.0001_initial",
 *   appLabel: "users",
 *   appliedAt: "2024-01-15T10:30:00Z"
 * }
 * ```
 *
 * @example
 * ```ts
 * const kv = await Deno.openKv();
 * const recorder = new DenoKVMigrationRecorder(kv);
 *
 * // Check if a migration was applied
 * const applied = await recorder.isApplied("users.0001_initial");
 *
 * // Record a migration
 * await recorder.recordApplied("users.0001_initial", "users");
 *
 * // Remove a migration record (for rollback)
 * await recorder.recordUnapplied("users.0001_initial");
 * ```
 */
export class DenoKVMigrationRecorder implements IMigrationRecorder {
  private _kv: KVStore;
  private _prefix: Deno.KvKey = ["_alexi", "migrations"];

  constructor(kv: KVStore) {
    this._kv = kv;
  }

  // ==========================================================================
  // Key Helpers
  // ==========================================================================

  private _getMigrationKey(fullName: string): Deno.KvKey {
    return [...this._prefix, fullName];
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
  // Migration Tracking
  // ==========================================================================

  /**
   * Check if a migration has been applied
   *
   * @param fullName - Full migration name (e.g., "users.0001_initial")
   */
  async isApplied(fullName: string): Promise<boolean> {
    const result = await this._kv.get<StoredMigrationRecord>(
      this._getMigrationKey(fullName),
    );
    return result.value !== null;
  }

  /**
   * Get all applied migrations
   */
  async getAppliedMigrations(): Promise<MigrationRecord[]> {
    const records: MigrationRecord[] = [];

    for await (
      const entry of this._kv.list<StoredMigrationRecord>({
        prefix: this._prefix,
      })
    ) {
      if (entry.value) {
        records.push({
          name: entry.value.name,
          appLabel: entry.value.appLabel,
          appliedAt: new Date(entry.value.appliedAt),
        });
      }
    }

    // Sort by appliedAt
    return records.sort(
      (a, b) => a.appliedAt.getTime() - b.appliedAt.getTime(),
    );
  }

  /**
   * Get applied migrations for a specific app
   *
   * @param appLabel - App label to filter by
   */
  async getAppliedForApp(appLabel: string): Promise<MigrationRecord[]> {
    const all = await this.getAppliedMigrations();
    return all.filter((r) => r.appLabel === appLabel);
  }

  /**
   * Record that a migration has been applied
   *
   * @param fullName - Full migration name
   * @param appLabel - App label
   */
  async recordApplied(fullName: string, appLabel: string): Promise<void> {
    const record: StoredMigrationRecord = {
      name: fullName,
      appLabel,
      appliedAt: new Date().toISOString(),
    };

    await this._kv.set(this._getMigrationKey(fullName), record);
  }

  /**
   * Record that a migration has been unapplied (rolled back)
   *
   * @param fullName - Full migration name
   */
  async recordUnapplied(fullName: string): Promise<void> {
    await this._kv.delete(this._getMigrationKey(fullName));
  }

  /**
   * Get the latest applied migration for an app
   *
   * @param appLabel - App label
   */
  async getLatestForApp(appLabel: string): Promise<MigrationRecord | null> {
    const appMigrations = await this.getAppliedForApp(appLabel);

    if (appMigrations.length === 0) return null;

    // Return the one with the latest appliedAt
    return appMigrations[appMigrations.length - 1];
  }

  /**
   * Clear all migration records (for testing)
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
