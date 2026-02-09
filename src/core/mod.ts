/**
 * Alexi Core - Django-inspired Management Commands for Deno
 *
 * Provides a command-line interface framework for running management commands
 * similar to Django's manage.py.
 *
 * @module @alexi/core
 *
 * @example Basic manage.ts
 * ```ts
 * // manage.ts
 * import { ManagementUtility } from "@alexi/core";
 *
 * const cli = new ManagementUtility();
 * const exitCode = await cli.execute(Deno.args);
 * Deno.exit(exitCode);
 * ```
 *
 * @example Custom command
 * ```ts
 * import { BaseCommand, success, failure } from "@alexi/core";
 * import type { CommandOptions, CommandResult, IArgumentParser } from "@alexi/core";
 *
 * class MigrateCommand extends BaseCommand {
 *   readonly name = "migrate";
 *   readonly help = "Run database migrations";
 *
 *   addArguments(parser: IArgumentParser): void {
 *     parser.addArgument("--fake", {
 *       type: "boolean",
 *       default: false,
 *       help: "Mark migrations as run without actually running them",
 *     });
 *   }
 *
 *   async handle(options: CommandOptions): Promise<CommandResult> {
 *     const fake = options.args.fake as boolean;
 *
 *     if (fake) {
 *       this.warn("Running in fake mode - no migrations will be applied");
 *     }
 *
 *     // ... migration logic ...
 *
 *     this.success("Migrations applied successfully");
 *     return success();
 *   }
 * }
 *
 * // Register the command
 * const cli = new ManagementUtility();
 * cli.registerCommand(MigrateCommand);
 * ```
 */

// =============================================================================
// Core Classes
// =============================================================================

export { execute, ManagementUtility } from "./management.ts";

/**
 * @deprecated Use import functions in INSTALLED_APPS instead.
 * This will be removed in v0.9.0.
 */
export { pathToFileUrl } from "./management.ts";
export { BaseCommand, failure, success } from "./base_command.ts";
export { ArgumentParser } from "./argument_parser.ts";
export {
  CommandRegistry,
  globalRegistry,
  registerCommand,
} from "./registry.ts";

// =============================================================================
// Application (HTTP Application Handler)
// =============================================================================

export { Application } from "./application.ts";
export type {
  ApplicationOptions,
  Handler,
  ServeOptions,
} from "./application.ts";

// =============================================================================
// Configuration
// =============================================================================

export {
  configure,
  createApplication,
  getLoadedApps,
  getSettings,
  getSettingsModuleName,
  getSettingsModulePath,
  initializeDatabase,
  isConfigured,
  isDatabaseInitialized,
  loadInstalledApps,
  loadSettings,
  loadUrlPatterns,
  resetConfiguration,
} from "./config.ts";
export type {
  AlexiSettings,
  AppImportFn,
  DatabaseConfig,
  LoadedApp,
  ServerConfig,
  UrlImportFn,
} from "./config.ts";

// =============================================================================
// Built-in Commands (only core commands: help, test)
// Other commands are provided by their respective modules:
// - bundle, collectstatic, runserver (static) → @alexi/staticfiles
// - runserver (web) → @alexi/web
// - runserver (desktop) → @alexi/webui
// - createsuperuser → @alexi/auth
// - flush → @alexi/db
// =============================================================================

export { HelpCommand, TestCommand } from "./commands/mod.ts";
export type { TestConfig } from "./commands/mod.ts";

// =============================================================================
// Types
// =============================================================================

export type {
  ArgumentConfig,
  // Argument types
  ArgumentType,
  CommandConstructor,
  CommandMeta,
  // Command types
  CommandOptions,
  CommandResult,
  IArgumentParser,
  ICommand,
  ICommandRegistry,
  IConsole,
  // Configuration
  ManagementConfig,
  ParsedArguments,
} from "./types.ts";
