/**
 * Management Utility for Alexi Core
 *
 * Main CLI entry point that orchestrates command execution.
 *
 * @module @alexi/core/management
 */

import { BaseCommand } from "./base_command.ts";
import { CommandRegistry, globalRegistry } from "./registry.ts";
import { HelpCommand } from "./commands/help.ts";
import { TestCommand } from "./commands/test.ts";
import { StartAppCommand } from "./commands/startapp.ts";
import type {
  CommandConstructor,
  IConsole,
  ManagementConfig,
} from "./types.ts";
import type { AppConfig } from "@alexi/types";

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Convert a file path to a file:// URL string for dynamic import.
 *
 * This is an internal helper for loading project-local settings files.
 * It handles Windows paths correctly.
 *
 * NOTE: This is only used for settings files (loaded via --settings CLI arg).
 * App modules use import functions provided by the user in settings.
 *
 * @param filePath - File system path
 * @returns file:// URL string suitable for dynamic import
 * @internal
 */
function toImportUrl(filePath: string): string {
  // Normalize backslashes to forward slashes
  let normalized = filePath.replace(/\\/g, "/");

  // Remove leading ./ if present
  if (normalized.startsWith("./")) {
    normalized = normalized.slice(2);
  }

  // Check if it's a Windows absolute path (e.g., C:/...)
  if (/^[a-zA-Z]:\//.test(normalized)) {
    return `file:///${normalized}`;
  }

  // Check if it's a Windows path without forward slash yet (e.g., C:\...)
  if (/^[a-zA-Z]:/.test(normalized)) {
    return `file:///${normalized}`;
  }

  // Unix absolute path
  if (normalized.startsWith("/")) {
    return `file://${normalized}`;
  }

  // Relative path - make it absolute
  const cwd = Deno.cwd().replace(/\\/g, "/");
  if (/^[a-zA-Z]:\//.test(cwd)) {
    return `file:///${cwd}/${normalized}`;
  }
  return `file://${cwd}/${normalized}`;
}

/**
 * @deprecated This export will be removed in v0.9.0.
 * Use import functions in INSTALLED_APPS instead.
 */
export function pathToFileUrl(path: string): string {
  console.warn(
    "⚠️  pathToFileUrl is deprecated and will be removed in v0.9.0. " +
      "Use import functions in INSTALLED_APPS instead.",
  );
  return toImportUrl(path);
}

// =============================================================================
// Types
// =============================================================================

/**
 * Import function type for apps.
 */
type AppImportFn = () => Promise<{ default?: AppConfig; [key: string]: unknown }>;

// =============================================================================
// ManagementUtility Class
// =============================================================================

/**
 * Main management utility for CLI command execution
 *
 * This is the entry point for the management CLI. It:
 * - Manages command registration
 * - Parses the command line
 * - Dispatches to the appropriate command
 * - Handles errors and exit codes
 *
 * @example Basic usage
 * ```ts
 * // manage.ts
 * import { ManagementUtility } from "@alexi/management";
 *
 * const cli = new ManagementUtility();
 * await cli.execute(Deno.args);
 * ```
 *
 * @example With custom commands
 * ```ts
 * import { ManagementUtility, BaseCommand } from "@alexi/management";
 *
 * class MyCommand extends BaseCommand {
 *   name = "mycommand";
 *   help = "My custom command";
 *   async handle() { ... }
 * }
 *
 * const cli = new ManagementUtility();
 * cli.registerCommand(MyCommand);
 * await cli.execute(Deno.args);
 * ```
 */
export class ManagementUtility {
  private readonly registry: CommandRegistry;
  private readonly debug: boolean;
  private readonly projectRoot: string;
  private stdout: IConsole = console;
  private stderr: IConsole = console;

  /**
   * Whether app commands have been loaded
   */
  private appCommandsLoaded = false;

  /**
   * Create a new ManagementUtility
   *
   * @param config - Configuration options
   */
  constructor(config: ManagementConfig = {}) {
    // Use provided registry or create a new one (don't use global for isolation)
    this.registry = new CommandRegistry();
    this.debug = config.debug ?? Deno.env.get("DEBUG") === "true";
    this.projectRoot = config.projectRoot ?? Deno.cwd();

    // Register built-in commands
    this.registerBuiltinCommands();

    // Register custom commands if provided
    if (config.commands) {
      for (const CommandClass of config.commands) {
        this.registerCommand(CommandClass);
      }
    }
  }

