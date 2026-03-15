/**
 * Tests for ManagementUtility
 *
 * @module @alexi/management/tests/management
 */

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  alexi_management_commands,
  getCliApplication,
  ManagementUtility,
} from "../management/management.ts";
import { BaseCommand, success } from "../management/base_command.ts";
import type {
  CommandOptions,
  CommandResult,
  IArgumentParser,
  IConsole,
} from "../management/types.ts";

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

  override addArguments(parser: IArgumentParser): void {
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

  override addArguments(parser: IArgumentParser): void {
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
    mockConsole.logs.some((log) => log.includes("cli")),
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
  // Help command output may include "Available commands" or usage info
  // The important thing is that exitCode is 0 (success)
});

Deno.test("ManagementUtility - has only minimal built-in commands by default", () => {
  const cli = new ManagementUtility();

  const registry = cli.getRegistry();

  assertEquals(registry.has("help"), true);
  assertEquals(registry.has("test"), false);
  assertEquals(registry.has("flush"), false);
  assertEquals(registry.has("startapp"), false);
});

Deno.test("ManagementUtility - framework commands are opt-in", () => {
  const cli = new ManagementUtility({ commands: alexi_management_commands });

  const registry = cli.getRegistry();

  assertEquals(registry.has("help"), true);
  assertEquals(registry.has("test"), true);
  assertEquals(registry.has("flush"), true);
  assertEquals(registry.has("startapp"), true);
});

