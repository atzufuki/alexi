/**
 * Migration Executor
 *
 * Executes migrations forward and backward, handling dependencies
 * and recording applied migrations.
 *
 * @module
 */

import type { Migration, MigrationOptions } from "./migration.ts";
import type { LoadedMigration, MigrationLoader } from "./loader.ts";
import {
  type IBackendSchemaEditor,
  MigrationSchemaEditor,
} from "./schema_editor.ts";
import type { DatabaseBackend } from "../backends/backend.ts";
import type {
  IDeprecationRecorder,
  IMigrationRecorder,
} from "./recorders/interfaces.ts";
import {
  createDeprecationRecorder,
  createMigrationRecorder,
} from "./recorders/factory.ts";

// ============================================================================
// Types
// ============================================================================

/**
 * Result of a migration execution
 */
export interface MigrationResult {
  /** The migration that was executed */
  migration: Migration;
  /** Whether it was applied (forward) or unapplied (backward) */
  direction: "forward" | "backward";
  /** Whether execution succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Time taken in milliseconds */
  duration: number;
}

/**
 * Execution plan showing what will be done
 */
export interface ExecutionPlan {
  /** Migrations to apply (forward) */
  toApply: LoadedMigration[];
  /** Migrations to unapply (backward) */
  toUnapply: LoadedMigration[];
  /** Total operations count */
  totalOperations: number;
}

/**
 * Factory function to create a backend schema editor
 */
export type SchemaEditorFactory = (
  backend: DatabaseBackend,
  migrationName: string,
  options?: { dryRun?: boolean; verbosity?: number },
) => IBackendSchemaEditor;

// ============================================================================
// Migration Executor
// ============================================================================

/**
 * Migration Executor
 *
 * Runs migrations forward and backward, handling dependencies and tracking.
 *
 * @example
 * ```ts
 * const loader = new MigrationLoader();
 * await loader.loadFromDirectory("./project");
 *
 * const executor = new MigrationExecutor(backend, loader);
 *
 * // Apply all pending migrations
 * await executor.migrate();
 *
 * // Roll back to a specific migration
 * await executor.migrate({ to: "users.0002_add_email" });
 *
 * // Roll back all migrations
 * await executor.migrate({ to: "zero" });
 *
 * // Show what would be done
 * const plan = await executor.plan();
 * ```
 */
export class MigrationExecutor {
  private _backend: DatabaseBackend;
  private _loader: MigrationLoader;
  private _recorder: IMigrationRecorder;
  private _deprecationRecorder: IDeprecationRecorder;
  private _schemaEditorFactory: SchemaEditorFactory | null = null;

  constructor(backend: DatabaseBackend, loader: MigrationLoader) {
    this._backend = backend;
    this._loader = loader;
    this._recorder = createMigrationRecorder(backend);
    this._deprecationRecorder = createDeprecationRecorder(backend);
  }

  /**
   * Set a custom schema editor factory
   *
   * @param factory - Factory function to create schema editors
   */
  setSchemaEditorFactory(factory: SchemaEditorFactory): void {
    this._schemaEditorFactory = factory;
  }

  // ==========================================================================
  // Planning
  // ==========================================================================

  /**
   * Plan what migrations need to be applied/unapplied
   *
   * @param options - Planning options
   */
  async plan(options?: {
    to?: string;
    appLabel?: string;
  }): Promise<ExecutionPlan> {
    const appliedMigrations = await this._recorder.getAppliedMigrations();
    const appliedSet = new Set(appliedMigrations.map((m) => m.name));

    const allMigrations = this._loader.getOrderedMigrations();

    // Filter by app if specified
    let targetMigrations = allMigrations;
    if (options?.appLabel) {
      targetMigrations = allMigrations.filter(
        (m) => m.appLabel === options.appLabel,
      );
    }

    // Determine target state
    if (options?.to === "zero") {
      // Roll back all migrations
      return {
        toApply: [],
        toUnapply: targetMigrations
          .filter((m) => appliedSet.has(m.migration.getFullName()))
          .reverse(),
        totalOperations: targetMigrations.filter((m) =>
          appliedSet.has(m.migration.getFullName())
        ).length,
      };
    }

    if (options?.to) {
      // Migrate to a specific target
      const targetIndex = targetMigrations.findIndex(
        (m) =>
          m.migration.getFullName() === options.to ||
          m.migration.name === options.to,
      );

      if (targetIndex === -1) {
        throw new Error(`Migration '${options.to}' not found`);
      }

      const toApply: LoadedMigration[] = [];
      const toUnapply: LoadedMigration[] = [];

      for (let i = 0; i <= targetIndex; i++) {
        const m = targetMigrations[i];
        if (!appliedSet.has(m.migration.getFullName())) {
          toApply.push(m);
        }
      }

      for (let i = targetMigrations.length - 1; i > targetIndex; i--) {
        const m = targetMigrations[i];
        if (appliedSet.has(m.migration.getFullName())) {
          toUnapply.push(m);
        }
      }

      return {
        toApply,
        toUnapply,
        totalOperations: toApply.length + toUnapply.length,
      };
    }

    // Apply all pending migrations
    const toApply = targetMigrations.filter(
      (m) => !appliedSet.has(m.migration.getFullName()),
    );

    return {
      toApply,
      toUnapply: [],
      totalOperations: toApply.length,
    };
  }

