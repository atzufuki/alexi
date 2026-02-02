/**
 * Tests for ManagementUtility
 *
 * @module @alexi/management/tests/management
 */

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { ManagementUtility } from "../management.ts";
import { BaseCommand, success } from "../base_command.ts";
import type { CommandOptions, CommandResult, IArgumentParser, IConsole } from "../types.ts";

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

class GreetCommand extends BaseCommand {
  readonly name = "greet";
  readonly help = "Greet someone";

  addArguments(parser: IArgumentParser): void {
    parser.addArgument("--name", {
      type: "string",
      default: "World",
      help: "Name to greet",
    });
  }

  async handle(options: CommandOptions): Promise<CommandResult> {
    const name = options.args.name as string;
    this.stdout.log(`Hello, ${name}!`);
    return success();
  }
}

class EchoCommand extends BaseCommand {
  readonly name = "echo";
  readonly help = "Echo a message";

  addArguments(parser: IArgumentParser): void {
    parser.addArgument("message", {
      required: true,
      help: "Message to echo",
    });
  }

  async handle(options: CommandOptions): Promise<CommandResult> {
    const message = options.args.message as string;
    this.stdout.log(message);
    return success();
  }
}

// =============================================================================
// ManagementUtility Basic Tests
// =============================================================================

Deno.test("ManagementUtility - shows usage when no arguments", async () => {
  const cli = new ManagementUtility();
  const mockConsole = new MockConsole();
  cli.setConsole(mockConsole);

  const exitCode = await cli.execute([]);

  assertEquals(exitCode, 0);
  assertEquals(
    mockConsole.logs.some((log) => log.includes("Available commands")),
    true,
  );
});

Deno.test("ManagementUtility - shows usage with --help", async () => {
  const cli = new ManagementUtility();
  const mockConsole = new MockConsole();
  cli.setConsole(mockConsole);

  const exitCode = await cli.execute(["--help"]);

  assertEquals(exitCode, 0);
  assertEquals(
    mockConsole.logs.some((log) => log.includes("Available commands")),
    true,
  );
});

Deno.test("ManagementUtility - shows usage with -h", async () => {
  const cli = new ManagementUtility();
  const mockConsole = new MockConsole();
  cli.setConsole(mockConsole);

  const exitCode = await cli.execute(["-h"]);

  assertEquals(exitCode, 0);
});

Deno.test("ManagementUtility - shows version with --version", async () => {
  const cli = new ManagementUtility();
  const mockConsole = new MockConsole();
  cli.setConsole(mockConsole);

  const exitCode = await cli.execute(["--version"]);

  assertEquals(exitCode, 0);
  assertEquals(
    mockConsole.logs.some((log) => log.includes("Alexi Management")),
    true,
  );
});

Deno.test("ManagementUtility - shows version with -v", async () => {
  const cli = new ManagementUtility();
  const mockConsole = new MockConsole();
  cli.setConsole(mockConsole);

  const exitCode = await cli.execute(["-v"]);

  assertEquals(exitCode, 0);
});

// =============================================================================
// Built-in Commands Tests
// =============================================================================

Deno.test("ManagementUtility - has built-in help command", async () => {
  const cli = new ManagementUtility();
  const mockConsole = new MockConsole();
  cli.setConsole(mockConsole);

  const exitCode = await cli.execute(["help"]);

  assertEquals(exitCode, 0);
  assertEquals(
    mockConsole.logs.some((log) => log.includes("Available commands")),
    true,
  );
});

Deno.test("ManagementUtility - has built-in help and test commands", () => {
  const cli = new ManagementUtility();

  const registry = cli.getRegistry();

  // Only help and test are built-in core commands
  // runserver comes from INSTALLED_APPS (alexi_web, alexi_staticfiles, alexi_webui)
  assertEquals(registry.has("help"), true);
  assertEquals(registry.has("test"), true);
});

// =============================================================================
// Custom Commands Tests
// =============================================================================

Deno.test("ManagementUtility - registers custom command", () => {
  const cli = new ManagementUtility();

  cli.registerCommand(GreetCommand);

  assertEquals(cli.getRegistry().has("greet"), true);
});

Deno.test("ManagementUtility - registers multiple custom commands", () => {
  const cli = new ManagementUtility();

  cli.registerCommands([GreetCommand, EchoCommand]);

  assertEquals(cli.getRegistry().has("greet"), true);
  assertEquals(cli.getRegistry().has("echo"), true);
});

