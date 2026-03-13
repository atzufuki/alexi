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
import { FlushCommand } from "./commands/flush.ts";
import { MakemigrationsCommand } from "./commands/makemigrations.ts";
import { MigrateCommand } from "./commands/migrate.ts";
import { ShowmigrationsCommand } from "./commands/showmigrations.ts";
import { SqlmigrateCommand } from "./commands/sqlmigrate.ts";
import type {
  CliApplicationConfig,
  CommandConstructor,
  IConsole,
  ManagementConfig,
  UsageConfig,
} from "./types.ts";
import type { AppConfig } from "@alexi/types";

// =============================================================================
// Helper Functions
// =============================================================================

import { resolveSettingsPath, toImportUrl } from "./settings_utils.ts";

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
type AppImportFn = () => Promise<
  { default?: AppConfig; [key: string]: unknown }
>;

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
 * // cli.ts
 * import { getCliApplication } from "@alexi/core/management";
 *
 * const cli = await getCliApplication({ programName: "my-cli" });
 * await cli.execute(Deno.args);
 * ```
 *
 * @example With custom commands
 * ```ts
 * import { getCliApplication, BaseCommand } from "@alexi/core/management";
 *
 * class MyCommand extends BaseCommand {
 *   name = "mycommand";
 *   help = "My custom command";
 *   async handle() { ... }
 * }
 *
 * const cli = await getCliApplication({
 *   programName: "my-cli",
 *   commands: [MyCommand],
 * });
 * await cli.execute(Deno.args);
 * ```
 */
export class ManagementUtility {
  private readonly registry: CommandRegistry;
  private readonly debug: boolean;
  private readonly projectRoot: string;
  private readonly programName: string;
  private readonly title: string;
  private readonly usage: string[];
  private readonly version: string;
  private stdout: IConsole = console;
  private stderr: IConsole = console;

  /**
   * Whether app commands have been loaded
   */
  private appCommandsLoaded = false;

  /**
   * Whether app commands were loaded without finding any settings file.
   * Used to produce a more helpful error message when a command is not found.
   */
  private appCommandsLoadedWithNoSettings = false;

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
    this.programName = config.programName ?? "cli";
    this.title = config.title ?? "Available Commands";
    this.usage = this.normalizeUsage(
      config.usage,
      this.programName,
    );
    this.version = config.version ?? this.programName;

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
   */
  private registerBuiltinCommands(): void {
    // Register help command and set registry reference
    const helpCommand = this.registry.register(HelpCommand) as HelpCommand;
    helpCommand.setRegistry(this.registry);
    helpCommand.setDisplayOptions({
      title: this.title,
      usage: this.usage,
    });

    // Framework commands are opt-in and can be registered explicitly.
  }

  private normalizeUsage(
    usage: UsageConfig | undefined,
    programName: string,
  ): string[] {
    if (usage) {
      return Array.isArray(usage) ? usage : [usage];
    }

    return [`Usage: ${programName} <command> [arguments]`];
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

      // Check if --settings was specified, or fall back to ALEXI_SETTINGS_MODULE env var
      const settingsArg = this.parseSettingsArg(args) ??
        Deno.env.get("ALEXI_SETTINGS_MODULE");

      // Collect import functions from settings
      const importFunctions: AppImportFn[] = [];

      if (settingsArg) {
        // Load from specified settings file
        let settingsLoaded = false;
        try {
          const settingsPath = this.resolveSettingsPath(
            settingsArg,
            projectDir,
          );
          const settingsUrl = toImportUrl(settingsPath);

          if (this.debug) {
            console.log(`Loading settings from: ${settingsUrl}`);
          }

          const settings = await import(settingsUrl);
          const installedApps = settings.INSTALLED_APPS ?? [];
          settingsLoaded = true;

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
        if (!settingsLoaded) {
          this.appCommandsLoadedWithNoSettings = true;
        }
      } else {
        // No --settings specified, scan all *.settings.ts files under project/
        let foundAnySettings = false;
        try {
          for await (const entry of Deno.readDir(projectDir)) {
            if (entry.isFile && entry.name.endsWith(".settings.ts")) {
              try {
                const settingsPath = `${projectDir}/${entry.name}`;
                const settingsUrl = toImportUrl(settingsPath);
                const settings = await import(settingsUrl);
                const installedApps = settings.INSTALLED_APPS ?? [];
                foundAnySettings = true;

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
        if (!foundAnySettings) {
          this.appCommandsLoadedWithNoSettings = true;
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
   * Delegates to the shared resolveSettingsPath utility.
   */
  private resolveSettingsPath(
    settingsArg: string,
    _projectDir: string,
  ): string {
    return resolveSettingsPath(settingsArg, this.projectRoot);
  }

  /**
   * Load commands from an import function.
   *
   * The import function is called in user's context, so import maps work correctly.
   * Commands are discovered by convention from `<appPath>/commands/mod.ts`.
   */
  private async loadCommandsFromImportFn(importFn: AppImportFn): Promise<void> {
    try {
      // Call the user's import function
      const module = await importFn();

      // Get AppConfig from default export or named exports (config, appConfig)
      // Some modules use `export { default as config }` instead of `export default`
      const config = (module.default ?? module.config ?? module.appConfig) as
        | AppConfig
        | undefined;
      if (!config) {
        if (this.debug) {
          console.log(
            "  App module has no AppConfig (checked: default, config, appConfig)",
          );
        }
        return;
      }

      if (this.debug) {
        console.log(`Loading commands from app: ${config.name}`);
      }

      // Resolve the app's source directory from appPath or convention
      const appPath = config.appPath ?? `./src/${config.name}`;
      let commandsUrl: string;

      if (
        appPath.startsWith("file://") ||
        appPath.startsWith("https://") ||
        appPath.startsWith("http://")
      ) {
        // Absolute URL (local file:// or remote https:// from JSR) — append commands/mod.ts
        const base = appPath.endsWith("/") ? appPath : `${appPath}/`;
        commandsUrl = `${base}commands/mod.ts`;
      } else {
        // Relative path — resolve against project root
        const rel = appPath.replace(/^\.\//, "");
        commandsUrl = toImportUrl(
          `${this.projectRoot}/${rel}/commands/mod.ts`,
        );
      }

      // Try to import commands/mod.ts by convention
      try {
        const commandsModule = await import(commandsUrl);
        this.registerCommandsFromModule(
          commandsModule as Record<string, unknown>,
          config.name,
        );
      } catch {
        // No commands/mod.ts — this is normal for most apps
        if (this.debug) {
          console.log(
            `  ${config.name}: no commands/mod.ts found at ${commandsUrl}`,
          );
        }
      }

      // Fallback: commands might be exported from the main module itself
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
   * Register command classes from a loaded module.
   *
   * Built-in commands (registered before app loading) are never overwritten.
   * This prevents app modules from accidentally replacing framework commands
   * such as `HelpCommand`, which carry state set up during construction.
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
          // Determine the command name from the prototype or class property
          const cmdName: string = proto.name ?? exportName;

          // Never overwrite built-in commands that were registered before app
          // loading. Built-ins like HelpCommand carry state (e.g. registry
          // reference) set up during ManagementUtility construction — replacing
          // them with a fresh instance would lose that state.
          if (this.registry.has(cmdName)) {
            if (this.debug) {
              console.log(
                `    Skipping ${cmdName} from ${sourceName} (built-in already registered)`,
              );
            }
            continue;
          }

          this.registry.register(exportValue as CommandConstructor);
          if (this.debug) {
            console.log(
              `    Registered command: ${cmdName} from ${sourceName}`,
            );
          }
        } catch {
          // Command might be invalid — skip silently
        }
      }
    }
  }

  // ===========================================================================
  // Public API
  // ===========================================================================

  /**
   * Register a custom command.
   *
   * If a command with the same name is already registered (e.g. a built-in
   * such as `HelpCommand` that was wired up during construction), the new
   * class is silently skipped. This prevents callers who pass
   * `alexi_management_commands` (which includes `HelpCommand`) via
   * `config.commands` from accidentally replacing the already-configured
   * built-in instance and losing its registry/display-options state.
   *
   * @param CommandClass - The command class to register
   */
  registerCommand(CommandClass: CommandConstructor): void {
    // Instantiate temporarily to resolve the runtime command name, which is
    // defined as an instance property (e.g. `readonly name = "help"`), not on
    // the prototype. We need the actual name to check registry membership.
    const tempInstance = new CommandClass();
    const cmdName: string = tempInstance.name;
    if (this.registry.has(cmdName)) return;
    this.registry.register(CommandClass);
  }

  /**
   * Register multiple commands at once.
   *
   * Already-registered commands are skipped (see {@link registerCommand}).
   *
   * @param commands - Array of command classes to register
   */
  registerCommands(commands: CommandConstructor[]): void {
    for (const CommandClass of commands) {
      this.registerCommand(CommandClass);
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

      // Remove command name from args before passing to command
      const commandArgs = args.slice(args.indexOf(commandName) + 1);
      return await this.executeCommand(commandName, commandArgs);
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
      // Give a more helpful hint when no app commands were loaded.
      // App commands (e.g. createsuperuser) are discovered from INSTALLED_APPS
      // which requires a settings file to be found — either via --settings or
      // by auto-scanning project/*.settings.ts.
      if (this.appCommandsLoadedWithNoSettings) {
        this.stderr.error(
          "No settings file was found. App commands (e.g. createsuperuser) " +
            "require a settings file.\n" +
            "Specify one with: --settings=./project/settings.ts",
        );
      }
      this.stderr.error("Run 'help' to see available commands.");
      return 1;
    }

    // Configure command output if it's a BaseCommand
    if (command instanceof BaseCommand) {
      command.setConsole(this.stdout, this.stderr);
      command.setProgramName(this.programName);
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
    this.stdout.log(this.title);
    this.stdout.log("");
    for (const line of this.usage) {
      this.stdout.log(line);
    }
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
    this.stdout.log(this.version);
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
  const cli = await getCliApplication();
  return await cli.execute(args);
}

/**
 * Create a CLI application with explicit command configuration.
 */
export async function getCliApplication(
  config: CliApplicationConfig = {},
): Promise<ManagementUtility> {
  return new ManagementUtility(config);
}

/**
 * Alexi framework management commands.
 */
export const alexi_management_commands: CommandConstructor[] = [
  HelpCommand,
  TestCommand,
  StartAppCommand,
  FlushCommand,
  MakemigrationsCommand,
  MigrateCommand,
  ShowmigrationsCommand,
  SqlmigrateCommand,
];
