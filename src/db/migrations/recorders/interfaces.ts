/**
 * Migration Recorder Interfaces
 *
 * Defines the interfaces for migration and deprecation tracking
 * across different database backends.
 *
 * @module
 */

import type { DeprecationInfo } from "../schema_editor.ts";

// ============================================================================
// Migration Recorder Interface
// ============================================================================

/**
 * Record of an applied migration
 */
export interface MigrationRecord {
  /** Full migration name (e.g., "users.0001_initial") */
  name: string;
  /** App label */
  appLabel: string;
  /** When the migration was applied */
  appliedAt: Date;
}

/**
 * Interface for tracking applied migrations
 *
 * Implementations exist for different backends:
 * - `PostgresMigrationRecorder` - Uses SQL table
 * - `DenoKVMigrationRecorder` - Uses KV store
 */
export interface IMigrationRecorder {
  /**
   * Ensure the migrations tracking storage exists
   */
  ensureTable(): Promise<void>;

  /**
   * Check if a migration has been applied
   *
   * @param fullName - Full migration name (e.g., "users.0001_initial")
   */
  isApplied(fullName: string): Promise<boolean>;

  /**
   * Get all applied migrations
   */
  getAppliedMigrations(): Promise<MigrationRecord[]>;

  /**
   * Get applied migrations for a specific app
   *
   * @param appLabel - App label to filter by
   */
  getAppliedForApp(appLabel: string): Promise<MigrationRecord[]>;

  /**
   * Record that a migration has been applied
   *
   * @param fullName - Full migration name
   * @param appLabel - App label
   */
  recordApplied(fullName: string, appLabel: string): Promise<void>;

  /**
   * Record that a migration has been unapplied (rolled back)
   *
   * @param fullName - Full migration name
   */
  recordUnapplied(fullName: string): Promise<void>;

  /**
   * Get the latest applied migration for an app
   *
   * @param appLabel - App label
   */
  getLatestForApp(appLabel: string): Promise<MigrationRecord | null>;

  /**
   * Clear all migration records (for testing)
   */
  clear(): Promise<void>;
}

// ============================================================================
// Deprecation Recorder Interface
// ============================================================================

/**
 * Stored deprecation record
 */
export interface DeprecationRecord extends DeprecationInfo {
  /** Database ID (may be string for KV stores) */
  id: number | string;
  /** Whether this deprecation has been cleaned up */
  cleanedUp: boolean;
  /** When it was cleaned up (if applicable) */
  cleanedUpAt: Date | null;
}

/**
 * Interface for tracking deprecated models and fields
 *
 * Implementations exist for different backends:
 * - `PostgresDeprecationRecorder` - Uses SQL table
 * - `DenoKVDeprecationRecorder` - Uses KV store
 */
export interface IDeprecationRecorder {
  /**
   * Ensure the deprecations tracking storage exists
   */
  ensureTable(): Promise<void>;

  /**
   * Record a deprecation
   *
   * @param info - Deprecation information
   */
  record(info: DeprecationInfo): Promise<void>;

  /**
   * Record multiple deprecations
   *
   * @param infos - Array of deprecation information
   */
  recordMany(infos: DeprecationInfo[]): Promise<void>;

  /**
   * Remove a deprecation record (for rollback)
   *
   * @param deprecatedName - The deprecated name to remove
   */
  remove(deprecatedName: string): Promise<void>;

  /**
   * Get all deprecations
   *
   * @param includeCleanedUp - Whether to include cleaned up deprecations
   */
  getAll(includeCleanedUp?: boolean): Promise<DeprecationRecord[]>;

  /**
   * Get deprecations for a specific migration
   *
   * @param migrationName - Migration name
   */
  getForMigration(migrationName: string): Promise<DeprecationRecord[]>;

  /**
   * Get deprecations for a specific table
   *
   * @param tableName - Table name
   */
  getForTable(tableName: string): Promise<DeprecationRecord[]>;

  /**
   * Mark a deprecation as cleaned up
   *
   * @param deprecatedName - The deprecated name
   */
  markCleanedUp(deprecatedName: string): Promise<void>;

  /**
   * Get pending deprecations that can be cleaned up
   *
   * Only returns deprecations older than the specified number of days.
   *
   * @param minAgeDays - Minimum age in days (default: 30)
   */
  getPendingCleanup(minAgeDays?: number): Promise<DeprecationRecord[]>;

  /**
   * Clear all deprecation records (for testing)
   */
  clear(): Promise<void>;
}
