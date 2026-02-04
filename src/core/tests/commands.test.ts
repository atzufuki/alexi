/**
 * Tests for BaseCommand and CommandRegistry
 *
 * @module @alexi/management/tests/commands
 */

import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { BaseCommand, failure, success } from "../base_command.ts";
import { CommandRegistry } from "../registry.ts";
import type {
  CommandOptions,
  CommandResult,
  IArgumentParser,
  IConsole,
} from "../types.ts";

// =============================================================================
// Mock Console for Testing
// =============================================================================

class MockConsole implements IConsole {
  logs: string[] = [];
  errors: string[] = [];
  warns: string[] = [];
  infos: string[] = [];

  log(...args: unknown[]): void {
    this.logs.push(args.map(String).join(" "));
  }

  error(...args: unknown[]): void {
    this.errors.push(args.map(String).join(" "));
  }

  warn(...args: unknown[]): void {
    this.warns.push(args.map(String).join(" "));
  }

  info(...args: unknown[]): void {
    this.infos.push(args.map(String).join(" "));
  }

  clear(): void {
    this.logs = [];
    this.errors = [];
    this.warns = [];
    this.infos = [];
  }
}

// =============================================================================
// Test Commands
// =============================================================================

class TestCommand extends BaseCommand {
  readonly name = "test";
  readonly help = "A test command";

  addArguments(parser: IArgumentParser): void {
    parser.addArgument("--value", {
      type: "string",
      default: "default",
      help: "A test value",
    });
  }

  async handle(options: CommandOptions): Promise<CommandResult> {
    const value = options.args.value as string;
    this.success(`Value is: ${value}`);
    return success(`Handled with value: ${value}`);
  }
}

class FailingCommand extends BaseCommand {
  readonly name = "failing";
  readonly help = "A command that fails";

  async handle(_options: CommandOptions): Promise<CommandResult> {
    this.error("Something went wrong");
    return failure("Command failed");
  }
}

class ThrowingCommand extends BaseCommand {
  readonly name = "throwing";
  readonly help = "A command that throws";

  async handle(_options: CommandOptions): Promise<CommandResult> {
    throw new Error("Unexpected error");
  }
}

// =============================================================================
// BaseCommand Tests
// =============================================================================

Deno.test("BaseCommand - runs successfully with default arguments", async () => {
  const command = new TestCommand();
  const mockConsole = new MockConsole();
  command.setConsole(mockConsole);

  const result = await command.run([]);

  assertEquals(result.exitCode, 0);
  assertEquals(result.message, "Handled with value: default");
  assertEquals(mockConsole.logs.some((log) => log.includes("default")), true);
});

Deno.test("BaseCommand - runs successfully with custom arguments", async () => {
  const command = new TestCommand();
  const mockConsole = new MockConsole();
  command.setConsole(mockConsole);

  const result = await command.run(["--value", "custom"]);

  assertEquals(result.exitCode, 0);
  assertEquals(result.message, "Handled with value: custom");
  assertEquals(mockConsole.logs.some((log) => log.includes("custom")), true);
});

Deno.test("BaseCommand - handles failure result", async () => {
  const command = new FailingCommand();
  const mockConsole = new MockConsole();
  command.setConsole(mockConsole);

  const result = await command.run([]);

  assertEquals(result.exitCode, 1);
  assertEquals(result.message, "Command failed");
  assertEquals(
    mockConsole.errors.some((err) => err.includes("Something went wrong")),
    true,
  );
});

Deno.test("BaseCommand - catches thrown errors", async () => {
  const command = new ThrowingCommand();
  const mockConsole = new MockConsole();
  command.setConsole(mockConsole);

  const result = await command.run([]);

  assertEquals(result.exitCode, 1);
  assertEquals(result.message, "Unexpected error");
  assertEquals(
    mockConsole.errors.some((err) => err.includes("Unexpected error")),
    true,
  );
});

Deno.test("BaseCommand - shows help when --help flag is used", async () => {
  const command = new TestCommand();
  const mockConsole = new MockConsole();
  command.setConsole(mockConsole);

  const result = await command.run(["--help"]);

  assertEquals(result.exitCode, 0);
  // Should contain usage info
  assertEquals(mockConsole.logs.some((log) => log.includes("Usage:")), true);
  // Should contain the command name
  assertEquals(mockConsole.logs.some((log) => log.includes("test")), true);
});

