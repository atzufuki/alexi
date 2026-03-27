/**
 * Flush Command for Alexi DB
 *
 * Django-style command that clears all data from the configured database
 * backend. Similar to Django's `manage.py flush` command.
 *
 * @module @alexi/core/commands/flush
 */

import { BaseCommand, failure, success } from "../base_command.ts";
import type {
  CommandOptions,
  CommandResult,
  IArgumentParser,
} from "../types.ts";
import { configure } from "../config.ts";
import { getBackend, getBackendByName } from "@alexi/db";

// =============================================================================
// FlushCommand Class
// =============================================================================

/**
 * Built-in command for clearing all data from the configured database backend.
 *
 * Uses the `DATABASES` configuration from settings (the same way `migrate`
 * does) and delegates to {@link DatabaseBackend.flush} — so it works with
 * DenoKV, SQLite, and PostgreSQL backends alike.
 *
 * @example Basic usage
 * ```bash
 * deno run -A --unstable-kv manage.ts flush --settings ./project/settings.ts
 * ```
 *
 * @example Skip confirmation prompt
 * ```bash
 * deno run -A --unstable-kv manage.ts flush --no-input --settings ./project/settings.ts
 * ```
 *
 * @example Target a named backend
 * ```bash
 * deno run -A --unstable-kv manage.ts flush --database secondary --settings ./project/settings.ts
 * ```
 */
export class FlushCommand extends BaseCommand {
  readonly name = "flush";
  readonly help = "Clear database by removing all data";
  override readonly description =
    "Removes all data from the configured database backend. " +
    "This action is irreversible. " +
    "Use --no-input to skip the confirmation prompt.";

  override readonly examples = [
    "manage.ts flush --settings ./project/settings.ts                    - Clear database (prompts for confirmation)",
    "manage.ts flush --yes --settings ./project/settings.ts              - Clear without confirmation",
    "manage.ts flush --no-input --settings ./project/settings.ts         - Clear without confirmation (same as --yes)",
    "manage.ts flush --database secondary --settings ./project/settings.ts - Use a named backend",
  ];

  // ===========================================================================
  // Argument Configuration
  // ===========================================================================

  override addArguments(parser: IArgumentParser): void {
    parser.addArgument("--settings", {
      type: "string",
      required: false,
      help: "Settings module to use (e.g. web, desktop, or a file path)",
    });

    parser.addArgument("--no-input", {
      type: "boolean",
      default: false,
      help: "Do not prompt for confirmation before clearing the database",
    });

    parser.addArgument("--yes", {
      type: "boolean",
      default: false,
      help: "Automatically confirm the flush (same as --no-input)",
    });

    parser.addArgument("--database", {
      type: "string",
      required: false,
      help: "Named backend from DATABASES settings (defaults to 'default')",
    });
  }

  // ===========================================================================
  // Command Execution
  // ===========================================================================

  async handle(options: CommandOptions): Promise<CommandResult> {
    const settingsName = options.args.settings as string | undefined;
    const noInput = options.args["no-input"] as boolean;
    const yes = options.args["yes"] as boolean;
    const skipConfirmation = noInput || yes;
    const databaseName = options.args.database as string | undefined;

    // Show warning
    this.stdout.log("");
    this.stdout.log("┌─────────────────────────────────────────────┐");
    this.stdout.log("│              ⚠️  WARNING ⚠️                  │");
    this.stdout.log("└─────────────────────────────────────────────┘");
    this.stdout.log("");
    this.stdout.log("This command will delete ALL data from the database!");
    this.stdout.log("This action CANNOT be undone.");
    this.stdout.log("");

    // Ask for confirmation unless --no-input or --yes is specified
    if (!skipConfirmation) {
      const confirmed = this.confirmFlush();
      if (!confirmed) {
        this.stdout.log("Operation cancelled.");
        return success();
      }
    }

    try {
      // Load settings and register the configured backend(s)
      await this.runConfigure(settingsName);

      // Resolve the backend to flush
      const backend = databaseName
        ? getBackendByName(databaseName)
        : getBackend();

      if (!backend) {
        return failure(
          "No database backend configured. Check your DATABASES settings.",
        );
      }

      if (!backend.isConnected) {
        await backend.connect();
      }

      const backendLabel = databaseName ?? "default";
      this.stdout.log("");
      this.stdout.log(
        `Clearing database (backend: ${backendLabel}, engine: ${backend.config.engine})...`,
      );

      const deletedCount = await backend.flush();

      this.stdout.log("");
      this.stdout.log("✓ Database cleared successfully!");
      this.stdout.log(`  Deleted ${deletedCount} entries.`);
      this.stdout.log("");

      return success();
    } catch (error) {
      this.error(
        `Failed to clear database: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return failure(error instanceof Error ? error.message : String(error));
    }
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  /**
   * Ask for confirmation before flushing.
   *
   * @returns `true` if the user confirmed.
   */
  private confirmFlush(): boolean {
    const confirmText = "yes";

    // Use prompt() which works reliably across terminals including Git Bash
    const input = prompt(
      `Type "${confirmText}" to confirm clearing the database:`,
    );

    if (input === null) {
      return false;
    }

    const cleanedInput = input.trim().toLowerCase();
    return cleanedInput === confirmText;
  }

  /**
   * Load settings and register database backends.
   *
   * Extracted as a protected method so tests can override it without
   * touching the filesystem or real settings modules.
   *
   * @param settingsArg - Settings module name or path.
   */
  protected async runConfigure(settingsArg?: string): Promise<void> {
    await configure(settingsArg);
  }
}
