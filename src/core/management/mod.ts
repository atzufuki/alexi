/**
 * Alexi Core Management — Server-only
 *
 * Management commands, CLI utility, Application server, and configuration
 * loader. This sub-path is server-only and must never be imported in browser
 * or Service Worker bundles.
 *
 * @module @alexi/core/management
 *
 * @example manage.ts
 * ```ts
 * import { ManagementUtility } from "@alexi/core/management";
 *
 * const cli = new ManagementUtility();
 * const exitCode = await cli.execute(Deno.args);
 * Deno.exit(exitCode);
 * ```
 */

// =============================================================================
// CLI
// =============================================================================

export { execute, ManagementUtility } from "./management.ts";

/** @deprecated Use import functions in INSTALLED_APPS instead. */
export { pathToFileUrl } from "./management.ts";

// =============================================================================
// Application (HTTP server)
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
// Base Command infrastructure
// =============================================================================

export { ArgumentParser } from "./argument_parser.ts";
export { BaseCommand, failure, success } from "./base_command.ts";
export {
  CommandRegistry,
  globalRegistry,
  registerCommand,
} from "./registry.ts";
export type {
  ArgumentConfig,
  ArgumentType,
  CommandConstructor,
  CommandMeta,
  CommandOptions,
  CommandResult,
  IArgumentParser,
  ICommand,
  ICommandRegistry,
  IConsole,
  ManagementConfig,
  ParsedArguments,
} from "./types.ts";

// =============================================================================
// Built-in Commands
// =============================================================================

export {
  FlushCommand,
  HelpCommand,
  MakemigrationsCommand,
  MigrateCommand,
  ShowmigrationsCommand,
  SqlmigrateCommand,
  StartAppCommand,
  TestCommand,
} from "./commands/mod.ts";
export type { AppType, TestConfig } from "./commands/mod.ts";
