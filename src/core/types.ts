/**
 * Types for Alexi Management Commands
 *
 * Provides type definitions for the management command system.
 *
 * @module @alexi/management/types
 */

// =============================================================================
// Argument Types
// =============================================================================

/**
 * Supported argument value types
 */
export type ArgumentType = "string" | "number" | "boolean" | "array";

/**
 * Configuration for a command argument
 */
export interface ArgumentConfig {
  /** Argument type (default: "string") */
  type?: ArgumentType;

  /** Default value if not provided */
  default?: unknown;

  /** Whether this argument is required */
  required?: boolean;

  /** Help text for this argument */
  help?: string;

  /** Short alias (e.g., "-p" for "--port") */
  alias?: string;

  /** Valid choices for this argument */
  choices?: readonly (string | number)[];
}

/**
 * Parsed argument values
 */
export interface ParsedArguments {
  /** Positional arguments */
  _: string[];

  /** Named arguments */
  [key: string]: unknown;
}

// =============================================================================
// Command Types
// =============================================================================

/**
 * Options passed to a command's handle method
 */
export interface CommandOptions {
  /** Parsed arguments */
  args: ParsedArguments;

  /** Raw command line arguments */
  rawArgs: string[];

  /** Whether debug mode is enabled */
  debug: boolean;
}

/**
 * Result of command execution
 */
export interface CommandResult {
  /** Exit code (0 = success) */
  exitCode: number;

  /** Optional message */
  message?: string;
}

/**
 * Command metadata
 */
export interface CommandMeta {
  /** Command name (e.g., "runserver") */
  name: string;

  /** Short description for help */
  help: string;

  /** Long description for detailed help */
  description?: string;

  /** Usage examples */
  examples?: string[];
}

// =============================================================================
// Argument Parser Types
// =============================================================================

/**
 * Interface for argument parser
 */
export interface IArgumentParser {
  /**
   * Add an argument definition
   */
  addArgument(name: string, config?: ArgumentConfig): this;

  /**
   * Parse command line arguments
   */
  parse(args: string[]): ParsedArguments;

  /**
   * Get help text for all arguments
   */
  getHelp(): string;
}

// =============================================================================
// Command Interface
// =============================================================================

/**
 * Interface that all commands must implement
 */
export interface ICommand {
  /** Command name */
  readonly name: string;

  /** Help text */
  readonly help: string;

  /**
   * Configure arguments for this command
   */
  addArguments(parser: IArgumentParser): void;

  /**
   * Execute the command
   */
  handle(options: CommandOptions): Promise<CommandResult>;
}

// =============================================================================
// Command Registry Types
// =============================================================================

/**
 * Command constructor type
 */
export type CommandConstructor = new () => ICommand;

/**
 * Registry of available commands
 */
export interface ICommandRegistry {
  /**
   * Register a command
   */
  register(command: CommandConstructor): void;

  /**
   * Get a command by name
   */
  get(name: string): ICommand | undefined;

  /**
   * Get all registered commands
   */
  all(): ICommand[];

  /**
   * Check if a command is registered
   */
  has(name: string): boolean;
}

// =============================================================================
// Management Utility Types
// =============================================================================

/**
 * Configuration for the management CLI
 */
export interface ManagementConfig {
  /** Debug mode */
  debug?: boolean;

  /** Project root directory */
  projectRoot?: string;

  /** Custom commands to register */
  commands?: CommandConstructor[];
}

/**
 * Console output interface for testability
 */
export interface IConsole {
  log(...args: unknown[]): void;
  error(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  info(...args: unknown[]): void;
}