  // ==========================================================================
  // Execution
  // ==========================================================================

  /**
   * Execute migrations
   *
   * @param options - Execution options
   */
  async migrate(options?: {
    to?: string;
    appLabel?: string;
    dryRun?: boolean;
    verbosity?: number;
    testMode?: boolean;
  }): Promise<MigrationResult[]> {
    const results: MigrationResult[] = [];

    // Get execution plan
    const plan = await this.plan({
      to: options?.to,
      appLabel: options?.appLabel,
    });

    if (plan.totalOperations === 0) {
      if (options?.verbosity !== 0) {
        console.log("No migrations to apply.");
      }
      return results;
    }

    // First, unapply any migrations that need to be rolled back
    for (const loaded of plan.toUnapply) {
      const result = await this._unapplyMigration(loaded, {
        dryRun: options?.dryRun,
        verbosity: options?.verbosity,
      });
      results.push(result);

      if (!result.success) {
        return results; // Stop on first error
      }
    }

    // Then, apply pending migrations
    for (const loaded of plan.toApply) {
      const result = await this._applyMigration(loaded, {
        dryRun: options?.dryRun,
        verbosity: options?.verbosity,
      });
      results.push(result);

      if (!result.success) {
        return results; // Stop on first error
      }
    }

    // Test mode: verify reversibility
    if (options?.testMode) {
      const testResults = await this._testReversibility(plan.toApply, options);
      results.push(...testResults);
    }

    return results;
  }

  /**
   * Apply a single migration
   */
  private async _applyMigration(
    loaded: LoadedMigration,
    options?: MigrationOptions,
  ): Promise<MigrationResult> {
    const { migration } = loaded;
    const fullName = migration.getFullName();
    const startTime = Date.now();

    if (options?.verbosity !== 0) {
      console.log(`Applying ${fullName}...`);
    }

    try {
      // Create schema editor
      const schemaEditor = this._createSchemaEditor(
        migration.name,
        options,
      );

      // Run forwards
      if (!options?.dryRun) {
        await migration.forwards(schemaEditor);

        // Record deprecations
        const deprecations = schemaEditor.getDeprecations();
        if (deprecations.length > 0) {
          await this._deprecationRecorder.recordMany(deprecations);
        }

        // Record the migration
        await this._recorder.recordApplied(fullName, loaded.appLabel);
      }

      const duration = Date.now() - startTime;

      if (options?.verbosity !== 0) {
        console.log(`  Applied ${fullName} (${duration}ms)`);
      }

      return {
        migration,
        direction: "forward",
        success: true,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);

      console.error(`  Failed to apply ${fullName}: ${errorMessage}`);

      return {
        migration,
        direction: "forward",
        success: false,
        error: errorMessage,
        duration,
      };
    }
  }

  /**
   * Unapply (roll back) a single migration
   */
  private async _unapplyMigration(
    loaded: LoadedMigration,
    options?: MigrationOptions,
  ): Promise<MigrationResult> {
    const { migration } = loaded;
    const fullName = migration.getFullName();
    const startTime = Date.now();

    if (!migration.canReverse()) {
      console.warn(
        `Warning: Migration ${fullName} is marked as irreversible`,
      );
    }

    if (options?.verbosity !== 0) {
      console.log(`Unapplying ${fullName}...`);
    }

    try {
      // Create schema editor
      const schemaEditor = this._createSchemaEditor(
        migration.name,
        options,
      );

      // Run backwards
      if (!options?.dryRun) {
        await migration.backwards(schemaEditor);

        // Remove the migration record
        await this._recorder.recordUnapplied(fullName);
      }

      const duration = Date.now() - startTime;

      if (options?.verbosity !== 0) {
        console.log(`  Unapplied ${fullName} (${duration}ms)`);
      }

      return {
        migration,
        direction: "backward",
        success: true,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);

      console.error(`  Failed to unapply ${fullName}: ${errorMessage}`);

      return {
        migration,
        direction: "backward",
        success: false,
        error: errorMessage,
        duration,
      };
    }
  }

