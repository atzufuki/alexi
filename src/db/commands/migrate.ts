/**
 * Migrate Command
 *
 * Apply or revert database migrations.
 *
 * @module @alexi/db/commands/migrate
 */

import { BaseCommand, failure, success } from "@alexi/core";
import type {
  CommandOptions,
  CommandResult,
  IArgumentParser,
} from "@alexi/core";
import { MigrationLoader } from "../migrations/loader.ts";
import { MigrationExecutor } from "../migrations/executor.ts";
import { getBackend, getBackendByName } from "../setup.ts";

// =============================================================================
// MigrateCommand Class
// =============================================================================

/**
 * Apply or revert database migrations
 *
 * @example Apply all pending migrations
 * ```bash
 * deno run -A manage.ts migrate
 * ```
 *
 * @example Migrate to a specific migration
 * ```bash
 * deno run -A manage.ts migrate users.0002_add_email
 * ```
 *
 * @example Rollback all migrations for an app
 * ```bash
 * deno run -A manage.ts migrate users zero
 * ```
 *
 * @example Show what would be done without applying
 * ```bash
 * deno run -A manage.ts migrate --plan
 * ```
 *
 * @example Test reversibility (forward -> backward -> forward)
 * ```bash
 * deno run -A manage.ts migrate --test
 * ```
 */
export class MigrateCommand extends BaseCommand {
  readonly name = "migrate";
  readonly help = "Apply database migrations";
  override readonly description =
    "Applies or reverts database migrations. Use [app] [migration] to migrate " +
    "to a specific state, or 'zero' to rollback all migrations for an app.";

  override readonly examples = [
    "manage.ts migrate                        - Apply all pending migrations",
    "manage.ts migrate users                  - Apply migrations for 'users' app",
    "manage.ts migrate users 0002_add_email   - Migrate to specific migration",
    "manage.ts migrate users zero             - Rollback all 'users' migrations",
    "manage.ts migrate --plan                 - Show what would be done",
    "manage.ts migrate --test                 - Test migration reversibility",
    "manage.ts migrate --cleanup              - Clean up old deprecated items",
  ];

  // ===========================================================================
  // Argument Configuration
  // ===========================================================================

  override addArguments(parser: IArgumentParser): void {
    parser.addArgument("app", {
      type: "string",
      required: false,
      help: "App label to migrate (optional)",
    });

    parser.addArgument("migration", {
      type: "string",
      required: false,
      help: "Target migration name, or 'zero' to rollback all",
    });

    parser.addArgument("--plan", {
      type: "boolean",
      default: false,
      help: "Show execution plan without applying migrations",
    });

    parser.addArgument("--test", {
      type: "boolean",
      default: false,
      help: "Test reversibility: apply -> rollback -> reapply",
    });

    parser.addArgument("--cleanup", {
      type: "boolean",
      default: false,
      help: "Clean up deprecated items older than --cleanup-days",
    });

    parser.addArgument("--cleanup-days", {
      type: "number",
      default: 30,
      help: "Minimum age in days for cleanup (default: 30)",
    });

    parser.addArgument("--database", {
      type: "string",
      required: false,
      help: "Database backend name (from settings)",
    });

    parser.addArgument("--migrations-dir", {
      type: "string",
      required: false,
      help: "Path to migrations directory (default: ./migrations)",
    });

    parser.addArgument("--verbosity", {
      type: "number",
      default: 1,
      alias: "-v",
      help: "Verbosity level: 0=silent, 1=normal, 2=verbose",
    });
  }

  // ===========================================================================
  // Command Execution
  // ===========================================================================

  async handle(options: CommandOptions): Promise<CommandResult> {
    const appLabel = options.args.app as string | undefined;
    const targetMigration = options.args.migration as string | undefined;
    const showPlan = options.args.plan as boolean;
    const testMode = options.args.test as boolean;
    const cleanup = options.args.cleanup as boolean;
    const cleanupDays = options.args["cleanup-days"] as number;
    const databaseName = options.args.database as string | undefined;
    const migrationsDir = options.args["migrations-dir"] as string | undefined;
    const verbosity = options.args.verbosity as number;

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

      // Create executor
      const executor = new MigrationExecutor(backend, loader);

      // Handle cleanup mode
      if (cleanup) {
        await executor.cleanup({
          minAgeDays: cleanupDays,
          dryRun: showPlan,
          verbosity,
        });
        return success();
      }

      // Determine target
      let to: string | undefined;
      if (targetMigration) {
        if (targetMigration === "zero") {
          to = "zero";
        } else if (appLabel) {
          to = `${appLabel}.${targetMigration}`;
        } else {
          to = targetMigration;
        }
      }

      // Show plan
      if (showPlan) {
        const plan = await executor.plan({ to, appLabel });

        this.stdout.log("\nMigration Plan:");
        this.stdout.log("===============\n");

        if (plan.toUnapply.length > 0) {
          this.stdout.log("Migrations to ROLLBACK:");
          for (const m of plan.toUnapply) {
            this.stdout.log(`  [-] ${m.migration.getFullName()}`);
          }
          this.stdout.log("");
        }

        if (plan.toApply.length > 0) {
          this.stdout.log("Migrations to APPLY:");
          for (const m of plan.toApply) {
            this.stdout.log(`  [+] ${m.migration.getFullName()}`);
          }
          this.stdout.log("");
        }

        if (plan.totalOperations === 0) {
          this.stdout.log("No migrations to apply.");
        } else {
          this.stdout.log(`Total: ${plan.totalOperations} operation(s)`);
        }

        return success();
      }

      // Execute migrations
      const results = await executor.migrate({
        to,
        appLabel,
        verbosity,
        testMode,
      });

      // Summary
      const successful = results.filter((r) => r.success);
      const failed = results.filter((r) => !r.success);

      if (verbosity > 0) {
        this.stdout.log("");
        if (successful.length > 0) {
          this.success(
            `${successful.length} migration(s) applied successfully`,
          );
        }
        if (failed.length > 0) {
          this.error(`${failed.length} migration(s) failed`);
        }
      }

      return failed.length > 0 ? failure() : success();
    } catch (error) {
      this.error(
        error instanceof Error ? error.message : String(error),
      );
      return failure();
    }
  }
}
