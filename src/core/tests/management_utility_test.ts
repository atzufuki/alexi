/**
 * Tests for ManagementUtility command discovery fixes.
 *
 * Covers three bugs fixed in issue #254:
 *   1. HelpCommand instance overwritten by registerCommandsFromModule
 *   2. Silent failure when settings file is missing → better error message
 *   3. HelpCommand.showGeneralHelp showing "No registered commands"
 *
 * Also covers issue #258:
 *   4. ALEXI_SETTINGS_MODULE env var not respected by loadAppCommands()
 */

import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { BaseCommand, success } from "../management/base_command.ts";
import type {
  CommandConstructor,
  CommandOptions,
  CommandResult,
  IConsole,
} from "../management/types.ts";
import { ManagementUtility } from "../management/management.ts";

// =============================================================================
// Helpers
// =============================================================================

/** Minimal IConsole that captures output. */
function makeConsole(lines: string[]): IConsole {
  return {
    log: (...args: unknown[]) => lines.push(args.join(" ")),
    error: (...args: unknown[]) => lines.push(args.join(" ")),
    warn: (...args: unknown[]) => lines.push(args.join(" ")),
    info: (...args: unknown[]) => lines.push(args.join(" ")),
  };
}

/** Capture stdout and stderr from ManagementUtility.execute(). */
async function runManagement(
  args: string[],
  commands: CommandConstructor[] = [],
  projectRoot?: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  const utility = new ManagementUtility({
    programName: "test-manage.ts",
    title: "Test Commands",
    commands,
    ...(projectRoot ? { projectRoot } : {}),
  });

  utility.setConsole(
    makeConsole(stdoutLines),
    makeConsole(stderrLines),
  );

  const exitCode = await utility.execute(args);

  return {
    stdout: stdoutLines.join("\n"),
    stderr: stderrLines.join("\n"),
    exitCode,
  };
}

// =============================================================================
// Stub Commands
// =============================================================================

class StubCommand extends BaseCommand {
  readonly name = "stub";
  readonly help = "Stub command for testing";

  async handle(_options: CommandOptions): Promise<CommandResult> {
    this.stdout.log("stub ran");
    return success();
  }
}

// =============================================================================
// Bug 1: HelpCommand must not be overwritten by registerCommandsFromModule
// =============================================================================

Deno.test(
  "ManagementUtility: 'help' subcommand shows registered commands",
  async () => {
    const { stdout, exitCode } = await runManagement(["help"], [StubCommand]);
    assertEquals(exitCode, 0);
    assertStringIncludes(stdout, "stub");
    assertEquals(
      stdout.includes("No registered commands"),
      false,
      `Expected stdout NOT to contain "No registered commands", got:\n${stdout}`,
    );
  },
);

Deno.test(
  "ManagementUtility: no-args invocation shows all registered commands",
  async () => {
    const { stdout, exitCode } = await runManagement([], [StubCommand]);
    assertEquals(exitCode, 0);
    assertStringIncludes(stdout, "stub");
    assertStringIncludes(stdout, "help");
  },
);

Deno.test(
  "ManagementUtility: 'help' and no-args both show same command list",
  async () => {
    const tempDir = await Deno.makeTempDir();
    try {
      const result1 = await runManagement([], [StubCommand], tempDir);
      const result2 = await runManagement(["help"], [StubCommand], tempDir);

      // Both should exit 0
      assertEquals(result1.exitCode, 0);
      assertEquals(result2.exitCode, 0);

      // Both should list the stub command
      assertStringIncludes(result1.stdout, "stub");
      assertStringIncludes(result2.stdout, "stub");

      // Neither should show the broken message
      assertEquals(result1.stdout.includes("No registered commands"), false);
      assertEquals(result2.stdout.includes("No registered commands"), false);
    } finally {
      await Deno.remove(tempDir, { recursive: true });
    }
  },
);

// =============================================================================
// Bug 2: Helpful error message when settings file is missing
// =============================================================================

Deno.test(
  "ManagementUtility: unknown command without settings hints at --settings",
  async () => {
    // Use a temp dir with no project/*.settings.ts — simulates a project where
    // no settings file is found during auto-scan.
    const tempDir = await Deno.makeTempDir();
    try {
      const { stderr, exitCode } = await runManagement(
        ["createsuperuser"],
        [],
        tempDir,
      );
      assertEquals(exitCode, 1);
      assertStringIncludes(stderr, "Unknown command: createsuperuser");
      assertStringIncludes(stderr, "--settings");
    } finally {
      await Deno.remove(tempDir, { recursive: true });
    }
  },
);