  /**
   * Test reversibility by running forward -> backward -> forward
   */
  private async _testReversibility(
    migrations: LoadedMigration[],
    options?: MigrationOptions,
  ): Promise<MigrationResult[]> {
    const results: MigrationResult[] = [];

    console.log("\nTesting reversibility...");

    // Roll back in reverse order
    for (const loaded of [...migrations].reverse()) {
      if (!loaded.migration.canReverse()) {
        console.warn(
          `  Skipping ${loaded.migration.getFullName()} (marked irreversible)`,
        );
        continue;
      }

      const result = await this._unapplyMigration(loaded, {
        ...options,
        verbosity: 2,
      });
      results.push(result);

      if (!result.success) {
        console.error("  Reversibility test failed!");
        return results;
      }
    }

    // Apply again
    for (const loaded of migrations) {
      const result = await this._applyMigration(loaded, {
        ...options,
        verbosity: 2,
      });
      results.push(result);

      if (!result.success) {
        console.error("  Reversibility test failed on re-apply!");
        return results;
      }
    }

    console.log("  Reversibility test passed!");
    return results;
  }

  /**
   * Create a schema editor for a migration
   */
  private _createSchemaEditor(
    migrationName: string,
    options?: MigrationOptions,
  ): MigrationSchemaEditor {
    // Get backend schema editor
    let backendEditor: IBackendSchemaEditor;

    if (this._schemaEditorFactory) {
      backendEditor = this._schemaEditorFactory(
        this._backend,
        migrationName,
        options,
      );
    } else {
      // Use the backend's built-in schema editor
      backendEditor = this._backend
        .getSchemaEditor() as unknown as IBackendSchemaEditor;
    }

    return new MigrationSchemaEditor(
      this._backend,
      backendEditor,
      migrationName,
      options,
    );
  }

  // ==========================================================================
  // Cleanup Operations
  // ==========================================================================

  /**
   * Clean up deprecated items older than a certain age
   *
   * This permanently deletes deprecated tables and columns.
   * Use with caution!
   *
   * @param options - Cleanup options
   */
  async cleanup(options?: {
    minAgeDays?: number;
    dryRun?: boolean;
    verbosity?: number;
  }): Promise<void> {
    const minAgeDays = options?.minAgeDays ?? 30;
    const dryRun = options?.dryRun ?? false;

    const pending = await this._deprecationRecorder.getPendingCleanup(
      minAgeDays,
    );

    if (pending.length === 0) {
      console.log("No deprecations ready for cleanup.");
      return;
    }

    console.log(`Found ${pending.length} deprecations ready for cleanup:`);

    for (const dep of pending) {
      const ageInDays = Math.floor(
        (Date.now() - dep.deprecatedAt.getTime()) / (1000 * 60 * 60 * 24),
      );

      console.log(
        `  ${dep.type}: ${dep.deprecatedName} (${ageInDays} days old)`,
      );

      if (!dryRun) {
        // Actually drop the deprecated item
        const schemaEditor = this._backend.getSchemaEditor();

        if (dep.type === "model") {
          // Drop the deprecated table
          await this._backend.executeRaw(
            `DROP TABLE IF EXISTS "${dep.deprecatedName}" CASCADE`,
          );
        } else {
          // Drop the deprecated column
          await this._backend.executeRaw(
            `ALTER TABLE "${dep.tableName}" DROP COLUMN IF EXISTS "${dep.deprecatedName}"`,
          );
        }

        // Mark as cleaned up
        await this._deprecationRecorder.markCleanedUp(dep.deprecatedName);

        console.log(`    Cleaned up ${dep.deprecatedName}`);
      }
    }

    if (dryRun) {
      console.log("\n(Dry run - no changes made)");
    }
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Get the migration recorder
   */
  getRecorder(): IMigrationRecorder {
    return this._recorder;
  }

  /**
   * Get the deprecation recorder
   */
  getDeprecationRecorder(): IDeprecationRecorder {
    return this._deprecationRecorder;
  }
}
