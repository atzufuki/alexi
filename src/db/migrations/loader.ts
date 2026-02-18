/**
 * Migration Loader
 *
 * Loads migration files from disk and resolves dependencies.
 *
 * @module
 */

import { Migration } from "./migration.ts";

// ============================================================================
// Types
// ============================================================================

/**
 * Loaded migration with metadata
 */
export interface LoadedMigration {
  /** The migration instance */
  migration: Migration;
  /** Full path to the migration file */
  filePath: string;
  /** App label (derived from directory) */
  appLabel: string;
  /** Migration name */
  name: string;
}

/**
 * Migration graph node for dependency resolution
 */
interface MigrationNode {
  migration: LoadedMigration;
  dependencies: string[];
  dependents: string[];
}

// ============================================================================
// Migration Loader
// ============================================================================

/**
 * Migration Loader
 *
 * Discovers and loads migration files from the filesystem.
 * Resolves dependencies to determine execution order.
 *
 * ## Directory Structure
 *
 * Migrations are expected in `migrations/` subdirectories of each app:
 * ```
 * project/
 *   apps/
 *     users/
 *       migrations/
 *         0001_initial.ts
 *         0002_add_email.ts
 *     posts/
 *       migrations/
 *         0001_initial.ts
 * ```
 *
 * @example
 * ```ts
 * const loader = new MigrationLoader();
 *
 * // Load from project root
 * await loader.loadFromDirectory("./project");
 *
 * // Get all migrations in order
 * const ordered = loader.getOrderedMigrations();
 *
 * // Get migrations for a specific app
 * const userMigrations = loader.getMigrationsForApp("users");
 * ```
 */
export class MigrationLoader {
  private _migrations: Map<string, LoadedMigration> = new Map();
  private _graph: Map<string, MigrationNode> = new Map();
  private _orderedMigrations: LoadedMigration[] | null = null;

  // ==========================================================================
  // Loading
  // ==========================================================================

  /**
   * Load all migrations from a directory
   *
   * Recursively searches for `migrations/` subdirectories and loads
   * all TypeScript files within them.
   *
   * @param rootDir - Root directory to search
   */
  async loadFromDirectory(rootDir: string): Promise<void> {
    // Find all migrations directories
    const migrationDirs = await this._findMigrationDirectories(rootDir);

    for (const dir of migrationDirs) {
      await this._loadMigrationsFromDir(dir);
    }

    // Build dependency graph
    this._buildGraph();
  }

  /**
   * Load migrations from a list of file paths
   *
   * @param filePaths - Paths to migration files
   */
  async loadFromPaths(filePaths: string[]): Promise<void> {
    for (const filePath of filePaths) {
      await this._loadMigrationFile(filePath);
    }

    this._buildGraph();
  }

  /**
   * Register a migration instance directly (for testing)
   *
   * @param migration - Migration instance
   * @param appLabel - App label
   */
  register(migration: Migration, appLabel: string): void {
    migration.appLabel = appLabel;
    const fullName = migration.getFullName();

    this._migrations.set(fullName, {
      migration,
      filePath: "",
      appLabel,
      name: migration.name,
    });

    this._orderedMigrations = null; // Invalidate cache
    this._graph.clear(); // Clear graph so it gets rebuilt on next access
  }

  /**
   * Build the dependency graph if not already built
   */
  private _ensureGraph(): void {
    if (this._graph.size === 0 && this._migrations.size > 0) {
      this._buildGraph();
    }
  }

  // ==========================================================================
  // Querying
  // ==========================================================================

  /**
   * Get all migrations in dependency order
   *
   * Returns migrations sorted so that dependencies come before dependents.
   */
  getOrderedMigrations(): LoadedMigration[] {
    if (this._orderedMigrations === null) {
      this._ensureGraph();
      this._orderedMigrations = this._topologicalSort();
    }
    return this._orderedMigrations;
  }

