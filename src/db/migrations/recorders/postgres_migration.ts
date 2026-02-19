/**
 * PostgreSQL Migration Recorder
 *
 * Tracks which migrations have been applied to the database.
 * Uses the `_alexi_migrations` table to store migration history.
 *
 * @module
 */

import type { DatabaseBackend } from "../../backends/backend.ts";
import type { IMigrationRecorder, MigrationRecord } from "./interfaces.ts";

// ============================================================================
// PostgreSQL Migration Recorder
// ============================================================================

/**
 * PostgreSQL Migration Recorder
 *
 * Tracks applied migrations in the `_alexi_migrations` table.
 *
 * @example
 * ```ts
 * const recorder = new PostgresMigrationRecorder(backend);
 *
 * // Ensure table exists
 * await recorder.ensureTable();
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
export class PostgresMigrationRecorder implements IMigrationRecorder {
  private _backend: DatabaseBackend;
  private _tableName = "_alexi_migrations";
  private _tableCreated = false;

  constructor(backend: DatabaseBackend) {
    this._backend = backend;
  }

  // ==========================================================================
  // Table Management
  // ==========================================================================

  /**
   * Ensure the migrations tracking table exists
   */
  async ensureTable(): Promise<void> {
    if (this._tableCreated) return;

    const exists = await this._backend.tableExists(this._tableName);
    if (!exists) {
      await this._createTable();
    }

    this._tableCreated = true;
  }

  private async _createTable(): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS "${this._tableName}" (
        "id" SERIAL PRIMARY KEY,
        "name" VARCHAR(255) NOT NULL UNIQUE,
        "app_label" VARCHAR(255) NOT NULL,
        "applied_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await this._backend.executeRaw(sql);
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
    await this.ensureTable();

    const results = await this._backend.executeRaw<{ count: number }>(
      `SELECT COUNT(*) as count FROM "${this._tableName}" WHERE "name" = $1`,
      [fullName],
    );

    return results.length > 0 && results[0].count > 0;
  }

  /**
   * Get all applied migrations
   */
  async getAppliedMigrations(): Promise<MigrationRecord[]> {
    await this.ensureTable();

    const results = await this._backend.executeRaw<{
      name: string;
      app_label: string;
      applied_at: string;
    }>(
      `SELECT "name", "app_label", "applied_at" FROM "${this._tableName}" ORDER BY "applied_at" ASC`,
    );

    return results.map((row) => ({
      name: row.name,
      appLabel: row.app_label,
      appliedAt: new Date(row.applied_at),
    }));
  }

  /**
   * Get applied migrations for a specific app
   *
   * @param appLabel - App label to filter by
   */
  async getAppliedForApp(appLabel: string): Promise<MigrationRecord[]> {
    await this.ensureTable();

    const results = await this._backend.executeRaw<{
      name: string;
      app_label: string;
      applied_at: string;
    }>(
      `SELECT "name", "app_label", "applied_at" FROM "${this._tableName}" 
       WHERE "app_label" = $1 ORDER BY "applied_at" ASC`,
      [appLabel],
    );

    return results.map((row) => ({
      name: row.name,
      appLabel: row.app_label,
      appliedAt: new Date(row.applied_at),
    }));
  }

  /**
   * Record that a migration has been applied
   *
   * @param fullName - Full migration name
   * @param appLabel - App label
   */
  async recordApplied(fullName: string, appLabel: string): Promise<void> {
    await this.ensureTable();

    await this._backend.executeRaw(
      `INSERT INTO "${this._tableName}" ("name", "app_label", "applied_at") 
       VALUES ($1, $2, CURRENT_TIMESTAMP)`,
      [fullName, appLabel],
    );
  }

  /**
   * Record that a migration has been unapplied (rolled back)
   *
   * @param fullName - Full migration name
   */
  async recordUnapplied(fullName: string): Promise<void> {
    await this.ensureTable();

    await this._backend.executeRaw(
      `DELETE FROM "${this._tableName}" WHERE "name" = $1`,
      [fullName],
    );
  }

  /**
   * Get the latest applied migration for an app
   *
   * @param appLabel - App label
   */
  async getLatestForApp(appLabel: string): Promise<MigrationRecord | null> {
    await this.ensureTable();

    const results = await this._backend.executeRaw<{
      name: string;
      app_label: string;
      applied_at: string;
    }>(
      `SELECT "name", "app_label", "applied_at" FROM "${this._tableName}" 
       WHERE "app_label" = $1 ORDER BY "applied_at" DESC LIMIT 1`,
      [appLabel],
    );

    if (results.length === 0) return null;

    return {
      name: results[0].name,
      appLabel: results[0].app_label,
      appliedAt: new Date(results[0].applied_at),
    };
  }

  /**
   * Clear all migration records (for testing)
   */
  async clear(): Promise<void> {
    await this.ensureTable();
    await this._backend.executeRaw(`DELETE FROM "${this._tableName}"`);
  }
}
