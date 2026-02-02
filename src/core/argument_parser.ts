/**
 * Argument Parser for Alexi Management Commands
 *
 * Provides parsing and validation of command line arguments.
 *
 * @module @alexi/management/argument_parser
 */

import type {
  ArgumentConfig,
  ArgumentType,
  IArgumentParser,
  ParsedArguments,
} from "./types.ts";

// =============================================================================
// Argument Definition
// =============================================================================

/**
 * Internal representation of an argument
 */
interface ArgumentDefinition extends ArgumentConfig {
  name: string;
  isFlag: boolean;
  isPositional: boolean;
}

// =============================================================================
// ArgumentParser Class
// =============================================================================

/**
 * Parser for command line arguments
 *
 * Supports:
 * - Named arguments (--port, -p)
 * - Boolean flags (--debug)
 * - Positional arguments
 * - Type coercion
 * - Default values
 * - Validation
 *
 * @example
 * ```ts
 * const parser = new ArgumentParser();
 * parser.addArgument("--port", { type: "number", default: 8000 });
 * parser.addArgument("--debug", { type: "boolean", default: false });
 *
 * const args = parser.parse(["--port", "3000", "--debug"]);
 * // args = { _: [], port: 3000, debug: true }
 * ```
 */
export class ArgumentParser implements IArgumentParser {
  private arguments: Map<string, ArgumentDefinition> = new Map();
  private aliases: Map<string, string> = new Map();
  private positionalOrder: string[] = [];

  // ===========================================================================
  // Argument Definition
  // ===========================================================================

  /**
   * Add an argument definition
   *
   * @param name - Argument name (e.g., "--port", "-p", or positional like "file")
   * @param config - Argument configuration
   * @returns this for chaining
   *
   * @example Named argument
   * ```ts
   * parser.addArgument("--port", { type: "number", default: 8000 });
   * ```
   *
   * @example With alias
   * ```ts
   * parser.addArgument("--verbose", { alias: "-v", type: "boolean" });
   * ```
   *
   * @example Positional
   * ```ts
   * parser.addArgument("command", { required: true });
   * ```
   */
  addArgument(name: string, config: ArgumentConfig = {}): this {
    const isFlag = name.startsWith("-");
    const isPositional = !isFlag;

    // Normalize the name (remove leading dashes)
    const normalizedName = this.normalizeName(name);

    const definition: ArgumentDefinition = {
      name: normalizedName,
      type: config.type ?? "string",
      default: config.default,
      required: config.required ?? false,
      help: config.help ?? "",
      alias: config.alias,
      choices: config.choices,
      isFlag,
      isPositional,
    };

    this.arguments.set(normalizedName, definition);

    // Register alias if provided
    if (config.alias) {
      const aliasNormalized = this.normalizeName(config.alias);
      this.aliases.set(aliasNormalized, normalizedName);
    }

    // Track positional argument order
    if (isPositional) {
      this.positionalOrder.push(normalizedName);
    }

    return this;
  }

  // ===========================================================================
  // Parsing
  // ===========================================================================

  /**
   * Parse command line arguments
   *
   * @param args - Array of command line arguments
   * @returns Parsed arguments object
   * @throws Error if required arguments are missing or validation fails
   */
  parse(args: string[]): ParsedArguments {
    const result: ParsedArguments = { _: [] };
    let positionalIndex = 0;

    // Apply defaults
    for (const [name, def] of this.arguments) {
      if (def.default !== undefined) {
        result[name] = def.default;
      }
    }

    // Parse arguments
    let i = 0;
    while (i < args.length) {
      const arg = args[i];

      if (arg.startsWith("--")) {
        // Long form: --name=value or --name value
        i = this.parseLongArg(args, i, result);
      } else if (arg.startsWith("-") && arg.length > 1) {
        // Short form: -p value or -p=value or -v (boolean)
        i = this.parseShortArg(args, i, result);
      } else {
        // Positional argument
        if (positionalIndex < this.positionalOrder.length) {
          const name = this.positionalOrder[positionalIndex];
          const def = this.arguments.get(name);
          result[name] = this.coerceValue(arg, def?.type ?? "string");
          positionalIndex++;
        } else {
          result._.push(arg);
        }
        i++;
      }
    }

    // Validate
    this.validate(result);

    return result;
  }

  /**
   * Parse a long-form argument (--name=value or --name value)
   */
  private parseLongArg(
    args: string[],
    index: number,
    result: ParsedArguments,
  ): number {
    const arg = args[index];
    let name: string;
    let value: string | undefined;

    if (arg.includes("=")) {
      // --name=value
      const eqIndex = arg.indexOf("=");
      name = arg.slice(2, eqIndex);
      value = arg.slice(eqIndex + 1);
    } else {
      // --name or --name value
      name = arg.slice(2);
    }

    const def = this.getDefinition(name);

    if (def?.type === "boolean") {
      // Boolean flag
      if (value !== undefined) {
        result[def.name] = this.parseBooleanValue(value);
      } else {
        result[def.name] = true;
      }
      return index + 1;
    }

    // Non-boolean: need a value
    if (value === undefined) {
      if (index + 1 < args.length && !args[index + 1].startsWith("-")) {
        value = args[index + 1];
        index++;
      } else {
        throw new Error(`Argument --${name} requires a value`);
      }
    }

    const targetName = def?.name ?? name;
    result[targetName] = this.coerceValue(value, def?.type ?? "string");

    return index + 1;
  }

