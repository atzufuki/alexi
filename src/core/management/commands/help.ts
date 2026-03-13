/**
 * Help Command for Alexi Management Commands
 *
 * Built-in command that displays help information about available commands.
 *
 * @module @alexi/management/commands/help
 */

import { BaseCommand, success } from "../base_command.ts";
import type {
  CommandOptions,
  CommandResult,
  IArgumentParser,
  UsageConfig,
} from "../types.ts";
import type { CommandRegistry } from "../registry.ts";

// =============================================================================
// HelpCommand Class
// =============================================================================

/**
 * Built-in command for displaying help information
 *
 * Shows a list of all available commands or detailed help for a specific command.
 *
 * @example List all commands
 * ```bash
 * deno run -A manage.ts help
 * ```
 *
 * @example Get help for a specific command
 * ```bash
 * deno run -A manage.ts help runserver
 * ```
 */
export class HelpCommand extends BaseCommand {
  readonly name = "help";
  readonly help = "Show available commands or command help";
  override readonly description = "Shows a list of all available commands, " +
    "or detailed help for a specific command.";

  private title = "Available Commands";
  private usage: string[] = ["Usage: cli <command> [arguments]"];

  override readonly examples = [
    "manage.ts help              - List all commands",
    "manage.ts help runserver    - Show help for runserver command",
  ];

  /**
   * Reference to the command registry for looking up other commands
   */
  private registry: CommandRegistry | null = null;

  /**
   * Set the command registry (called by ManagementUtility)
   */
  setRegistry(registry: CommandRegistry): void {
    this.registry = registry;
  }

  setDisplayOptions(options: { title?: string; usage?: UsageConfig }): void {
    if (options.title) {
      this.title = options.title;
    }

    if (options.usage) {
      this.usage = Array.isArray(options.usage)
        ? options.usage
        : [options.usage];
    }
  }

  // ===========================================================================
  // Argument Configuration
  // ===========================================================================

  override addArguments(parser: IArgumentParser): void {
    parser.addArgument("command", {
      required: false,
      help: "Command to show help for",
    });
  }

  // ===========================================================================
  // Command Execution
  // ===========================================================================

  async handle(options: CommandOptions): Promise<CommandResult> {
    const commandName = options.args.command as string | undefined;

    if (commandName && this.registry) {
      // Show help for a specific command
      return this.showCommandHelp(commandName);
    }

    // Show general help with list of commands
    return this.showGeneralHelp();
  }

  /**
   * Show help for a specific command
   */
  private showCommandHelp(commandName: string): CommandResult {
    if (!this.registry) {
      this.error("Command registry not available");
      return { exitCode: 1 };
    }

    const command = this.registry.get(commandName);

    if (!command) {
      this.error(`Command "${commandName}" not found`);
      this.stdout.log("");
      this.stdout.log("Available commands:");
      this.stdout.log(this.registry.getCommandList());
      return { exitCode: 1 };
    }

    // Use the command's own help printing if it's a BaseCommand
    if ("printHelp" in command && typeof command.printHelp === "function") {
      if (command instanceof BaseCommand) {
        command.setProgramName(this.programName);
      }
      (command as BaseCommand).printHelp();
    } else {
      this.stdout.log(`${command.name}: ${command.help}`);
    }

    return success();
  }

  /**
   * Show general help with list of all commands
   */
  private showGeneralHelp(): CommandResult {
    const lines: string[] = [];

    if (this.title.length > 0) {
      lines.push(this.title);
      lines.push("");
    }

    lines.push(...this.usage);
    lines.push("");

    if (this.registry) {
      lines.push("Available commands:");
      lines.push(this.registry.getCommandList());
    } else {
      // This should not happen in normal operation: ManagementUtility calls
      // setRegistry() on the HelpCommand instance during construction.
      // If registry is null here, the instance was likely created outside of
      // ManagementUtility (e.g. in tests) or setRegistry() was never called.
      lines.push(
        "No commands registered. " +
          "(Hint: use ManagementUtility / getCliApplication to run commands.)",
      );
    }

    lines.push("");
    lines.push(
      "Use 'help <command>' for more information about a specific command.",
    );

    this.stdout.log(lines.join("\n"));

    return success();
  }
}
