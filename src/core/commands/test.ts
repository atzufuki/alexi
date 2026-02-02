/**
 * Test Command for Alexi Management Commands
 *
 * Built-in command that runs tests with an isolated test server and database.
 * Similar to Django's test command.
 *
 * @module @alexi/management/commands/test
 */

import { BaseCommand, failure, success } from "../base_command.ts";
import type {
  CommandOptions,
  CommandResult,
  IArgumentParser,
} from "../types.ts";

// =============================================================================
// Types
// =============================================================================

/**
 * Test configuration type
 */
export interface TestConfig {
  /** Port for the test server */
  port: number;
  /** Host for the test server */
  host: string;
  /** Path to the test database */
  testDbPath: string;
  /** Test file pattern */
  pattern: string;
  /** Whether to keep the test database after tests */
  keepDb: boolean;
  /** Debug mode */
  debug: boolean;
}

// =============================================================================
// TestCommand Class
// =============================================================================

/**
 * Built-in command for running tests with an isolated server and database
 *
 * This command:
 * 1. Creates a temporary test database
 * 2. Starts the server on an alternate port
 * 3. Runs the specified tests
 * 4. Cleans up the test database (unless --keepdb is specified)
 *
 * @example Command line
 * ```bash
 * deno run -A manage.ts test
 * deno run -A manage.ts test --port 8001
 * deno run -A manage.ts test --pattern "src/comachine-web/tests/*"
 * deno run -A manage.ts test --keepdb
 * ```
 */
export class TestCommand extends BaseCommand {
  readonly name = "test";
  readonly help = "Run tests with an isolated test server and database";
  override readonly description =
    "Starts a test server on a separate port and uses an isolated test database. " +
    "Works similarly to Django's test command.";

  override readonly examples = [
    "manage.ts test                              - Run all tests",
    "manage.ts test --port 8001                  - Use port 8001",
    "manage.ts test --pattern 'tests/login_*'   - Run only login tests",
    "manage.ts test --keepdb                     - Keep test database",
    "manage.ts test --failfast                   - Stop at first failure",
  ];

  // ===========================================================================
  // Argument Configuration
  // ===========================================================================

  override addArguments(parser: IArgumentParser): void {
    parser.addArgument("--settings", {
      type: "string",
      default: "web",
      alias: "-s",
      help: "Settings module to use (default: web)",
    });

    parser.addArgument("--port", {
      type: "number",
      default: 8001,
      alias: "-p",
      help: "Port for the test server to listen on (default: 8001)",
    });

    parser.addArgument("--host", {
      type: "string",
      default: "127.0.0.1",
      alias: "-H",
      help: "Host address to bind the test server to (default: 127.0.0.1)",
    });

    parser.addArgument("--pattern", {
      type: "string",
      default: "src/comachine-web/tests/*_test.ts",
      help: "Glob pattern for test files",
    });

    parser.addArgument("--keepdb", {
      type: "boolean",
      default: false,
      help: "Keep the test database after tests complete",
    });

    parser.addArgument("--failfast", {
      type: "boolean",
      default: false,
      help: "Stop at the first failed test",
    });

    parser.addArgument("--filter", {
      type: "string",
      default: "",
      help: "Filter tests by name",
    });
  }

  // ===========================================================================
  // Command Execution
  // ===========================================================================

  async handle(options: CommandOptions): Promise<CommandResult> {
    const settings = options.args.settings as string;
    const port = options.args.port as number;
    const host = options.args.host as string;
    const pattern = options.args.pattern as string;
    const keepDb = options.args.keepdb as boolean;
    const failfast = options.args.failfast as boolean;
    const filter = options.args.filter as string;
    const debug = options.debug;

    // Validate port
    if (port < 1 || port > 65535) {
      this.error(
        `Invalid port: ${port}. Port must be between 1 and 65535.`,
      );
      return failure("Invalid port");
    }

    // Generate unique test database path
    const testDbPath = await this.createTestDatabase();

    // Print startup banner
    this.printBanner(host, port, testDbPath, pattern, keepDb, debug);

    // Set environment variables for test database
    const originalKvPath = Deno.env.get("DENO_KV_PATH");
    Deno.env.set("DENO_KV_PATH", testDbPath);
    Deno.env.set("TEST_SERVER_PORT", port.toString());
    Deno.env.set("TEST_SERVER_HOST", host);

    let serverProcess: Deno.ChildProcess | null = null;
    let testResult: CommandResult = success();

    try {
      // Start test server in background
      this.info("Starting test server...");
      serverProcess = await this.startTestServer(
        settings,
        port,
        host,
        testDbPath,
        debug,
      );

      // Wait for server to be ready
      await this.waitForServer(host, port);
      this.success(
        `Test server running at http://${host}:${port}/`,
      );

      // Run tests
      this.info("Running tests...");
      console.log("");

      testResult = await this.runTests(pattern, filter, failfast);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.error(`Test execution failed: ${message}`);
      testResult = failure(message);
    } finally {
      // Stop the server
      if (serverProcess) {
        this.info("Stopping test server...");
        try {
          serverProcess.kill("SIGTERM");
          await serverProcess.status;
        } catch {
          // Process may already be terminated
        }
      }

      // Restore original environment
      if (originalKvPath) {
        Deno.env.set("DENO_KV_PATH", originalKvPath);
      } else {
        Deno.env.delete("DENO_KV_PATH");
      }
      Deno.env.delete("TEST_SERVER_PORT");
      Deno.env.delete("TEST_SERVER_HOST");

      // Clean up test database
      if (!keepDb) {
        await this.cleanupTestDatabase(testDbPath);
      } else {
        this.info(`Test database preserved: ${testDbPath}`);
      }
    }

    return testResult;
  }

