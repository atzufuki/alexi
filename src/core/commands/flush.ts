/**
 * Flush Command for Alexi DB
 *
 * Django-style command that clears all data from the database.
 * Similar to Django's `manage.py flush` command.
 *
 * NOTE: This module requires `--unstable-kv` flag when running Deno.
 *
 * @module @alexi/core/commands/flush
 */

// Type declarations for Deno KV (unstable API)
// These allow the module to compile without --unstable-kv flag
declare namespace Deno {
  export interface Kv {
    delete(key: KvKey): Promise<void>;
    list<T>(selector: KvListSelector): KvListIterator<T>;
    close(): void;
  }

  export type KvKey = readonly KvKeyPart[];
  export type KvKeyPart = string | number | bigint | boolean | Uint8Array;

  export interface KvEntry<T> {
    key: KvKey;
    value: T;
    versionstamp: string;
  }

  export interface KvListSelector {
    prefix?: KvKey;
  }

  export interface KvListIterator<T> extends AsyncIterableIterator<KvEntry<T>> {
    cursor: string;
  }

  export function openKv(path?: string): Promise<Kv>;
}

import { BaseCommand, success } from "@alexi/core";
import type {
  CommandOptions,
  CommandResult,
  IArgumentParser,
} from "@alexi/core";

// =============================================================================
// FlushCommand Class
// =============================================================================

/**
 * Built-in command for clearing all data from the database
 *
 * Removes all data from the database while preserving the schema.
 * For DenoKV, this deletes all key-value pairs.
 *
 * @example Basic usage
 * ```bash
 * deno run -A --unstable-kv manage.ts flush
 * ```
 *
 * @example Skip confirmation prompt
 * ```bash
 * deno run -A --unstable-kv manage.ts flush --no-input
 * ```
 *
 * @example Specify custom database path
 * ```bash
 * deno run -A --unstable-kv manage.ts flush --database ./data/myapp.db
 * ```
 */
export class FlushCommand extends BaseCommand {
  readonly name = "flush";
  readonly help = "Clear database by removing all data";
  override readonly description =
    "Removes all data from the database. This action is irreversible. " +
    "Use --no-input to skip the confirmation prompt.";

  override readonly examples = [
    "manage.ts flush                    - Clear database (prompts for confirmation)",
    "manage.ts flush --yes              - Clear without confirmation",
    "manage.ts flush --no-input         - Clear without confirmation (same as --yes)",
    "manage.ts flush --database ./db    - Use specific database path",
  ];

  // ===========================================================================
  // Argument Configuration
  // ===========================================================================

  override addArguments(parser: IArgumentParser): void {
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
      help:
        "Database path (DenoKV). Defaults to DENO_KV_PATH or default location.",
    });
  }

  // ===========================================================================
  // Command Execution
  // ===========================================================================

  async handle(options: CommandOptions): Promise<CommandResult> {
    const noInput = options.args["no-input"] as boolean;
    const yes = options.args["yes"] as boolean;
    const skipConfirmation = noInput || yes;
    const databasePath = options.args.database as string | undefined;

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

    // Perform the flush
    try {
      const deletedCount = await this.flushDatabase(databasePath);

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
      return { exitCode: 1 };
    }
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  /**
   * Ask for confirmation before flushing
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
   * Flush all data from the database
   *
   * @param databasePath - Optional path to the DenoKV database
   * @returns Number of deleted entries
   */
  private async flushDatabase(databasePath?: string): Promise<number> {
    // Determine database path
    const kvPath = databasePath ?? Deno.env.get("DENO_KV_PATH");

    this.stdout.log("");
    this.stdout.log(
      `Clearing database${kvPath ? `: ${kvPath}` : " (default location)"}...`,
    );

    // Open DenoKV
    const kv = await Deno.openKv(kvPath);

    let deletedCount = 0;

    try {
      // List and delete all entries
      const entries = kv.list({ prefix: [] });

      for await (const entry of entries) {
        await kv.delete(entry.key);
        deletedCount++;

        // Show progress for large databases
        if (deletedCount % 100 === 0) {
          this.stdout.log(`  Deleted ${deletedCount} entries...`);
        }
      }
    } finally {
      // Always close the KV connection
      kv.close();
    }

    return deletedCount;
  }
}