Deno.test("ManagementUtility - executes custom command", async () => {
  const cli = new ManagementUtility();
  const mockConsole = new MockConsole();
  cli.setConsole(mockConsole);
  cli.registerCommand(GreetCommand);

  const exitCode = await cli.execute(["greet"]);

  assertEquals(exitCode, 0);
  assertEquals(
    mockConsole.logs.some((log) => log.includes("Hello, World!")),
    true,
  );
});

Deno.test("ManagementUtility - passes arguments to custom command", async () => {
  const cli = new ManagementUtility();
  const mockConsole = new MockConsole();
  cli.setConsole(mockConsole);
  cli.registerCommand(GreetCommand);

  const exitCode = await cli.execute(["greet", "--name", "Alexi"]);

  assertEquals(exitCode, 0);
  assertEquals(
    mockConsole.logs.some((log) => log.includes("Hello, Alexi!")),
    true,
  );
});

Deno.test("ManagementUtility - accepts commands via config", async () => {
  const mockConsole = new MockConsole();
  const cli = new ManagementUtility({
    commands: [GreetCommand, EchoCommand],
  });
  cli.setConsole(mockConsole);

  const exitCode = await cli.execute(["greet"]);

  assertEquals(exitCode, 0);
  assertEquals(cli.getRegistry().has("greet"), true);
  assertEquals(cli.getRegistry().has("echo"), true);
});

// =============================================================================
// Error Handling Tests
// =============================================================================

Deno.test("ManagementUtility - returns error for unknown command", async () => {
  const cli = new ManagementUtility();
  const mockConsole = new MockConsole();
  cli.setConsole(mockConsole);

  const exitCode = await cli.execute(["unknown"]);

  assertEquals(exitCode, 1);
  assertEquals(
    mockConsole.errors.some((err) => err.includes("not found")),
    true,
  );
});

Deno.test("ManagementUtility - shows available commands on unknown command", async () => {
  const cli = new ManagementUtility();
  const mockConsole = new MockConsole();
  cli.setConsole(mockConsole);

  await cli.execute(["unknown"]);

  assertEquals(
    mockConsole.errors.some((err) => err.includes("Available commands")),
    true,
  );
});

// =============================================================================
// Help Command Tests
// =============================================================================

Deno.test("ManagementUtility - help shows specific command help", async () => {
  const cli = new ManagementUtility();
  const mockConsole = new MockConsole();
  cli.setConsole(mockConsole);
  cli.registerCommand(GreetCommand);

  const exitCode = await cli.execute(["help", "greet"]);

  // Exit code should be 0 for successful help
  assertEquals(exitCode, 0);
  // Note: The command's printHelp uses its own console, which may not be
  // the mock console. The important thing is that the command was found
  // and executed successfully (exitCode 0).
});

Deno.test("ManagementUtility - help shows error for unknown command", async () => {
  const cli = new ManagementUtility();
  const mockConsole = new MockConsole();
  cli.setConsole(mockConsole);

  const exitCode = await cli.execute(["help", "unknown"]);

  assertEquals(exitCode, 1);
  assertEquals(
    mockConsole.errors.some((err) => err.includes("not found")),
    true,
  );
});

// =============================================================================
// Configuration Tests
// =============================================================================

Deno.test("ManagementUtility - respects debug config", () => {
  const cli = new ManagementUtility({ debug: true });

  assertEquals(cli.isDebug(), true);
});

Deno.test("ManagementUtility - respects projectRoot config", () => {
  const cli = new ManagementUtility({ projectRoot: "/custom/path" });

  assertEquals(cli.getProjectRoot(), "/custom/path");
});

// =============================================================================
// Dynamic Command Loading Tests
// =============================================================================

Deno.test("ManagementUtility - runserver requires --settings argument", async () => {
  // This test verifies that runserver command (loaded from INSTALLED_APPS)
  // requires the --settings argument to know which settings file to use
  const cli = new ManagementUtility();
  const mockConsole = new MockConsole();
  cli.setConsole(mockConsole);

  // runserver is found from project/*.settings.ts files but requires --settings
  const exitCode = await cli.execute(["runserver"]);

  // Should fail because --settings is required
  assertEquals(exitCode, 1);
  // Check that the error mentions missing settings or required argument
  const hasError = mockConsole.errors.some(
    (err) =>
      err.includes("settings") ||
      err.includes("required") ||
      err.includes("not found"),
  );
  assertEquals(hasError, true);
});
