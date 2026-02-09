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
// Import Specifier Detection
// =============================================================================

/**
 * Check if a string is an import specifier (package name) vs a file path.
 *
 * Import specifiers:
 * - "@alexi/web" (scoped package)
 * - "jsr:@alexi/web" (explicit JSR)
 * - "npm:express" (explicit npm)
 * - "alexi" (bare specifier - less common)
 *
 * File paths:
 * - "./src/myapp" (relative)
 * - "../alexi/src/web" (relative parent)
 * - "/absolute/path" (absolute)
 * - "C:/windows/path" (Windows absolute)
 */
function isImportSpecifier(value: string): boolean {
  // Explicit protocol prefixes
  if (
    value.startsWith("jsr:") ||
    value.startsWith("npm:") ||
    value.startsWith("node:")
  ) {
    return true;
  }

  // Scoped packages (@org/package)
  if (value.startsWith("@")) {
    return true;
  }

  // Relative paths are NOT specifiers
  if (value.startsWith("./") || value.startsWith("../")) {
    return false;
  }

  // Absolute paths (Unix or Windows)
  if (value.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(value)) {
    return false;
  }

  // If it contains path separators but doesn't start with protocol, it's a path
  if (value.includes("/") || value.includes("\\")) {
    // Exception: scoped packages like @org/package/subpath
    if (!value.startsWith("@")) {
      return false;
    }
  }

  // Bare specifiers (e.g., "lodash", "express")
  // These are less common in Alexi but could be npm packages
  return true;
}

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
export function pathToFileUrl(path: string): string {
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

    // Register startapp command
    this.registry.register(StartAppCommand);

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

      // Collect apps to load: either specifier (string) or {name, path} for file-based
      const appsToLoad: Array<
        { type: "specifier"; specifier: string } | {
          type: "path";
          name: string;
          path: string;
        }
      > = [];
      const seenApps = new Set<string>();

      // Check if --settings was specified
      const settingsArg = this.parseSettingsArg(args);

      if (settingsArg) {
        // Load commands only from the specified settings file
        try {
          // Support Django-style settings module paths:
          // 1. Full path: ./project/test.settings.ts or project/test.settings.ts
          // 2. Dotted module: project.test (becomes project/test.settings.ts)
          // 3. Short name: test (becomes project/test.settings.ts) - legacy
          let settingsPath: string;

          if (settingsArg.endsWith(".ts")) {
            // Full path with .ts extension
            if (settingsArg.startsWith("./") || settingsArg.startsWith("../")) {
              settingsPath = `${this.projectRoot}/${settingsArg.slice(2)}`;
            } else {
              settingsPath = `${this.projectRoot}/${settingsArg}`;
            }
          } else if (settingsArg.includes(".")) {
            // Dotted module path like project.test or project.settings.production
            const modulePath = settingsArg.replace(/\./g, "/");
            settingsPath = `${this.projectRoot}/${modulePath}.ts`;
          } else {
            // Legacy short name: test -> project/test.settings.ts
            settingsPath = `${projectDir}/${settingsArg}.settings.ts`;
          }

          const settingsUrl = pathToFileUrl(settingsPath);
          if (this.debug) {
            console.log(`Loading settings from: ${settingsUrl}`);
          }
          const settings = await import(settingsUrl);

          const installedApps: string[] = settings.INSTALLED_APPS ?? [];
          const appPaths: Record<string, string> = settings.APP_PATHS ?? {};

          // Warn if APP_PATHS is still being used (deprecation notice)
          if (
            Object.keys(appPaths).length > 0 && settings.APP_PATHS !== undefined
          ) {
            console.warn(
              "⚠️  APP_PATHS is deprecated. Use import specifiers in INSTALLED_APPS instead.",
            );
            console.warn(
              '   Example: "@alexi/web" instead of "alexi_web" + APP_PATHS mapping.',
            );
          }

          for (const appEntry of installedApps) {
            if (seenApps.has(appEntry)) continue;
            seenApps.add(appEntry);

            if (isImportSpecifier(appEntry)) {
              // It's an import specifier like "@alexi/web"
              appsToLoad.push({ type: "specifier", specifier: appEntry });
            } else {
              // Legacy: look up in APP_PATHS
              const appPath = appPaths[appEntry];
              if (appPath) {
                appsToLoad.push({
                  type: "path",
                  name: appEntry,
                  path: appPath,
                });
              } else if (this.debug) {
                console.warn(
                  `  App '${appEntry}' not found in APP_PATHS and is not an import specifier`,
                );
              }
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
            if (entry.isFile && entry.name.endsWith(".settings.ts")) {
              try {
                const settingsPath = `${projectDir}/${entry.name}`;
                const settingsUrl = pathToFileUrl(settingsPath);
                const settings = await import(settingsUrl);

                const installedApps: string[] = settings.INSTALLED_APPS ?? [];
                const appPaths: Record<string, string> = settings.APP_PATHS ??
                  {};

                for (const appEntry of installedApps) {
                  if (seenApps.has(appEntry)) continue;
                  seenApps.add(appEntry);

                  if (isImportSpecifier(appEntry)) {
                    appsToLoad.push({ type: "specifier", specifier: appEntry });
                  } else {
                    const appPath = appPaths[appEntry];
                    if (appPath) {
                      appsToLoad.push({
                        type: "path",
                        name: appEntry,
                        path: appPath,
                      });
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
        console.log(`Found ${appsToLoad.length} apps to check for commands`);
      }

      // Load commands from each app
      for (const app of appsToLoad) {
        if (app.type === "specifier") {
          await this.loadCommandsFromSpecifier(app.specifier);
        } else {
          await this.loadCommandsFromPath(app.name, app.path);
        }
      }
    } catch (error) {
      if (this.debug) {
        console.warn(`Could not load app commands: ${error}`);
      }
    }
  }

  /**
   * Load commands from an import specifier (e.g., "@alexi/web")
   *
   * This handles apps installed as packages (JSR, npm).
   * It imports the app's config module to find the commands module.
   */
  private async loadCommandsFromSpecifier(specifier: string): Promise<void> {
    try {
      // Try to import the app's config module
      // Convention: @alexi/web/config exports AppConfig
      const configSpecifier = `${specifier}/config`;

      if (this.debug) {
        console.log(`Loading app config from specifier: ${configSpecifier}`);
      }

      let config: AppConfig;
      try {
        const appModule = await import(configSpecifier);
        config = appModule.default as AppConfig;
      } catch {
        // Fallback: some packages might not have /config export yet
        // Try importing the main module and looking for appConfig export
        if (this.debug) {
          console.log(
            `  ${specifier}: no /config export, trying main module`,
          );
        }
        try {
          const mainModule = await import(specifier);
          if (mainModule.appConfig) {
            config = mainModule.appConfig as AppConfig;
          } else {
            if (this.debug) {
              console.log(`  ${specifier}: no appConfig in main module`);
            }
            return;
          }
        } catch {
          if (this.debug) {
            console.log(`  ${specifier}: could not import main module`);
          }
          return;
        }
      }

      // Check if app has commands module
      if (!config?.commandsModule) {
        if (this.debug) {
          console.log(`  ${specifier}: no commandsModule defined`);
        }
        return;
      }

      // Determine how to import the commands module
      let commandsModule: Record<string, unknown>;
      const cmdModulePath = config.commandsModule;

      if (isImportSpecifier(cmdModulePath)) {
        // commandsModule is already a full specifier
        commandsModule = await import(cmdModulePath);
      } else if (
        cmdModulePath.startsWith("./") || cmdModulePath.startsWith("../")
      ) {
        // Relative path - construct specifier from package + relative path
        // e.g., "@alexi/web" + "./commands/mod.ts" -> "@alexi/web/commands"
        // Strip ./commands/mod.ts -> commands, then @alexi/web/commands
        const subpath = cmdModulePath
          .replace(/^\.\//, "")
          .replace(/\/mod\.ts$/, "")
          .replace(/\.ts$/, "");
        const commandsSpecifier = `${specifier}/${subpath}`;

        if (this.debug) {
          console.log(`  Loading commands from: ${commandsSpecifier}`);
        }

        commandsModule = await import(commandsSpecifier);
      } else {
        // Assume it's a subpath export name
        const commandsSpecifier = `${specifier}/${cmdModulePath}`;
        commandsModule = await import(commandsSpecifier);
      }

      // Register all exported command classes
      this.registerCommandsFromModule(commandsModule, specifier);
    } catch (error) {
      if (this.debug) {
        console.warn(`  ${specifier}: could not load commands: ${error}`);
      }
    }
  }

  /**
   * Load commands from a file path (legacy APP_PATHS approach)
   */
  private async loadCommandsFromPath(
    appName: string,
    appPath: string,
  ): Promise<void> {
    // Normalize app path - remove leading ./
    const normalizedAppPath = appPath.startsWith("./")
      ? appPath.slice(2)
      : appPath;

    try {
      const appConfigPath = `${this.projectRoot}/${normalizedAppPath}/app.ts`;
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
        return;
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
      this.registerCommandsFromModule(commandsModule, appName);
    } catch (error) {
      if (this.debug) {
        console.warn(`  ${appName}: could not load commands: ${error}`);
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
      // Check if it's a command class (has 'handle' in prototype)
      if (
        typeof exportValue === "function" &&
        exportValue.prototype &&
        typeof exportValue.prototype.handle === "function"
      ) {
        this.registry.register(exportValue as CommandConstructor);
        if (this.debug) {
          console.log(`✓ Loaded command '${exportName}' from ${sourceName}`);
        }
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
