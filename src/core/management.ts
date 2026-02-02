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
 * Convert a file path to a file:// URL string
 *
 * Handles Windows paths correctly by:
 * - Converting backslashes to forward slashes
 * - Adding the proper file:/// prefix for Windows absolute paths
 *
 * @param path - File system path
 * @returns file:// URL string suitable for dynamic import
 */
function pathToFileUrl(path: string): string {
  // Normalize backslashes to forward slashes
  let normalized = path.replace(/\\/g, "/");

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
    this.debug = config.debug ?? false;
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
   * - bundle, collectstatic, runserver (static) → alexi_staticfiles
   * - runserver (web) → alexi_web
   * - runserver (desktop) → alexi_webui
   * - createsuperuser → alexi_auth
   * - flush → alexi_db
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

    // Note: Other commands (flush, createsuperuser, bundle, collectstatic, runserver)
    // are loaded dynamically from INSTALLED_APPS via loadAppCommands()
  }

  /**
   * Load commands from INSTALLED_APPS
   *
   * Apps can provide custom commands by specifying a `commandsModule` in their app.ts.
   * This enables Django-style app-specific commands that become available when the app
   * is added to INSTALLED_APPS.
   */
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

  private async loadAppCommands(args: string[] = []): Promise<void> {
    if (this.appCommandsLoaded) return;
    this.appCommandsLoaded = true;

    try {
      const projectDir = `${this.projectRoot}/project`;
      const allApps: Map<string, string> = new Map(); // appName -> appPath

      // Check if --settings was specified
      const settingsArg = this.parseSettingsArg(args);

      if (settingsArg) {
        // Load commands only from the specified settings file
        try {
          const settingsPath = `${projectDir}/${settingsArg}.settings.ts`;
          const settingsUrl = pathToFileUrl(settingsPath);
          if (this.debug) {
            console.log(`Loading settings from: ${settingsUrl}`);
          }
          const settings = await import(settingsUrl);

          const installedApps: string[] = settings.INSTALLED_APPS ?? [];
          const appPaths: Record<string, string> = settings.APP_PATHS ?? {};

          for (const appName of installedApps) {
            const appPath = appPaths[appName];
            if (appPath) {
              allApps.set(appName, appPath);
            }
          }
        } catch (error) {
          // Settings file doesn't exist or is invalid
          if (this.debug) {
            console.warn(`Could not load settings '${settingsArg}': ${error}`);
          }
        }
      } else {
        // No --settings specified, load from all settings files
        try {
          for await (const entry of Deno.readDir(projectDir)) {
            if (
              entry.isFile &&
              entry.name.endsWith(".settings.ts")
            ) {
              try {
                const settingsPath = `${projectDir}/${entry.name}`;
                const settingsUrl = pathToFileUrl(settingsPath);
                const settings = await import(settingsUrl);

                const installedApps: string[] = settings.INSTALLED_APPS ?? [];
                const appPaths: Record<string, string> = settings.APP_PATHS ??
                  {};

                for (const appName of installedApps) {
                  const appPath = appPaths[appName];
                  if (appPath && !allApps.has(appName)) {
                    allApps.set(appName, appPath);
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
        console.log(`Found ${allApps.size} apps to check for commands:`, [
          ...allApps.keys(),
        ]);
      }

      // Load commands from each unique app
      for (const [appName, appPath] of allApps) {
        // Normalize app path - remove leading ./
        const normalizedAppPath = appPath.startsWith("./")
          ? appPath.slice(2)
          : appPath;

        // Try to load app.ts
        try {
          const appConfigPath =
            `${this.projectRoot}/${normalizedAppPath}/app.ts`;
          const appConfigUrl = pathToFileUrl(appConfigPath);
          if (this.debug) {
            console.log(`Loading app config from: ${appConfigUrl}`);
          }
          const appModule = await import(appConfigUrl);
          const config = appModule.default as AppConfig;

          // Check if app has commands module
          if (!config?.commandsModule) {
            if (this.debug) {
              console.log(`  ${appName}: no commandsModule defined`);
            }
            continue;
          }

          // Load commands module
          const commandsPath =
            `${this.projectRoot}/${normalizedAppPath}/${config.commandsModule}`;
          const commandsUrl = pathToFileUrl(commandsPath);
          if (this.debug) {
            console.log(`  Loading commands from: ${commandsUrl}`);
          }
          const commandsModule = await import(commandsUrl);

          // Register all exported command classes
          for (
            const [exportName, exportValue] of Object.entries(commandsModule)
          ) {
            // Check if it's a command class (has 'name' and 'handle' in prototype)
            if (
              typeof exportValue === "function" &&
              exportValue.prototype &&
              typeof exportValue.prototype.handle === "function"
            ) {
              this.registry.register(exportValue as CommandConstructor);
              if (this.debug) {
                console.log(`✓ Loaded command '${exportName}' from ${appName}`);
              }
            }
          }
        } catch (error) {
          // App doesn't have app.ts or commands module, skip silently
          if (this.debug) {
            console.warn(`  ${appName}: could not load commands: ${error}`);
          }
        }
      }
    } catch (error) {
      if (this.debug) {
        console.warn(`Could not load app commands: ${error}`);
      }
    }
  }

  /**
   * Register a custom command
   *
   * @param CommandClass - Command constructor to register
   */
  registerCommand(CommandClass: CommandConstructor): void {
    this.registry.register(CommandClass);
  }

  /**
   * Register multiple commands at once
   *
   * @param commandClasses - Array of command constructors
   */
  registerCommands(commandClasses: CommandConstructor[]): void {
    for (const CommandClass of commandClasses) {
      this.registerCommand(CommandClass);
    }
  }

  // ===========================================================================
  // Console Configuration
  // ===========================================================================

  /**
   * Set custom console implementations (useful for testing)
   *
   * @param stdout - Standard output console
   * @param stderr - Standard error console
   */
  setConsole(stdout: IConsole, stderr?: IConsole): void {
    this.stdout = stdout;
    this.stderr = stderr ?? stdout;
  }

  // ===========================================================================
  // Command Execution
  // ===========================================================================

  /**
   * Execute the CLI with the given arguments
   *
   * This is the main entry point. It parses arguments,
   * finds the appropriate command, and executes it.
   *
   * @param args - Command line arguments (typically Deno.args)
   * @returns Exit code (0 = success)
   *
   * @example
   * ```ts
   * const cli = new ManagementUtility();
   * const exitCode = await cli.execute(Deno.args);
   * Deno.exit(exitCode);
   * ```
   */
  async execute(args: string[]): Promise<number> {
    // Load commands from INSTALLED_APPS before execution
    // Pass args so we can parse --settings to know which settings file to use
    await this.loadAppCommands(args);

    // Handle empty arguments
    if (args.length === 0) {
      this.showUsage();
      return 0;
    }

    // Get the command name (first argument)
    const commandName = args[0];

    // Handle special cases
    if (commandName === "--help" || commandName === "-h") {
      return this.executeCommand("help", []);
    }

    if (commandName === "--version" || commandName === "-v") {
      this.showVersion();
      return 0;
    }

    // Execute the command
    return this.executeCommand(commandName, args.slice(1));
  }

  /**
   * Execute a specific command by name
   *
   * @param commandName - Name of the command to execute
   * @param args - Arguments to pass to the command
   * @returns Exit code
   */
  private async executeCommand(
    commandName: string,
    args: string[],
  ): Promise<number> {
    const command = this.registry.get(commandName);

    if (!command) {
      this.stderr.error(`Error: Command "${commandName}" not found.`);
      this.stderr.error("");
      this.stderr.error("Available commands:");
      this.stderr.error(this.registry.getCommandList());
      return 1;
    }

    try {
      // Run the command
      if (command instanceof BaseCommand) {
        // Set console for output
        command.setConsole(this.stdout, this.stderr);

        const result = await command.run(args, this.debug);
        return result.exitCode;
      }

      // For non-BaseCommand implementations
      const result = await command.handle({
        args: { _: args },
        rawArgs: args,
        debug: this.debug,
      });
      return result.exitCode;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.stderr.error(`Error executing command: ${message}`);

      if (this.debug && error instanceof Error && error.stack) {
        this.stderr.error("");
        this.stderr.error("Stack trace:");
        this.stderr.error(error.stack);
      }

      return 1;
    }
  }

  // ===========================================================================
  // Help Output
  // ===========================================================================

  /**
   * Show usage information
   */
  private showUsage(): void {
    this.stdout.log("┌─────────────────────────────────────────────┐");
    this.stdout.log("│         Alexi Management Commands           │");
    this.stdout.log("└─────────────────────────────────────────────┘");
    this.stdout.log("");
    this.stdout.log("Usage: deno run -A manage.ts <command> [arguments]");
    this.stdout.log("");
    this.stdout.log("Available commands:");
    this.stdout.log(this.registry.getCommandList());
    this.stdout.log("");
    this.stdout.log("Common arguments:");
    this.stdout.log("  --help, -h     Show help");
    this.stdout.log("  --version, -v  Show version");
    this.stdout.log("  --debug        Enable debug mode");
    this.stdout.log("");
    this.stdout.log(
      "Use 'help <command>' for more information about a specific command.",
    );
  }

  /**
   * Show version information
   */
  private showVersion(): void {
    this.stdout.log("Alexi Management v0.1.0");
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
 * Create and execute a management CLI
 *
 * Convenience function for simple use cases.
 *
 * @param config - Optional configuration
 * @returns Exit code
 *
 * @example
 * ```ts
 * // manage.ts
 * import { execute } from "@alexi/management";
 *
 * Deno.exit(await execute());
 * ```
 */
export async function execute(config?: ManagementConfig): Promise<number> {
  const cli = new ManagementUtility(config);
  return cli.execute(Deno.args);
}