  // ===========================================================================
  // Test Database Management
  // ===========================================================================

  /**
   * Create a temporary test database path
   */
  private async createTestDatabase(): Promise<string> {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const testDbPath = `.test_db_${timestamp}_${random}`;

    this.debug(`Creating test database: ${testDbPath}`, true);

    return testDbPath;
  }

  /**
   * Clean up the test database
   */
  private async cleanupTestDatabase(testDbPath: string): Promise<void> {
    try {
      // DenoKV creates multiple files, try to remove all
      const filesToRemove = [
        testDbPath,
        `${testDbPath}-shm`,
        `${testDbPath}-wal`,
      ];

      for (const file of filesToRemove) {
        try {
          await Deno.remove(file);
        } catch {
          // File may not exist
        }
      }

      this.success("Test database removed");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.warn(`Failed to remove test database: ${message}`);
    }
  }

  // ===========================================================================
  // Test Server Management
  // ===========================================================================

  /**
   * Start the test server as a subprocess
   */
  private async startTestServer(
    settings: string,
    port: number,
    host: string,
    testDbPath: string,
    debug: boolean,
  ): Promise<Deno.ChildProcess> {
    const command = new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "-A",
        "--unstable-kv",
        "--unstable-bundle",
        "manage.ts",
        "runserver",
        "--settings",
        settings,
        "--port",
        port.toString(),
        "--host",
        host,
        "--no-reload",
        ...(debug ? ["--debug"] : []),
      ],
      env: {
        ...Deno.env.toObject(),
        DENO_KV_PATH: testDbPath,
      },
      stdout: debug ? "inherit" : "null",
      stderr: debug ? "inherit" : "piped",
    });

    return command.spawn();
  }

  /**
   * Wait for the server to be ready
   */
  private async waitForServer(
    host: string,
    port: number,
    maxAttempts = 30,
    delayMs = 500,
  ): Promise<void> {
    const url = `http://${host}:${port}/api/health/`;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          return;
        }
      } catch {
        // Server not ready yet
      }

      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    throw new Error(
      `Test server did not start within ${
        maxAttempts * delayMs / 1000
      } seconds`,
    );
  }

  // ===========================================================================
  // Test Execution
  // ===========================================================================

  /**
   * Run the tests using Deno's built-in test runner
   */
  private async runTests(
    pattern: string,
    filter: string,
    failfast: boolean,
  ): Promise<CommandResult> {
    const args = [
      "test",
      "-A",
      "--unstable-kv",
      "--no-check",
      pattern,
    ];

    // Set env var so tests can detect subprocess execution
    // DENO_JOBS=1 forces serial test execution to avoid overwhelming the server
    const testEnv = {
      ...Deno.env.toObject(),
      DENO_TEST_SUBPROCESS: "true",
      DENO_JOBS: "1",
    };

    if (filter) {
      args.push("--filter", filter);
    }

    if (failfast) {
      args.push("--fail-fast");
    }

    const command = new Deno.Command(Deno.execPath(), {
      args,
      env: testEnv,
      stdout: "inherit",
      stderr: "inherit",
    });

    const { code } = await command.output();

    if (code === 0) {
      console.log("");
      this.success("All tests passed!");
      return success();
    } else {
      console.log("");
      this.error("Some tests failed");
      return failure("Some tests failed", code);
    }
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  /**
   * Print the startup banner
   */
  private printBanner(
    host: string,
    port: number,
    testDbPath: string,
    pattern: string,
    keepDb: boolean,
    debug: boolean,
  ): void {
    const lines: string[] = [];

    lines.push("┌─────────────────────────────────────────────┐");
    lines.push("│           Alexi Test Runner                 │");
    lines.push("└─────────────────────────────────────────────┘");
    lines.push("");
    lines.push("Configuration:");
    lines.push(`  Test server:       http://${host}:${port}/`);
    lines.push(`  Test database:     ${testDbPath}`);
    lines.push(`  Test pattern:      ${pattern}`);
    lines.push(`  Keep database:     ${keepDb ? "Yes" : "No"}`);
    lines.push(`  Debug mode:        ${debug ? "On" : "Off"}`);
    lines.push("");

    this.stdout.log(lines.join("\n"));
  }
}