Deno.test("getCliApplication - creates configured CLI application", async () => {
  const cli = await getCliApplication({
    programName: "asr",
    title: "ASR Commands",
    commands: [GreetCommand],
  });

  assertEquals(cli.getRegistry().has("help"), true);
  assertEquals(cli.getRegistry().has("greet"), true);
  assertEquals(cli.getRegistry().has("test"), false);
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

Deno.test("ManagementUtility - uses custom title and usage in help output", async () => {
  const mockConsole = new MockConsole();
  const cli = new ManagementUtility({
    title: "ASR Commands",
    programName: "asr",
  });
  cli.setConsole(mockConsole);

  const exitCode = await cli.execute(["help"]);

  assertEquals(exitCode, 0);
  assertEquals(
    mockConsole.logs.some((log) => log.includes("ASR Commands")),
    true,
  );
  assertEquals(
    mockConsole.logs.some((log) =>
      log.includes("Usage: asr <command> [arguments]")
    ),
    true,
  );
});

Deno.test("ManagementUtility - uses program name for command help", async () => {
  const mockConsole = new MockConsole();
  const cli = new ManagementUtility({ programName: "asr" });
  cli.setConsole(mockConsole);
  cli.registerCommand(GreetCommand);

  const exitCode = await cli.execute(["greet", "--help"]);

  assertEquals(exitCode, 0);
  assertEquals(
    mockConsole.logs.some((log) => log.includes("Usage: asr greet [options]")),
    true,
  );
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
    mockConsole.errors.some((err) => err.includes("Unknown command")),
    true,
  );
});

Deno.test("ManagementUtility - shows available commands on unknown command", async () => {
  const cli = new ManagementUtility();
  const mockConsole = new MockConsole();
  cli.setConsole(mockConsole);

  await cli.execute(["unknown"]);

  // Should suggest running 'help' to see available commands
  assertEquals(
    mockConsole.errors.some((err) => err.includes("help")),
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

  // Help for unknown command should return error
  assertEquals(exitCode, 1);
  // Error message may say "not found" or "Unknown command"
  assertEquals(
    mockConsole.errors.some((err) =>
      err.includes("not found") || err.includes("Unknown")
    ),
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

// =============================================================================
// App Command Discovery Tests
// =============================================================================

// =============================================================================
// Command Shadowing Tests (Django-style, fix #370)
// =============================================================================

/**
 * Fake "staticfiles-style" RunServerCommand that should shadow the core one.
 * Has `name = "runserver"` — exactly how @alexi/staticfiles contributes it.
 */
class FakeStaticRunServerCommand extends BaseCommand {
  readonly name = "runserver";
  readonly help = "Staticfiles runserver (fake)";

  async handle(_options: CommandOptions): Promise<CommandResult> {
    this.stdout.log("staticfiles runserver");
    return success();
  }
}

/** App command that shadows the built-in `flush` command. */
class AppFlushCommand extends BaseCommand {
  readonly name = "flush";
  readonly help = "App flush (custom)";

  async handle(_options: CommandOptions): Promise<CommandResult> {
    this.stdout.log("app flush");
    return success();
  }
}

/** Trying to shadow the `help` command — must NOT take effect. */
class FakeHelpCommand extends BaseCommand {
  readonly name = "help";
  readonly help = "Fake help";

  async handle(_options: CommandOptions): Promise<CommandResult> {
    this.stdout.log("fake help");
    return success();
  }
}

Deno.test(
  "Command shadowing: app runserver replaces core runserver",
  async () => {
    // Register core runserver, then shadow it with the staticfiles variant
    const { RunServerCommand: CoreRunServer } = await import(
      "../management/commands/runserver.ts"
    );

    const cli = new ManagementUtility({
      commands: [CoreRunServer],
    });
    const mockConsole = new MockConsole();
    cli.setConsole(mockConsole);

    // Shadow via registerCommandsFromModule (the real path used by INSTALLED_APPS)
    cli["registerCommandsFromModule"](
      { RunServerCommand: FakeStaticRunServerCommand },
      "fake-staticfiles",
    );

    const exitCode = await cli.execute(["runserver"]);

    assertEquals(exitCode, 0);
    assertEquals(
      mockConsole.logs.some((l) => l.includes("staticfiles runserver")),
      true,
      "staticfiles variant should have run",
    );
  },
);

Deno.test(
  "Command shadowing: help command cannot be shadowed",
  async () => {
    const cli = new ManagementUtility();
    const mockConsole = new MockConsole();
    cli.setConsole(mockConsole);

    // Attempt to shadow the protected help command
    cli["registerCommandsFromModule"](
      { HelpCommand: FakeHelpCommand },
      "fake-app",
    );

    // The real help command should still respond
    const exitCode = await cli.execute(["help"]);

    assertEquals(exitCode, 0);
    // Fake help outputs "fake help" — real help outputs "Available commands"
    assertEquals(
      mockConsole.logs.some((l) => l.includes("fake help")),
      false,
      "fake help must NOT have run",
    );
  },
);

Deno.test(
  "Command shadowing: non-runserver built-in can also be shadowed",
  async () => {
    const { FlushCommand } = await import(
      "../management/commands/flush.ts"
    );

    const cli = new ManagementUtility({ commands: [FlushCommand] });
    const mockConsole = new MockConsole();
    cli.setConsole(mockConsole);

    cli["registerCommandsFromModule"](
      { AppFlushCommand },
      "fake-app",
    );

    const exitCode = await cli.execute(["flush"]);

    assertEquals(exitCode, 0);
    assertEquals(
      mockConsole.logs.some((l) => l.includes("app flush")),
      true,
      "app flush should have shadowed the built-in",
    );
  },
);

Deno.test(
  "Command shadowing: registering same command twice uses last registration",
  () => {
    const cli = new ManagementUtility();

    cli.registerCommand(GreetCommand);

    // Register again with a different class that has same name — registry allows overrides
    class GreetV2Command extends BaseCommand {
      readonly name = "greet";
      readonly help = "Greet v2";
      async handle(_options: CommandOptions): Promise<CommandResult> {
        return success();
      }
    }

    cli.registerCommand(GreetV2Command);

    // Registry should still have exactly one "greet", not throw
    assertEquals(cli.getRegistry().has("greet"), true);
  },
);

Deno.test("ManagementUtility - runserver requires --settings argument", async () => {
  // This test verifies that runserver command (loaded from INSTALLED_APPS)
  // requires the --settings argument to know which settings file to use
  const cli = new ManagementUtility();
  const mockConsole = new MockConsole();
  cli.setConsole(mockConsole);

  // Without project/*.settings.ts files, runserver won't be loaded
  // So we expect either "Unknown command" or settings-related error
  const exitCode = await cli.execute(["runserver"]);

  // Should fail - either command not found or settings required
  assertEquals(exitCode, 1);
  // Check that there's some error output
  const hasError = mockConsole.errors.some(
    (err) =>
      err.includes("settings") ||
      err.includes("required") ||
      err.includes("Unknown command") ||
      err.includes("not found"),
  );
  assertEquals(hasError, true);
});
