/**
 * Showmigrations Command
 *
 * Display all migrations and their applied status.
 *
 * @module @alexi/db/commands/showmigrations
 */

import { BaseCommand, failure, success } from "@alexi/core";
import type {
  CommandOptions,
  CommandResult,
  IArgumentParser,
} from "@alexi/core";
import { MigrationLoader } from "../migrations/loader.ts";
import {
  createDeprecationRecorder,
  createMigrationRecorder,
} from "../migrations/recorders/factory.ts";
import { getBackend, getBackendByName } from "../setup.ts";

// =============================================================================
// ShowmigrationsCommand Class
// =============================================================================

/**
 * Display migration status
 *
 * @example Show all migrations
 * ```bash
 * deno run -A manage.ts showmigrations
 * ```
 *
 * @example Show migrations for a specific app
 * ```bash
 * deno run -A manage.ts showmigrations users
 * ```
 *
 * @example Include deprecation information
 * ```bash
 * deno run -A manage.ts showmigrations --deprecations
 * ```
 */
export class ShowmigrationsCommand extends BaseCommand {
  readonly name = "showmigrations";
  readonly help = "Show all migrations and their status";
  override readonly description =
    "Displays a list of all migrations for each app, showing which have " +
    "been applied and which are pending.";

  override readonly examples = [
    "manage.ts showmigrations                - Show all migrations",
    "manage.ts showmigrations users          - Show migrations for 'users' app",
    "manage.ts showmigrations --deprecations - Include deprecation info",
    "manage.ts showmigrations --list         - Simple list format",
  ];

  // ===========================================================================
  // Argument Configuration
  // ===========================================================================

  override addArguments(parser: IArgumentParser): void {
    parser.addArgument("app", {
      type: "string",
      required: false,
      help: "App label to show migrations for",
    });

    parser.addArgument("--deprecations", {
      type: "boolean",
      default: false,
      help: "Show deprecation information",
    });

    parser.addArgument("--list", {
      type: "boolean",
      alias: "-l",
      default: false,
      help: "Use simple list format",
    });

    parser.addArgument("--database", {
      type: "string",
      required: false,
      help: "Database backend name",
    });

    parser.addArgument("--migrations-dir", {
      type: "string",
      required: false,
      help: "Path to migrations directory",
    });
  }

  // ===========================================================================
  // Command Execution
  // ===========================================================================

  async handle(options: CommandOptions): Promise<CommandResult> {
    const appLabel = options.args.app as string | undefined;
    const showDeprecations = options.args.deprecations as boolean;
    const listFormat = options.args.list as boolean;
    const databaseName = options.args.database as string | undefined;
    const migrationsDir = options.args["migrations-dir"] as string | undefined;

    try {
      // Get database backend
      const backend = databaseName
        ? getBackendByName(databaseName)
        : getBackend();

      if (!backend) {
        return failure("No database backend configured. Check your settings.");
      }

      // Ensure connected
      if (!backend.isConnected) {
        await backend.connect();
      }

      // Load migrations
      const loader = new MigrationLoader();
      const rootDir = migrationsDir ?? Deno.cwd();
      await loader.loadFromDirectory(rootDir);

      if (!loader.hasMigrations()) {
        this.stdout.log("No migrations found.");
        return success();
      }

      // Get applied migrations
      const recorder = createMigrationRecorder(backend);
      const appliedMigrations = await recorder.getAppliedMigrations();
      const appliedSet = new Set(appliedMigrations.map((m) => m.name));

      // Get app labels
      const appLabels = appLabel ? [appLabel] : loader.getAppLabels();

      // Display migrations
      if (listFormat) {
        await this._displayList(loader, appliedSet, appLabels);
      } else {
        await this._displayTree(
          loader,
          appliedSet,
          appLabels,
          appliedMigrations,
        );
      }

      // Show deprecations if requested
      if (showDeprecations) {
        await this._displayDeprecations(backend);
      }

      return success();
    } catch (error) {
      this.error(
        error instanceof Error ? error.message : String(error),
      );
      return failure();
    }
  }

