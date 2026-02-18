/**
 * Deprecation Recorder
 *
 * Tracks deprecated models and fields in the database.
 * Uses the `_alexi_deprecations` table to store deprecation history.
 *
 * This allows:
 * - Tracking what was deprecated and when
 * - Cleanup operations to permanently delete deprecated items
 * - Visibility into deprecated items via `showmigrations --deprecations`
 *
 * @module
 */

import type { DatabaseBackend } from "../backends/backend.ts";
import type { DeprecationInfo } from "./schema_editor.ts";

// ============================================================================
// Types
// ============================================================================

/**
 * Stored deprecation record
 */
export interface DeprecationRecord extends DeprecationInfo {
  /** Database ID */
  id: number;
  /** Whether this deprecation has been cleaned up */
  cleanedUp: boolean;
  /** When it was cleaned up (if applicable) */
  cleanedUpAt: Date | null;
}

// ============================================================================
// Deprecation Recorder
// ============================================================================

/**
 * Deprecation Recorder
 *
 * Tracks deprecated tables and columns in `_alexi_deprecations`.
 *
 * @example
 * ```ts
 * const recorder = new DeprecationRecorder(backend);
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
export class DeprecationRecorder {
  private _backend: DatabaseBackend;
  private _tableName = "_alexi_deprecations";
  private _tableCreated = false;

  constructor(backend: DatabaseBackend) {
    this._backend = backend;
  }

  // ==========================================================================
  // Table Management
  // ==========================================================================

  /**
   * Ensure the deprecations tracking table exists
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
    const sql = this._getCreateTableSQL();
    await this._backend.executeRaw(sql);
  }

  private _getCreateTableSQL(): string {
    return `
      CREATE TABLE IF NOT EXISTS "${this._tableName}" (
        "id" SERIAL PRIMARY KEY,
        "type" VARCHAR(20) NOT NULL,
        "original_name" VARCHAR(255) NOT NULL,
        "deprecated_name" VARCHAR(255) NOT NULL,
        "migration_name" VARCHAR(255) NOT NULL,
        "table_name" VARCHAR(255) NOT NULL,
        "deprecated_at" TIMESTAMP NOT NULL,
        "cleaned_up" BOOLEAN NOT NULL DEFAULT FALSE,
        "cleaned_up_at" TIMESTAMP NULL
      )
    `;
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
    await this.ensureTable();

    await this._backend.executeRaw(
      `INSERT INTO "${this._tableName}" 
       ("type", "original_name", "deprecated_name", "migration_name", "table_name", "deprecated_at")
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        info.type,
        info.originalName,
        info.deprecatedName,
        info.migrationName,
        info.tableName,
        info.deprecatedAt.toISOString(),
      ],
    );
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
    await this.ensureTable();

    await this._backend.executeRaw(
      `DELETE FROM "${this._tableName}" WHERE "deprecated_name" = $1`,
      [deprecatedName],
    );
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
    await this.ensureTable();

    const whereClause = includeCleanedUp ? "" : 'WHERE "cleaned_up" = FALSE';

    const results = await this._backend.executeRaw<{
      id: number;
      type: string;
      original_name: string;
      deprecated_name: string;
      migration_name: string;
      table_name: string;
      deprecated_at: string;
      cleaned_up: boolean;
      cleaned_up_at: string | null;
    }>(
      `SELECT * FROM "${this._tableName}" ${whereClause} ORDER BY "deprecated_at" ASC`,
    );

    return results.map((row) => ({
      id: row.id,
      type: row.type as "model" | "field",
      originalName: row.original_name,
      deprecatedName: row.deprecated_name,
      migrationName: row.migration_name,
      tableName: row.table_name,
      deprecatedAt: new Date(row.deprecated_at),
      cleanedUp: row.cleaned_up,
      cleanedUpAt: row.cleaned_up_at ? new Date(row.cleaned_up_at) : null,
    }));
  }

  /**
   * Get deprecations for a specific migration
   *
   * @param migrationName - Migration name
   */
  async getForMigration(migrationName: string): Promise<DeprecationRecord[]> {
    await this.ensureTable();

    const results = await this._backend.executeRaw<{
      id: number;
      type: string;
      original_name: string;
      deprecated_name: string;
      migration_name: string;
      table_name: string;
      deprecated_at: string;
      cleaned_up: boolean;
      cleaned_up_at: string | null;
    }>(
      `SELECT * FROM "${this._tableName}" WHERE "migration_name" = $1 ORDER BY "deprecated_at" ASC`,
      [migrationName],
    );

    return results.map((row) => ({
      id: row.id,
      type: row.type as "model" | "field",
      originalName: row.original_name,
      deprecatedName: row.deprecated_name,
      migrationName: row.migration_name,
      tableName: row.table_name,
      deprecatedAt: new Date(row.deprecated_at),
      cleanedUp: row.cleaned_up,
      cleanedUpAt: row.cleaned_up_at ? new Date(row.cleaned_up_at) : null,
    }));
  }

  /**
   * Get deprecations for a specific table
   *
   * @param tableName - Table name
   */
  async getForTable(tableName: string): Promise<DeprecationRecord[]> {
    await this.ensureTable();

    const results = await this._backend.executeRaw<{
      id: number;
      type: string;
      original_name: string;
      deprecated_name: string;
      migration_name: string;
      table_name: string;
      deprecated_at: string;
      cleaned_up: boolean;
      cleaned_up_at: string | null;
    }>(
      `SELECT * FROM "${this._tableName}" WHERE "table_name" = $1 ORDER BY "deprecated_at" ASC`,
      [tableName],
    );

    return results.map((row) => ({
      id: row.id,
      type: row.type as "model" | "field",
      originalName: row.original_name,
      deprecatedName: row.deprecated_name,
      migrationName: row.migration_name,
      tableName: row.table_name,
      deprecatedAt: new Date(row.deprecated_at),
      cleanedUp: row.cleaned_up,
      cleanedUpAt: row.cleaned_up_at ? new Date(row.cleaned_up_at) : null,
    }));
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
    await this.ensureTable();

    await this._backend.executeRaw(
      `UPDATE "${this._tableName}" 
       SET "cleaned_up" = TRUE, "cleaned_up_at" = CURRENT_TIMESTAMP 
       WHERE "deprecated_name" = $1`,
      [deprecatedName],
    );
  }

  /**
   * Get pending deprecations that can be cleaned up
   *
   * Only returns deprecations older than the specified number of days.
   *
   * @param minAgeDays - Minimum age in days (default: 30)
   */
  async getPendingCleanup(minAgeDays = 30): Promise<DeprecationRecord[]> {
    await this.ensureTable();

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - minAgeDays);

    const results = await this._backend.executeRaw<{
      id: number;
      type: string;
      original_name: string;
      deprecated_name: string;
      migration_name: string;
      table_name: string;
      deprecated_at: string;
      cleaned_up: boolean;
      cleaned_up_at: string | null;
    }>(
      `SELECT * FROM "${this._tableName}" 
       WHERE "cleaned_up" = FALSE AND "deprecated_at" < $1 
       ORDER BY "deprecated_at" ASC`,
      [cutoffDate.toISOString()],
    );

    return results.map((row) => ({
      id: row.id,
      type: row.type as "model" | "field",
      originalName: row.original_name,
      deprecatedName: row.deprecated_name,
      migrationName: row.migration_name,
      tableName: row.table_name,
      deprecatedAt: new Date(row.deprecated_at),
      cleanedUp: row.cleaned_up,
      cleanedUpAt: row.cleaned_up_at ? new Date(row.cleaned_up_at) : null,
    }));
  }

  /**
   * Clear all deprecation records (for testing)
   */
  async clear(): Promise<void> {
    await this.ensureTable();
    await this._backend.executeRaw(`DELETE FROM "${this._tableName}"`);
  }
}
