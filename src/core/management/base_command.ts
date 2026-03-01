/**
 * Base Command for Alexi Management Commands
 *
 * Provides an abstract base class that all commands extend.
 *
 * @module @alexi/management/base_command
 */

import { ArgumentParser } from "./argument_parser.ts";
import type {
  CommandOptions,
  CommandResult,
  IArgumentParser,
  ICommand,
  IConsole,
} from "./types.ts";

// =============================================================================
// BaseCommand Class
// =============================================================================

/**
 * Abstract base class for management commands
 *
 * All custom commands should extend this class and implement
 * the abstract `handle` method.
 *
 * @example
 * ```ts
 * class RunServerCommand extends BaseCommand {
 *   name = "runserver";
 *   help = "Start the development server";
 *
 *   addArguments(parser: IArgumentParser): void {
 *     parser.addArgument("--port", {
 *       type: "number",
 *       default: 8000,
 *       help: "Port to listen on",
 *     });
 *     parser.addArgument("--host", {
 *       type: "string",
 *       default: "0.0.0.0",
 *       help: "Host to bind to",
 *     });
 *   }
 *
 *   async handle(options: CommandOptions): Promise<CommandResult> {
 *     const port = options.args.port as number;
 *     const host = options.args.host as string;
 *
 *     this.stdout.log(`Starting server on ${host}:${port}...`);
 *
 *     // ... start server logic ...
 *
 *     return { exitCode: 0 };
 *   }
 * }
 * ```
 */
export abstract class BaseCommand implements ICommand {
  // ===========================================================================
  // Command Metadata (override in subclasses)
  // ===========================================================================

  /**
   * Command name (e.g., "runserver", "migrate")
   *
   * This is what users type to invoke the command.
   */
  abstract readonly name: string;

  /**
   * Short help text shown in command listings
   */
  abstract readonly help: string;

  /**
   * Longer description shown in detailed help
   */
  description?: string;

  /**
   * Usage examples for the help text
   */
  examples?: string[];

  // ===========================================================================
  // Console Output
  // ===========================================================================

  /**
   * Standard output console (can be overridden for testing)
   */
  protected stdout: IConsole = console;

  /**
   * Standard error console (can be overridden for testing)
   */
  protected stderr: IConsole = console;

  /**
   * Set the console implementations (useful for testing)
   */
  setConsole(stdout: IConsole, stderr?: IConsole): void {
    this.stdout = stdout;
    this.stderr = stderr ?? stdout;
  }

  // ===========================================================================
  // Argument Configuration
  // ===========================================================================

  /**
   * Configure arguments for this command
   *
   * Override this method to add command-specific arguments.
   *
   * @param parser - The argument parser to configure
   *
   * @example
   * ```ts
   * addArguments(parser: IArgumentParser): void {
   *   parser.addArgument("--port", {
   *     type: "number",
   *     default: 8000,
   *     alias: "-p",
   *     help: "Port number",
   *   });
   * }
   * ```
   */
  addArguments(_parser: IArgumentParser): void {
    // Default: no additional arguments
    // Subclasses override this to add their own arguments
  }

  // ===========================================================================
  // Command Execution
  // ===========================================================================

  /**
   * Execute the command
   *
   * This is the main entry point that subclasses must implement.
   *
   * @param options - Command execution options including parsed arguments
   * @returns Result with exit code and optional message
   */
  abstract handle(options: CommandOptions): Promise<CommandResult>;

  // ===========================================================================
  // Execution Helpers
  // ===========================================================================

  /**
   * Run the command with the given arguments
   *
   * This is called by the command runner. It:
   * 1. Creates an argument parser
   * 2. Configures it with the command's arguments
   * 3. Parses the raw arguments
   * 4. Calls handle() with the parsed options
   *
   * @param args - Raw command line arguments (after the command name)
   * @param debug - Whether debug mode is enabled
   * @returns Command result
   */
  async run(args: string[], debug = false): Promise<CommandResult> {
    const parser = new ArgumentParser();

    // Add common arguments
    this.addCommonArguments(parser);

    // Add command-specific arguments
    this.addArguments(parser);

    try {
      const parsedArgs = parser.parse(args);

      // Check for help flag
      if (parsedArgs.help) {
        this.printHelp(parser);
        return { exitCode: 0 };
      }

      return await this.handle({
        args: parsedArgs,
        rawArgs: args,
        debug: debug || (parsedArgs.debug as boolean) || false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.stderr.error(`Error: ${message}`);
      return { exitCode: 1, message };
    }
  }

  /**
   * Add common arguments available to all commands
   */
  private addCommonArguments(parser: IArgumentParser): void {
    parser.addArgument("--help", {
      type: "boolean",
      default: false,
      alias: "-h",
      help: "Show this help message",
    });

    parser.addArgument("--debug", {
      type: "boolean",
      default: false,
      help: "Enable debug mode",
    });
  }

  // ===========================================================================
  // Help Output
  // ===========================================================================

  /**
   * Print help text for this command
   */
  printHelp(parser?: IArgumentParser): void {
    const lines: string[] = [];

    // Header
    lines.push(`Usage: manage.ts ${this.name} [options]`);
    lines.push("");

    // Description
    lines.push(this.description ?? this.help);
    lines.push("");

    // Arguments
    if (parser) {
      lines.push(parser.getHelp());
    }

    // Examples
    if (this.examples && this.examples.length > 0) {
      lines.push("");
      lines.push("Examples:");
      for (const example of this.examples) {
        lines.push(`  ${example}`);
      }
    }

    this.stdout.log(lines.join("\n"));
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  /**
   * Print a success message
   */
  protected success(message: string): void {
    this.stdout.log(`✓ ${message}`);
  }

  /**
   * Print an error message
   */
  protected error(message: string): void {
    this.stderr.error(`✗ ${message}`);
  }

  /**
   * Print a warning message
   */
  protected warn(message: string): void {
    this.stderr.warn(`⚠ ${message}`);
  }

  /**
   * Print an info message
   */
  protected info(message: string): void {
    this.stdout.info(`ℹ ${message}`);
  }

  /**
   * Print a debug message (only if debug mode is enabled)
   */
  protected debug(message: string, isDebug: boolean): void {
    if (isDebug) {
      this.stdout.log(`[DEBUG] ${message}`);
    }
  }
}

// =============================================================================
// Success/Error Result Helpers
// =============================================================================

/**
 * Create a success result
 */
export function success(message?: string): CommandResult {
  return { exitCode: 0, message };
}

/**
 * Create an error result
 */
export function failure(message?: string, exitCode = 1): CommandResult {
  return { exitCode, message };
}