Deno.test(
  "ManagementUtility: unknown command WITH settings shows generic hint",
  async () => {
    // When a settings file exists but the command simply isn't registered,
    // the --settings hint must NOT appear (it would be misleading).
    const tempDir = await Deno.makeTempDir();
    try {
      await Deno.mkdir(`${tempDir}/project`);
      await Deno.writeTextFile(
        `${tempDir}/project/test.settings.ts`,
        "export const INSTALLED_APPS = [];\n",
      );

      const { stderr, exitCode } = await runManagement(
        ["nonexistentcommand"],
        [],
        tempDir,
      );
      assertEquals(exitCode, 1);
      assertStringIncludes(stderr, "Unknown command: nonexistentcommand");
      assertEquals(
        stderr.includes("--settings"),
        false,
        "Expected NO --settings hint when settings were already found",
      );
    } finally {
      await Deno.remove(tempDir, { recursive: true });
    }
  },
);

// =============================================================================
// Bug #256: HelpCommand overwritten when alexi_management_commands passed
//           via config.commands
// =============================================================================

Deno.test(
  "ManagementUtility: 'help' with alexi_management_commands in config.commands lists all commands",
  async () => {
    const { alexi_management_commands } = await import(
      "../management/management.ts"
    );
    const { stdout, exitCode } = await runManagement(
      ["help"],
      alexi_management_commands,
    );
    assertEquals(exitCode, 0, `Expected exit code 0, got ${exitCode}`);
    // Must NOT fall through to the "No commands registered" fallback
    assertEquals(
      stdout.includes("No commands registered"),
      false,
      `Expected stdout NOT to contain "No commands registered", got:\n${stdout}`,
    );
    // Should list at least the help and test commands that come from alexi_management_commands
    assertStringIncludes(stdout, "help");
    assertStringIncludes(stdout, "test");
  },
);

Deno.test(
  "ManagementUtility: 'help' and no-args are consistent when alexi_management_commands used",
  async () => {
    const { alexi_management_commands } = await import(
      "../management/management.ts"
    );

    const resultNoArgs = await runManagement([], alexi_management_commands);
    const resultHelp = await runManagement(
      ["help"],
      alexi_management_commands,
    );

    assertEquals(resultNoArgs.exitCode, 0);
    assertEquals(resultHelp.exitCode, 0);

    // Both outputs must include the same set of built-in commands
    assertStringIncludes(resultNoArgs.stdout, "help");
    assertStringIncludes(resultHelp.stdout, "help");
    assertStringIncludes(resultNoArgs.stdout, "test");
    assertStringIncludes(resultHelp.stdout, "test");

    // Neither should show the broken fallback message
    assertEquals(resultNoArgs.stdout.includes("No commands registered"), false);
    assertEquals(resultHelp.stdout.includes("No commands registered"), false);
  },
);

// =============================================================================
// Bug 3: HelpCommand fallback message is informative when used standalone
// =============================================================================

Deno.test(
  "HelpCommand: standalone (no registry set) shows informative fallback",
  async () => {
    const { HelpCommand } = await import(
      "../management/commands/help.ts"
    );
    const cmd = new HelpCommand();

    const stdoutLines: string[] = [];
    cmd.setConsole(
      makeConsole(stdoutLines),
      makeConsole([]),
    );

    const result = await cmd.run([], false);
    assertEquals(result.exitCode, 0);

    const output = stdoutLines.join("\n");
    // Old cryptic message must be gone
    assertEquals(
      output.includes("No registered commands."),
      false,
      `Expected improved fallback, got:\n${output}`,
    );
    // New message should mention how to properly use the CLI
    assertStringIncludes(output, "getCliApplication");
  },
);

// =============================================================================
// Bug #258: ALEXI_SETTINGS_MODULE env var not respected by loadAppCommands()
// =============================================================================

Deno.test(
  "ManagementUtility: ALEXI_SETTINGS_MODULE is used when --settings flag is absent",
  async () => {
    const tempDir = await Deno.makeTempDir();
    try {
      // Write a minimal settings file with one custom command registered
      const settingsPath = `${tempDir}/project/test.settings.ts`;
      await Deno.mkdir(`${tempDir}/project`, { recursive: true });

      // Write a tiny app module with one custom command.
      // Export as `commands` so loadCommandsFromImportFn picks it up via the
      // module.commands fallback path.
      const appModPath = `${tempDir}/app_mod.ts`;
      await Deno.writeTextFile(
        appModPath,
        `
import { BaseCommand, success } from "${
          new URL("../management/base_command.ts", import.meta.url).href
        }";
import type { CommandOptions, CommandResult } from "${
          new URL("../management/types.ts", import.meta.url).href
        }";

export class EnvVarCommand extends BaseCommand {
  readonly name = "envvarcommand";
  readonly help = "Discovered via ALEXI_SETTINGS_MODULE";
  async handle(_options: CommandOptions): Promise<CommandResult> {
    return success();
  }
}

export const commands = { EnvVarCommand };
export default { name: "test-app", verboseName: "Test App" };
`,
      );

      const appModUrl =
        new URL(`file://${appModPath.replace(/\\/g, "/")}`).href;
      await Deno.writeTextFile(
        settingsPath,
        `export const INSTALLED_APPS = [() => import("${appModUrl}")];\n`,
      );

      // Set the env var to point at our temp settings file (use forward slashes for Windows compat)
      const envValue = settingsPath.replace(/\\/g, "/");

      const stdoutLines: string[] = [];
      const stderrLines: string[] = [];

      const utility = new ManagementUtility({
        programName: "test-manage.ts",
        title: "Test Commands",
        commands: [],
        projectRoot: tempDir,
      });
      utility.setConsole(
        makeConsole(stdoutLines),
        makeConsole(stderrLines),
      );

      // Set env var before execution
      Deno.env.set("ALEXI_SETTINGS_MODULE", envValue);
      try {
        const exitCode = await utility.execute(["help"]);
        const stdout = stdoutLines.join("\n");
        assertEquals(exitCode, 0, `Expected exit 0, got ${exitCode}`);
        assertStringIncludes(
          stdout,
          "envvarcommand",
          `Expected 'envvarcommand' in help output when ALEXI_SETTINGS_MODULE is set.\nGot:\n${stdout}`,
        );
      } finally {
        Deno.env.delete("ALEXI_SETTINGS_MODULE");
      }
    } finally {
      await Deno.remove(tempDir, { recursive: true });
    }
  },
);

