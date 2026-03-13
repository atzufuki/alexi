/**
 * Tests for ManagementUtility command discovery fixes.
 *
 * Covers three bugs fixed in issue #254:
 *   1. HelpCommand instance overwritten by registerCommandsFromModule
 *   2. Silent failure when settings file is missing → better error message
 *   3. HelpCommand.showGeneralHelp showing "No registered commands"
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