  /**
   * Parse a short-form argument (-p value or -p=value)
   */
  private parseShortArg(
    args: string[],
    index: number,
    result: ParsedArguments,
  ): number {
    const arg = args[index];
    let name: string;
    let value: string | undefined;

    if (arg.includes("=")) {
      // -p=value
      const eqIndex = arg.indexOf("=");
      name = arg.slice(1, eqIndex);
      value = arg.slice(eqIndex + 1);
    } else {
      // -p or -p value
      name = arg.slice(1);
    }

    // Resolve alias
    const resolvedName = this.aliases.get(name) ?? name;
    const def = this.getDefinition(resolvedName);

    if (def?.type === "boolean") {
      // Boolean flag
      if (value !== undefined) {
        result[def.name] = this.parseBooleanValue(value);
      } else {
        result[def.name] = true;
      }
      return index + 1;
    }

    // Non-boolean: need a value
    if (value === undefined) {
      if (index + 1 < args.length && !args[index + 1].startsWith("-")) {
        value = args[index + 1];
        index++;
      } else {
        throw new Error(`Argument -${name} requires a value`);
      }
    }

    const targetName = def?.name ?? resolvedName;
    result[targetName] = this.coerceValue(value, def?.type ?? "string");

    return index + 1;
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  /**
   * Normalize an argument name (remove leading dashes)
   */
  private normalizeName(name: string): string {
    return name.replace(/^-+/, "");
  }

  /**
   * Get an argument definition by name (checking aliases)
   */
  private getDefinition(name: string): ArgumentDefinition | undefined {
    // Check direct match
    if (this.arguments.has(name)) {
      return this.arguments.get(name);
    }

    // Check alias
    const resolved = this.aliases.get(name);
    if (resolved) {
      return this.arguments.get(resolved);
    }

    return undefined;
  }

  /**
   * Coerce a string value to the specified type
   */
  private coerceValue(value: string, type: ArgumentType): unknown {
    switch (type) {
      case "number": {
        const num = Number(value);
        if (isNaN(num)) {
          throw new Error(`Invalid number: ${value}`);
        }
        return num;
      }
      case "boolean":
        return this.parseBooleanValue(value);
      case "array":
        return value.split(",").map((v) => v.trim());
      default:
        return value;
    }
  }

  /**
   * Parse a string as a boolean value
   */
  private parseBooleanValue(value: string): boolean {
    const lower = value.toLowerCase();
    if (["true", "1", "yes", "on"].includes(lower)) {
      return true;
    }
    if (["false", "0", "no", "off"].includes(lower)) {
      return false;
    }
    throw new Error(`Invalid boolean value: ${value}`);
  }

  /**
   * Validate parsed arguments
   */
  private validate(result: ParsedArguments): void {
    for (const [name, def] of this.arguments) {
      // Check required
      if (def.required && result[name] === undefined) {
        throw new Error(`Missing required argument: ${name}`);
      }

      // Check choices
      if (
        def.choices &&
        result[name] !== undefined &&
        !def.choices.includes(result[name] as string | number)
      ) {
        throw new Error(
          `Invalid value for ${name}: ${result[name]}. ` +
            `Valid choices: ${def.choices.join(", ")}`,
        );
      }
    }
  }

  // ===========================================================================
  // Help Generation
  // ===========================================================================

  /**
   * Get help text for all arguments
   */
  getHelp(): string {
    const lines: string[] = [];

    // Positional arguments
    const positionals = [...this.arguments.values()].filter(
      (d) => d.isPositional,
    );
    if (positionals.length > 0) {
      lines.push("Positional arguments:");
      for (const def of positionals) {
        const required = def.required ? " (required)" : "";
        lines.push(`  ${def.name}${required}`);
        if (def.help) {
          lines.push(`      ${def.help}`);
        }
      }
      lines.push("");
    }

    // Named arguments
    const named = [...this.arguments.values()].filter((d) => d.isFlag);
    if (named.length > 0) {
      lines.push("Options:");
      for (const def of named) {
        const alias = def.alias ? `, ${def.alias}` : "";
        const defaultVal = def.default !== undefined
          ? ` (default: ${def.default})`
          : "";
        const typeStr = def.type !== "string" ? ` [${def.type}]` : "";

        lines.push(`  --${def.name}${alias}${typeStr}${defaultVal}`);
        if (def.help) {
          lines.push(`      ${def.help}`);
        }
        if (def.choices) {
          lines.push(`      choices: ${def.choices.join(", ")}`);
        }
      }
    }

    return lines.join("\n");
  }
}
