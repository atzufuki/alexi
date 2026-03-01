/**
 * Command Registry for Alexi Management Commands
 *
 * Provides registration and discovery of management commands.
 *
 * @module @alexi/management/registry
 */

import type {
  CommandConstructor,
  ICommand,
  ICommandRegistry,
} from "./types.ts";

// =============================================================================
// CommandRegistry Class
// =============================================================================

/**
 * Registry for management commands
 *
 * Manages the collection of available commands and provides
 * lookup functionality.
 *
 * @example
 * ```ts
 * const registry = new CommandRegistry();
 *
 * // Register commands
 * registry.register(RunServerCommand);
 * registry.register(HelpCommand);
 *
 * // Get a command
 * const cmd = registry.get("runserver");
 * if (cmd) {
 *   await cmd.run(["--port", "3000"]);
 * }
 *
 * // List all commands
 * for (const cmd of registry.all()) {
 *   console.log(`${cmd.name}: ${cmd.help}`);
 * }
 * ```
 */
export class CommandRegistry implements ICommandRegistry {
  private commands: Map<string, ICommand> = new Map();

  // ===========================================================================
  // Registration
  // ===========================================================================

  /**
   * Register a command
   *
   * @param CommandClass - Command constructor to register
   * @param options - Registration options
   * @param options.override - If true, allows overriding an existing command (default: true)
   *
   * App commands are loaded after built-in commands, so they can override
   * built-in commands with the same name (like Django's app commands).
   *
   * @example
   * ```ts
   * registry.register(RunServerCommand);
   * registry.register(CustomRunServerCommand); // Overrides built-in
   * ```
   */
  register(
    CommandClass: CommandConstructor,
    options: { override?: boolean } = {},
  ): void {
    const { override = true } = options;
    const command = new CommandClass();
    const name = command.name;

    if (this.commands.has(name) && !override) {
      throw new Error(
        `Command "${name}" is already registered. ` +
          `Use override: true to replace it.`,
      );
    }

    this.commands.set(name, command);
  }

  /**
   * Register multiple commands at once
   *
   * @param commandClasses - Array of command constructors to register
   *
   * @example
   * ```ts
   * registry.registerAll([
   *   RunServerCommand,
   *   HelpCommand,
   *   MigrateCommand,
   * ]);
   * ```
   */
  registerAll(commandClasses: CommandConstructor[]): void {
    for (const CommandClass of commandClasses) {
      this.register(CommandClass);
    }
  }

  /**
   * Unregister a command
   *
   * @param name - Command name to unregister
   * @returns true if the command was removed, false if it wasn't registered
   */
  unregister(name: string): boolean {
    return this.commands.delete(name);
  }

  // ===========================================================================
  // Lookup
  // ===========================================================================

  /**
   * Get a command by name
   *
   * @param name - Command name to look up
   * @returns The command instance or undefined if not found
   *
   * @example
   * ```ts
   * const cmd = registry.get("runserver");
   * if (cmd) {
   *   await cmd.run(args);
   * }
   * ```
   */
  get(name: string): ICommand | undefined {
    return this.commands.get(name);
  }

  /**
   * Get all registered commands
   *
   * @returns Array of all command instances
   *
   * @example
   * ```ts
   * for (const cmd of registry.all()) {
   *   console.log(`${cmd.name}: ${cmd.help}`);
   * }
   * ```
   */
  all(): ICommand[] {
    return [...this.commands.values()];
  }

  /**
   * Get all command names
   *
   * @returns Array of registered command names, sorted alphabetically
   */
  names(): string[] {
    return [...this.commands.keys()].sort();
  }

  /**
   * Check if a command is registered
   *
   * @param name - Command name to check
   * @returns true if the command is registered
   */
  has(name: string): boolean {
    return this.commands.has(name);
  }

  /**
   * Get the number of registered commands
   */
  get size(): number {
    return this.commands.size;
  }

  // ===========================================================================
  // Utility
  // ===========================================================================

  /**
   * Clear all registered commands
   *
   * Useful for testing or resetting the registry.
   */
  clear(): void {
    this.commands.clear();
  }

  /**
   * Create a formatted list of commands for help output
   *
   * @returns Formatted string listing all commands
   */
  getCommandList(): string {
    const commands = this.all();
    if (commands.length === 0) {
      return "No commands registered.";
    }

    // Find the longest command name for alignment
    const maxNameLength = Math.max(...commands.map((c) => c.name.length));

    const lines: string[] = [];
    for (const cmd of commands.sort((a, b) => a.name.localeCompare(b.name))) {
      const padding = " ".repeat(maxNameLength - cmd.name.length);
      lines.push(`  ${cmd.name}${padding}  ${cmd.help}`);
    }

    return lines.join("\n");
  }
}

// =============================================================================
// Global Registry
// =============================================================================

/**
 * Global command registry instance
 *
 * This is the default registry used by the management CLI.
 * You can import and use this directly, or create your own registry.
 *
 * @example
 * ```ts
 * import { globalRegistry } from "@alexi/management";
 *
 * globalRegistry.register(MyCommand);
 * ```
 */
export const globalRegistry: CommandRegistry = new CommandRegistry();

// =============================================================================
// Registration Decorator (for future use)
// =============================================================================

/**
 * Decorator function for registering commands
 *
 * Note: TypeScript decorators require experimental support.
 * This is provided as a factory function instead.
 *
 * @param registry - Registry to register the command in
 * @returns Function that registers the command
 *
 * @example
 * ```ts
 * const register = registerCommand(globalRegistry);
 *
 * // In your command file
 * export const MyCommand = register(
 *   class extends BaseCommand {
 *     name = "mycommand";
 *     help = "My command description";
 *     async handle() { ... }
 *   }
 * );
 * ```
 */
export function registerCommand(
  registry: ICommandRegistry = globalRegistry,
): <T extends CommandConstructor>(CommandClass: T) => T {
  return function <T extends CommandConstructor>(CommandClass: T): T {
    registry.register(CommandClass);
    return CommandClass;
  };
}