  /**
   * Get migrations for a specific app
   *
   * @param appLabel - App label to filter by
   */
  getMigrationsForApp(appLabel: string): LoadedMigration[] {
    return Array.from(this._migrations.values())
      .filter((m) => m.appLabel === appLabel)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Get a specific migration by full name
   *
   * @param fullName - Full migration name (e.g., "users.0001_initial")
   */
  getMigration(fullName: string): LoadedMigration | undefined {
    return this._migrations.get(fullName);
  }

  /**
   * Get all app labels that have migrations
   */
  getAppLabels(): string[] {
    const labels = new Set<string>();
    for (const m of this._migrations.values()) {
      labels.add(m.appLabel);
    }
    return Array.from(labels).sort();
  }

  /**
   * Check if there are any migrations
   */
  hasMigrations(): boolean {
    return this._migrations.size > 0;
  }

  /**
   * Get the leaf migrations (migrations with no dependents)
   *
   * These are the "latest" migrations in each dependency chain.
   */
  getLeafMigrations(): LoadedMigration[] {
    this._ensureGraph();
    const leaves: LoadedMigration[] = [];

    for (const node of this._graph.values()) {
      if (node.dependents.length === 0) {
        leaves.push(node.migration);
      }
    }

    return leaves;
  }

  /**
   * Get migrations that depend on a given migration
   *
   * @param fullName - Full migration name
   */
  getDependents(fullName: string): LoadedMigration[] {
    this._ensureGraph();
    const node = this._graph.get(fullName);
    if (!node) return [];

    return node.dependents
      .map((name) => this._migrations.get(name))
      .filter((m): m is LoadedMigration => m !== undefined);
  }

  /**
   * Get migrations that a given migration depends on
   *
   * @param fullName - Full migration name
   */
  getDependencies(fullName: string): LoadedMigration[] {
    this._ensureGraph();
    const node = this._graph.get(fullName);
    if (!node) return [];

    return node.dependencies
      .map((name) => this._migrations.get(name))
      .filter((m): m is LoadedMigration => m !== undefined);
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private async _findMigrationDirectories(rootDir: string): Promise<string[]> {
    const dirs: string[] = [];

    try {
      for await (const entry of Deno.readDir(rootDir)) {
        if (entry.isDirectory) {
          const subPath = `${rootDir}/${entry.name}`;

          if (entry.name === "migrations") {
            dirs.push(subPath);
          } else if (
            !entry.name.startsWith(".") && entry.name !== "node_modules"
          ) {
            // Recursively search subdirectories
            const subDirs = await this._findMigrationDirectories(subPath);
            dirs.push(...subDirs);
          }
        }
      }
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) {
        throw error;
      }
    }

    return dirs;
  }

  private async _loadMigrationsFromDir(dir: string): Promise<void> {
    // Extract app label from directory path
    // e.g., "project/apps/users/migrations" -> "users"
    const parts = dir.split("/");
    const migrationsIndex = parts.indexOf("migrations");
    const appLabel = migrationsIndex > 0
      ? parts[migrationsIndex - 1]
      : "default";

    try {
      for await (const entry of Deno.readDir(dir)) {
        if (
          entry.isFile && entry.name.endsWith(".ts") &&
          !entry.name.startsWith("_")
        ) {
          const filePath = `${dir}/${entry.name}`;
          await this._loadMigrationFile(filePath, appLabel);
        }
      }
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) {
        throw error;
      }
    }
  }

  private async _loadMigrationFile(
    filePath: string,
    appLabel?: string,
  ): Promise<void> {
    try {
      // Dynamic import of the migration file
      const module = await import(`file://${Deno.realPathSync(filePath)}`);

      // Get the default export (the migration class)
      const MigrationClass = module.default;

      if (!MigrationClass || typeof MigrationClass !== "function") {
        console.warn(`Migration file ${filePath} has no default export`);
        return;
      }

      // Instantiate the migration
      const migration = new MigrationClass() as Migration;

      // Derive app label if not provided
      if (!appLabel) {
        const parts = filePath.split("/");
        const migrationsIndex = parts.indexOf("migrations");
        appLabel = migrationsIndex > 0 ? parts[migrationsIndex - 1] : "default";
      }

      migration.appLabel = appLabel;
      const fullName = migration.getFullName();

      this._migrations.set(fullName, {
        migration,
        filePath,
        appLabel,
        name: migration.name,
      });
    } catch (error) {
      throw new Error(
        `Failed to load migration from ${filePath}: ${
          error instanceof Error ? error.message : error
        }`,
      );
    }
  }

  private _buildGraph(): void {
    this._graph.clear();

    // First pass: create nodes
    for (const [fullName, loaded] of this._migrations) {
      const dependencies = loaded.migration.getResolvedDependencies();

      this._graph.set(fullName, {
        migration: loaded,
        dependencies,
        dependents: [],
      });
    }

    // Second pass: populate dependents
    for (const [fullName, node] of this._graph) {
      for (const depName of node.dependencies) {
        const depNode = this._graph.get(depName);
        if (depNode) {
          depNode.dependents.push(fullName);
        } else {
          throw new Error(
            `Migration '${fullName}' depends on '${depName}' which was not found`,
          );
        }
      }
    }
  }

  private _topologicalSort(): LoadedMigration[] {
    const result: LoadedMigration[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (fullName: string) => {
      if (visited.has(fullName)) return;
      if (visiting.has(fullName)) {
        throw new Error(`Circular dependency detected involving '${fullName}'`);
      }

      visiting.add(fullName);

      const node = this._graph.get(fullName);
      if (node) {
        for (const dep of node.dependencies) {
          visit(dep);
        }
        result.push(node.migration);
      }

      visiting.delete(fullName);
      visited.add(fullName);
    };

    // Visit all nodes
    for (const fullName of this._graph.keys()) {
      visit(fullName);
    }

    return result;
  }
}