Deno.test(
  "ManagementUtility: --settings flag takes precedence over ALEXI_SETTINGS_MODULE",
  async () => {
    const tempDir = await Deno.makeTempDir();
    try {
      await Deno.mkdir(`${tempDir}/project`, { recursive: true });

      // Settings file A — has commandA
      const commandAModPath = `${tempDir}/app_a.ts`;
      await Deno.writeTextFile(
        commandAModPath,
        `
import { BaseCommand, success } from "${
          new URL("../management/base_command.ts", import.meta.url).href
        }";
import type { CommandOptions, CommandResult } from "${
          new URL("../management/types.ts", import.meta.url).href
        }";
export class CommandA extends BaseCommand {
  readonly name = "commanda";
  readonly help = "From settings A";
  async handle(_o: CommandOptions): Promise<CommandResult> { return success(); }
}
export const commands = { CommandA };
export default { name: "app-a", verboseName: "App A" };
`,
      );
      const urlA = new URL(
        `file://${commandAModPath.replace(/\\/g, "/")}`,
      ).href;
      const settingsAPath = `${tempDir}/project/a.settings.ts`;
      await Deno.writeTextFile(
        settingsAPath,
        `export const INSTALLED_APPS = [() => import("${urlA}")];\n`,
      );

      // Settings file B — has commandB
      const commandBModPath = `${tempDir}/app_b.ts`;
      await Deno.writeTextFile(
        commandBModPath,
        `
import { BaseCommand, success } from "${
          new URL("../management/base_command.ts", import.meta.url).href
        }";
import type { CommandOptions, CommandResult } from "${
          new URL("../management/types.ts", import.meta.url).href
        }";
export class CommandB extends BaseCommand {
  readonly name = "commandb";
  readonly help = "From settings B";
  async handle(_o: CommandOptions): Promise<CommandResult> { return success(); }
}
export const commands = { CommandB };
export default { name: "app-b", verboseName: "App B" };
`,
      );
      const urlB = new URL(
        `file://${commandBModPath.replace(/\\/g, "/")}`,
      ).href;
      const settingsBPath = `${tempDir}/project/b.settings.ts`;
      await Deno.writeTextFile(
        settingsBPath,
        `export const INSTALLED_APPS = [() => import("${urlB}")];\n`,
      );

      const stdoutLines: string[] = [];
      const utility = new ManagementUtility({
        programName: "test-manage.ts",
        title: "Test Commands",
        commands: [],
        projectRoot: tempDir,
      });
      utility.setConsole(makeConsole(stdoutLines), makeConsole([]));

      // Set env var to settings A, but pass --settings for B on the CLI
      const absPathA = settingsAPath.replace(/\\/g, "/");
      Deno.env.set("ALEXI_SETTINGS_MODULE", absPathA);
      try {
        const absPathB = settingsBPath.replace(/\\/g, "/");
        const exitCode = await utility.execute([
          "help",
          `--settings=${absPathB}`,
        ]);
        const stdout = stdoutLines.join("\n");
        assertEquals(exitCode, 0);
        // Should contain commandB (from --settings), not commandA (from env var)
        assertStringIncludes(stdout, "commandb");
        assertEquals(
          stdout.includes("commanda"),
          false,
          `--settings flag should override ALEXI_SETTINGS_MODULE, but 'commanda' appeared in:\n${stdout}`,
        );
      } finally {
        Deno.env.delete("ALEXI_SETTINGS_MODULE");
      }
    } finally {
      await Deno.remove(tempDir, { recursive: true });
    }
  },
);