  // ===========================================================================
  // Command Registration
  // ===========================================================================

  /**
   * Register built-in commands (only core commands: help, test)
   *
   * Other commands are provided by their respective modules via INSTALLED_APPS:
   * - bundle, collectstatic, runserver (static) → @alexi/staticfiles
   * - runserver (web) → @alexi/web
   * - runserver (desktop) → @alexi/webui
   * - createsuperuser → @alexi/auth
   * - flush → @alexi/db
   */
  private registerBuiltinCommands(): void {
    // Register help command and set registry reference
    const helpCommand = new HelpCommand();
    helpCommand.setRegistry(this.registry);
    this.registry.register(
      class extends HelpCommand {
        constructor() {
          super();
          this.setRegistry(helpCommand["registry"]!);
        }
      },
    );
    // Replace with the configured instance
    (this.registry as unknown as { commands: Map<string, unknown> }).commands
      .set("help", helpCommand);

    // Register test command
    this.registry.register(TestCommand);

    // Register startapp command
    this.registry.register(StartAppCommand);

    // Note: Other commands (flush, createsuperuser, bundle, collectstatic, runserver)
    // are loaded dynamically from INSTALLED_APPS via loadAppCommands()
  }

  /**
   * Parse --settings argument from raw args before command execution.
   * This is needed to know which settings file to load commands from.
   */
  private parseSettingsArg(args: string[]): string | null {
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      // --settings=value or -s=value
      if (arg.startsWith("--settings=")) {
        return arg.slice("--settings=".length);
      }
      if (arg.startsWith("-s=")) {
        return arg.slice("-s=".length);
      }

      // --settings value or -s value
      if ((arg === "--settings" || arg === "-s") && i + 1 < args.length) {
        return args[i + 1];
      }
    }
    return null;
  }

  /**
   * Load commands from INSTALLED_APPS.
   *
   * INSTALLED_APPS contains import functions that return app modules.
   * We call each function to get the module, then load commands from it.
   */
  private async loadAppCommands(args: string[] = []): Promise<void> {
    if (this.appCommandsLoaded) return;
    this.appCommandsLoaded = true;

    try {
      const projectDir = `${this.projectRoot}/project`;

      // Check if --settings was specified
      const settingsArg = this.parseSettingsArg(args);

      // Collect import functions from settings
      const importFunctions: AppImportFn[] = [];

      if (settingsArg) {
        // Load from specified settings file
        try {
          const settingsPath = this.resolveSettingsPath(settingsArg, projectDir);
          const settingsUrl = toImportUrl(settingsPath);

          if (this.debug) {
            console.log(`Loading settings from: ${settingsUrl}`);
          }

          const settings = await import(settingsUrl);
          const installedApps = settings.INSTALLED_APPS ?? [];

          for (const app of installedApps) {
            if (typeof app === "function") {
              importFunctions.push(app as AppImportFn);
            }
          }
        } catch (error) {
          if (this.debug) {
            console.warn(`Could not load settings '${settingsArg}': ${error}`);
          }
        }
      } else {
        // No --settings specified, load from all settings files
        try {
          for await (const entry of Deno.readDir(projectDir)) {
            if (entry.isFile && entry.name.endsWith(".settings.ts")) {
              try {
                const settingsPath = `${projectDir}/${entry.name}`;
                const settingsUrl = toImportUrl(settingsPath);
                const settings = await import(settingsUrl);
                const installedApps = settings.INSTALLED_APPS ?? [];

                for (const app of installedApps) {
                  if (typeof app === "function") {
                    // Check if we already have this function (by reference)
                    if (!importFunctions.includes(app as AppImportFn)) {
                      importFunctions.push(app as AppImportFn);
                    }
                  }
                }
              } catch {
                // Skip invalid settings files
              }
            }
          }
        } catch {
          // project directory doesn't exist or can't be read
        }
      }

      if (this.debug) {
        console.log(`Found ${importFunctions.length} app import functions`);
      }

      // Load commands from each app by calling the import function
      for (const importFn of importFunctions) {
        await this.loadCommandsFromImportFn(importFn);
      }
    } catch (error) {
      if (this.debug) {
        console.warn(`Could not load app commands: ${error}`);
      }
    }
  }

  /**
   * Resolve settings path from argument.
   */
  private resolveSettingsPath(settingsArg: string, projectDir: string): string {
    if (settingsArg.endsWith(".ts")) {
      // Full path with .ts extension
      if (settingsArg.startsWith("./") || settingsArg.startsWith("../")) {
        return `${this.projectRoot}/${settingsArg.slice(2)}`;
      }
      return `${this.projectRoot}/${settingsArg}`;
    }

    if (settingsArg.includes(".")) {
      // Dotted module path like project.test
      const modulePath = settingsArg.replace(/\./g, "/");
      return `${this.projectRoot}/${modulePath}.ts`;
    }

    // Short name: test -> project/test.settings.ts
    return `${projectDir}/${settingsArg}.settings.ts`;
  }

  /**
   * Load commands from an import function.
   *
   * The import function is called in user's context, so import maps work correctly.
   */
  private async loadCommandsFromImportFn(importFn: AppImportFn): Promise<void> {
    try {
      // Call the user's import function
      const module = await importFn();

      // Get AppConfig from default export or named exports (config, appConfig)
      // Some modules use `export { default as config }` instead of `export default`
      const config = (module.default ?? module.config ?? module.appConfig) as AppConfig | undefined;
      if (!config) {
        if (this.debug) {
          console.log("  App module has no AppConfig (checked: default, config, appConfig)");
        }
        return;
      }

      if (this.debug) {
        console.log(`Loading commands from app: ${config.name}`);
      }

      // Check if app has commands
      if (!config.commandsModule) {
        if (this.debug) {
          console.log(`  ${config.name}: no commandsModule defined`);
        }
        return;
      }

      // Check if app provides a commandsImport function
      if (config.commandsImport && typeof config.commandsImport === "function") {
        // Use the provided import function for commands
        const commandsModule = await config.commandsImport();
        this.registerCommandsFromModule(
          commandsModule as Record<string, unknown>,
          config.name,
        );
        return;
      }

      // Fallback: commands might be exported from the main module
      if (module.commands) {
        this.registerCommandsFromModule(
          module.commands as Record<string, unknown>,
          config.name,
        );
      }
    } catch (error) {
      if (this.debug) {
        console.warn(`  Could not load commands from app: ${error}`);
      }
    }
  }

  /**
   * Register command classes from a loaded module
   */
  private registerCommandsFromModule(
    module: Record<string, unknown>,
    sourceName: string,
  ): void {
    for (const [exportName, exportValue] of Object.entries(module)) {
      // Skip non-command exports
      if (typeof exportValue !== "function") continue;

      // Check if it's a command class (has name property or extends BaseCommand)
      const proto = exportValue.prototype;
      if (!proto) continue;

      // Check for BaseCommand characteristics
      if (
        proto instanceof BaseCommand ||
        ("name" in proto && "handle" in proto) ||
        exportName.endsWith("Command")
      ) {
        try {
          this.registry.register(exportValue as CommandConstructor);
          if (this.debug) {
            const cmdName = proto.name ?? exportName;
            console.log(`    Registered command: ${cmdName} from ${sourceName}`);
          }
        } catch {
          // Command might already be registered or invalid
        }
      }
    }
  }

  // ===========================================================================
  // Public API
  // ===========================================================================

  /**
   * Register a custom command
   *
   * @param CommandClass - The command class to register
   */
  registerCommand(CommandClass: CommandConstructor): void {
    this.registry.register(CommandClass);
  }

  /**
   * Register multiple commands at once
   *
   * @param commands - Array of command classes to register
   */
  registerCommands(commands: CommandConstructor[]): void {
    for (const CommandClass of commands) {
      this.registry.register(CommandClass);
    }
  }

  /**
   * Set custom console for output
   *
   * Useful for testing or redirecting output.
   *
   * @param stdout - Console for standard output
   * @param stderr - Console for error output (optional, defaults to stdout)
   */
  setConsole(stdout: IConsole, stderr?: IConsole): void {
    this.stdout = stdout;
    this.stderr = stderr ?? stdout;
  }

  /**
   * Execute commands from command line arguments
   *
   * This is the main entry point. It:
   * 1. Loads app commands from INSTALLED_APPS
   * 2. Parses the command name from args
   * 3. Dispatches to the appropriate command
   * 4. Returns exit code (0 for success, 1 for failure)
   *
   * @param args - Command line arguments (typically Deno.args)
   * @returns Exit code: 0 for success, 1 for failure
   */
  async execute(args: string[]): Promise<number> {
    try {
      // Load app commands first
      await this.loadAppCommands(args);

      // Get command name (first non-flag argument)
      const commandName = args.find((arg) => !arg.startsWith("-"));

      if (!commandName) {
        this.showUsage();
        return 0;
      }

      return await this.executeCommand(commandName, args);
    } catch (error) {
      this.stderr.error(
        `Error: ${error instanceof Error ? error.message : String(error)}`,
      );
      return 1;
    }
  }

  /**
   * Execute a specific command
   */
  private async executeCommand(
    commandName: string,
    args: string[],
  ): Promise<number> {
    // Special handling for --version
    if (commandName === "--version" || commandName === "-v") {
      this.showVersion();
      return 0;
    }

    // Get the command
    const command = this.registry.get(commandName);
    if (!command) {
      this.stderr.error(`Unknown command: ${commandName}`);
      this.stderr.error("Run 'help' to see available commands.");
      return 1;
    }

    // Configure command output if it's a BaseCommand
    if (command instanceof BaseCommand) {
      command.setConsole(this.stdout, this.stderr);
    }

    try {
      // Execute the command
      let result: { exitCode: number; message?: string; success?: boolean };

      if (command instanceof BaseCommand) {
        // BaseCommand has run() method
        result = await command.run(args, this.debug);
      } else {
        // ICommand only has handle()
        result = await command.handle({
          args: { _: args.filter((a) => !a.startsWith("-")) },
          rawArgs: args,
          debug: this.debug,
        });
      }

      if (result.exitCode !== 0) {
        const message = result.message || "Command failed";
        this.stderr.error(message);
        return result.exitCode;
      }

      return 0;
    } catch (error) {
      this.stderr.error(
        `Command '${commandName}' failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return 1;
    }
  }

  // ===========================================================================
  // Help & Version
  // ===========================================================================

  /**
   * Show usage information
   */
  private showUsage(): void {
    this.stdout.log("");
    this.stdout.log("Alexi Management Utility");
    this.stdout.log("");
    this.stdout.log("Usage:");
    this.stdout.log("  deno task <command> [options]");
    this.stdout.log("  deno run -A manage.ts <command> [options]");
    this.stdout.log("");
    this.stdout.log("Available commands:");

    const commands = this.registry.all();
    for (const cmd of commands.sort((a, b) => a.name.localeCompare(b.name))) {
      this.stdout.log(`  ${cmd.name.padEnd(20)} ${cmd.help}`);
    }

    this.stdout.log("");
    this.stdout.log("Run 'help <command>' for more information on a command.");
  }

  /**
   * Show version information
   */
  private showVersion(): void {
    this.stdout.log("Alexi Framework v0.8.0");
  }

  // ===========================================================================
  // Accessors
  // ===========================================================================

  /**
   * Get the command registry
   */
  getRegistry(): CommandRegistry {
    return this.registry;
  }

  /**
   * Check if debug mode is enabled
   */
  isDebug(): boolean {
    return this.debug;
  }

  /**
   * Get the project root directory
   */
  getProjectRoot(): string {
    return this.projectRoot;
  }
}

// =============================================================================
// Convenience Function
// =============================================================================

/**
 * Execute management commands (convenience function)
 *
 * This is a shortcut for creating a ManagementUtility and executing commands.
 *
 * @param args - Command line arguments (typically Deno.args)
 * @returns Exit code
 */
export async function execute(args: string[] = Deno.args): Promise<number> {
  const cli = new ManagementUtility();
  return await cli.execute(args);
}