  // ===========================================================================
  // Display Methods
  // ===========================================================================

  private async _displayList(
    loader: MigrationLoader,
    appliedSet: Set<string>,
    appLabels: string[],
  ): Promise<void> {
    for (const app of appLabels) {
      const migrations = loader.getMigrationsForApp(app);

      for (const m of migrations) {
        const fullName = m.migration.getFullName();
        const status = appliedSet.has(fullName) ? "[X]" : "[ ]";
        this.stdout.log(`${status} ${fullName}`);
      }
    }
  }

  private async _displayTree(
    loader: MigrationLoader,
    appliedSet: Set<string>,
    appLabels: string[],
    appliedMigrations: Array<{ name: string; appliedAt: Date }>,
  ): Promise<void> {
    const appliedDates = new Map(
      appliedMigrations.map((m) => [m.name, m.appliedAt]),
    );

    for (const app of appLabels) {
      this.stdout.log(`\n${app}`);
      this.stdout.log("─".repeat(app.length));

      const migrations = loader.getMigrationsForApp(app);

      if (migrations.length === 0) {
        this.stdout.log("  (no migrations)");
        continue;
      }

      for (const m of migrations) {
        const fullName = m.migration.getFullName();
        const isApplied = appliedSet.has(fullName);
        const status = isApplied ? "[X]" : "[ ]";
        const appliedAt = appliedDates.get(fullName);

        let line = `  ${status} ${m.migration.name}`;

        if (appliedAt) {
          line += ` (applied: ${this._formatDate(appliedAt)})`;
        }

        if (!m.migration.canReverse()) {
          line += " [irreversible]";
        }

        this.stdout.log(line);
      }
    }

    // Summary
    const allMigrations = loader.getOrderedMigrations();
    const applied = allMigrations.filter((m) =>
      appliedSet.has(m.migration.getFullName())
    );
    const pending = allMigrations.filter((m) =>
      !appliedSet.has(m.migration.getFullName())
    );

    this.stdout.log("");
    this.stdout.log(`Total: ${allMigrations.length} migration(s)`);
    this.stdout.log(`  Applied: ${applied.length}`);
    this.stdout.log(`  Pending: ${pending.length}`);
  }

  private async _displayDeprecations(backend: unknown): Promise<void> {
    const typedBackend =
      backend as import("../backends/backend.ts").DatabaseBackend;
    const deprecationRecorder = createDeprecationRecorder(typedBackend);

    try {
      const deprecations = await deprecationRecorder.getAll(true);

      if (deprecations.length === 0) {
        this.stdout.log("\nNo deprecations recorded.");
        return;
      }

      this.stdout.log("\nDeprecations");
      this.stdout.log("────────────");

      for (const dep of deprecations) {
        const status = dep.cleanedUp ? "[cleaned]" : "[active]";
        const ageInDays = Math.floor(
          (Date.now() - dep.deprecatedAt.getTime()) / (1000 * 60 * 60 * 24),
        );

        this.stdout.log(
          `  ${status} ${dep.type}: ${dep.originalName} → ${dep.deprecatedName}`,
        );
        this.stdout.log(
          `           (migration: ${dep.migrationName}, age: ${ageInDays} days)`,
        );
      }

      const active = deprecations.filter((d) => !d.cleanedUp);
      const readyForCleanup = active.filter(
        (d) => Date.now() - d.deprecatedAt.getTime() > 30 * 24 * 60 * 60 * 1000,
      );

      if (readyForCleanup.length > 0) {
        this.stdout.log("");
        this.stdout.log(
          `${readyForCleanup.length} deprecation(s) ready for cleanup (>30 days old)`,
        );
        this.stdout.log("Run 'migrate --cleanup' to permanently remove them.");
      }
    } catch {
      // Table might not exist yet
      this.stdout.log("\nNo deprecations recorded.");
    }
  }

  private _formatDate(date: Date): string {
    return date.toISOString().replace("T", " ").substring(0, 19);
  }
}