Deno.test("BaseCommand - success helper creates correct result", () => {
  const result = success("Operation completed");

  assertEquals(result.exitCode, 0);
  assertEquals(result.message, "Operation completed");
});

Deno.test("BaseCommand - failure helper creates correct result", () => {
  const result = failure("Operation failed", 2);

  assertEquals(result.exitCode, 2);
  assertEquals(result.message, "Operation failed");
});

Deno.test("BaseCommand - failure helper uses default exit code", () => {
  const result = failure("Operation failed");

  assertEquals(result.exitCode, 1);
});

// =============================================================================
// CommandRegistry Tests
// =============================================================================

Deno.test("CommandRegistry - registers commands", () => {
  const registry = new CommandRegistry();

  registry.register(TestCommand);

  assertEquals(registry.has("test"), true);
  assertEquals(registry.size, 1);
});

Deno.test("CommandRegistry - retrieves registered commands", () => {
  const registry = new CommandRegistry();
  registry.register(TestCommand);

  const command = registry.get("test");

  assertEquals(command?.name, "test");
  assertEquals(command?.help, "A test command");
});

Deno.test("CommandRegistry - returns undefined for unknown commands", () => {
  const registry = new CommandRegistry();

  const command = registry.get("unknown");

  assertEquals(command, undefined);
});

Deno.test("CommandRegistry - throws on duplicate registration with override false", () => {
  const registry = new CommandRegistry();
  registry.register(TestCommand);

  // By default, override is true, so no error is thrown
  // To get an error, we need to pass override: false
  assertThrows(
    () => registry.register(TestCommand, { override: false }),
    Error,
    "already registered",
  );
});

Deno.test("CommandRegistry - allows duplicate registration with override true (default)", () => {
  const registry = new CommandRegistry();
  registry.register(TestCommand);

  // Should not throw - override is true by default
  registry.register(TestCommand);

  assertEquals(registry.has("test"), true);
});

Deno.test("CommandRegistry - registers multiple commands", () => {
  const registry = new CommandRegistry();

  registry.registerAll([TestCommand, FailingCommand, ThrowingCommand]);

  assertEquals(registry.size, 3);
  assertEquals(registry.has("test"), true);
  assertEquals(registry.has("failing"), true);
  assertEquals(registry.has("throwing"), true);
});

Deno.test("CommandRegistry - returns all commands", () => {
  const registry = new CommandRegistry();
  registry.registerAll([TestCommand, FailingCommand]);

  const commands = registry.all();

  assertEquals(commands.length, 2);
  assertEquals(commands.some((c) => c.name === "test"), true);
  assertEquals(commands.some((c) => c.name === "failing"), true);
});

Deno.test("CommandRegistry - returns command names sorted", () => {
  const registry = new CommandRegistry();
  registry.registerAll([ThrowingCommand, TestCommand, FailingCommand]);

  const names = registry.names();

  assertEquals(names, ["failing", "test", "throwing"]);
});

Deno.test("CommandRegistry - unregisters commands", () => {
  const registry = new CommandRegistry();
  registry.register(TestCommand);

  const removed = registry.unregister("test");

  assertEquals(removed, true);
  assertEquals(registry.has("test"), false);
  assertEquals(registry.size, 0);
});

Deno.test("CommandRegistry - unregister returns false for unknown commands", () => {
  const registry = new CommandRegistry();

  const removed = registry.unregister("unknown");

  assertEquals(removed, false);
});

Deno.test("CommandRegistry - clears all commands", () => {
  const registry = new CommandRegistry();
  registry.registerAll([TestCommand, FailingCommand, ThrowingCommand]);

  registry.clear();

  assertEquals(registry.size, 0);
  assertEquals(registry.has("test"), false);
});

Deno.test("CommandRegistry - generates command list", () => {
  const registry = new CommandRegistry();
  registry.registerAll([TestCommand, FailingCommand]);

  const list = registry.getCommandList();

  assertEquals(list.includes("test"), true);
  assertEquals(list.includes("failing"), true);
  assertEquals(list.includes("A test command"), true);
  assertEquals(list.includes("A command that fails"), true);
});

Deno.test("CommandRegistry - generates message for empty registry", () => {
  const registry = new CommandRegistry();

  const list = registry.getCommandList();

  assertEquals(list, "No commands registered.");
});
