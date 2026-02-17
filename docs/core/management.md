# Management Commands

Alexi provides a Django-inspired management command system for running
administrative tasks from the command line. This includes built-in commands for
common operations and the ability to create custom commands.

## Overview

Management commands are run through the `manage.ts` script in your project root:

```bash
deno run -A --unstable-kv manage.ts <command> [options]
```

The management system:

- Discovers and registers commands from installed apps
- Parses command-line arguments
- Provides a consistent interface for all commands
- Supports help text and argument validation

---

## Built-in Commands

### help

Display available commands or help for a specific command.

```bash
# List all commands
deno run -A manage.ts help

# Get help for a specific command
deno run -A manage.ts help runserver
deno run -A manage.ts help test
```

### runserver

Start the development server.

```bash
# Default (port 8000)
deno run -A --unstable-kv manage.ts runserver

# Custom port and host
deno run -A --unstable-kv manage.ts runserver --port 3000 --host 127.0.0.1

# With specific settings
deno run -A --unstable-kv manage.ts runserver --settings web

# Debug mode
deno run -A --unstable-kv manage.ts runserver --debug
```

| Option           | Type      | Default   | Description          |
| ---------------- | --------- | --------- | -------------------- |
| `--port, -p`     | `number`  | `8000`    | Port to listen on    |
| `--host, -H`     | `string`  | `0.0.0.0` | Host to bind to      |
| `--settings, -s` | `string`  | `web`     | Settings module name |
| `--no-reload`    | `boolean` | `false`   | Disable auto-reload  |
| `--debug`        | `boolean` | `false`   | Enable debug mode    |

### test

Run tests with an isolated test server and database.

```bash
# Run all tests
deno run -A --unstable-kv manage.ts test

# With custom port
deno run -A --unstable-kv manage.ts test --port 8001

# Run specific tests
deno run -A --unstable-kv manage.ts test --pattern "src/**/tests/login_*"

# Stop at first failure
deno run -A --unstable-kv manage.ts test --failfast

# Keep test database for debugging
deno run -A --unstable-kv manage.ts test --keepdb
```

| Option           | Type      | Default         | Description                    |
| ---------------- | --------- | --------------- | ------------------------------ |
| `--port, -p`     | `number`  | `8001`          | Port for test server           |
| `--host, -H`     | `string`  | `127.0.0.1`     | Host for test server           |
| `--settings, -s` | `string`  | `web`           | Settings module                |
| `--pattern`      | `string`  | (from settings) | Test file glob pattern         |
| `--filter`       | `string`  | -               | Filter tests by name           |
| `--failfast`     | `boolean` | `false`         | Stop at first failure          |
| `--keepdb`       | `boolean` | `false`         | Keep test database after tests |

The test command:

1. Creates a temporary test database
2. Starts the server on the specified port
3. Runs tests matching the pattern
4. Cleans up the test database (unless `--keepdb`)

### startapp

Create a new application within your project.

```bash
# Interactive mode
deno run -A manage.ts startapp myapp

# With app type
deno run -A manage.ts startapp myapp --type web

# Skip prompts
deno run -A manage.ts startapp myapp --type web --no-input
```

| Option       | Type      | Default  | Description                                       |
| ------------ | --------- | -------- | ------------------------------------------------- |
| `--type, -t` | `string`  | (prompt) | App type: web, ui, desktop, mobile, cli, combined |
| `--no-input` | `boolean` | `false`  | Skip interactive prompts                          |

App types:

- **web**: Backend server app (views, models, REST API)
- **ui**: Browser SPA (components, client-side routing)
- **desktop**: Desktop app using WebUI
- **mobile**: Mobile app using Capacitor
- **cli**: Command-line tool
- **combined**: Full-stack (web + ui)

### flush

Clear all data from the database.

```bash
# With confirmation prompt
deno run -A --unstable-kv manage.ts flush

# Skip confirmation
deno run -A --unstable-kv manage.ts flush --yes
deno run -A --unstable-kv manage.ts flush --no-input

# Specific database
deno run -A --unstable-kv manage.ts flush --database ./data/myapp.db
```

| Option       | Type      | Default   | Description                       |
| ------------ | --------- | --------- | --------------------------------- |
| `--yes`      | `boolean` | `false`   | Skip confirmation                 |
| `--no-input` | `boolean` | `false`   | Skip confirmation (same as --yes) |
| `--database` | `string`  | (default) | Database path                     |

> ⚠️ **Warning:** This action is irreversible. All data will be permanently
> deleted.

---

## Creating Custom Commands

### Basic Structure

Create a command by extending `BaseCommand`:

```ts
// src/myapp/commands/mycommand.ts
import { BaseCommand, failure, success } from "@alexi/core";
import type {
  CommandOptions,
  CommandResult,
  IArgumentParser,
} from "@alexi/core";

export class MyCommand extends BaseCommand {
  // Required: command name (what users type)
  readonly name = "mycommand";

  // Required: short help text
  readonly help = "Do something useful";

  // Optional: longer description
  override readonly description = "This command does something useful. " +
    "It supports various options for customization.";

  // Optional: usage examples
  override readonly examples = [
    "manage.ts mycommand                  - Run with defaults",
    "manage.ts mycommand --verbose        - Run with verbose output",
    "manage.ts mycommand --count 5        - Process 5 items",
  ];

  // Configure command arguments
  override addArguments(parser: IArgumentParser): void {
    parser.addArgument("--verbose", {
      type: "boolean",
      default: false,
      alias: "-v",
      help: "Enable verbose output",
    });

    parser.addArgument("--count", {
      type: "number",
      default: 10,
      alias: "-c",
      help: "Number of items to process",
    });

    parser.addArgument("name", {
      required: true,
      help: "Name to process",
    });
  }

  // Execute the command
  async handle(options: CommandOptions): Promise<CommandResult> {
    const verbose = options.args.verbose as boolean;
    const count = options.args.count as number;
    const name = options.args._[0] as string; // Positional argument

    if (verbose) {
      this.info(`Processing ${count} items for ${name}...`);
    }

    try {
      // Do the work
      for (let i = 0; i < count; i++) {
        // ... process items
        if (verbose) {
          this.debug(`Processed item ${i + 1}`, options.debug);
        }
      }

      this.success(`Processed ${count} items!`);
      return success();
    } catch (error) {
      this.error(`Failed: ${error.message}`);
      return failure(error.message);
    }
  }
}
```

### Argument Types

| Type      | Description       | Example                 |
| --------- | ----------------- | ----------------------- |
| `string`  | Text value        | `--name "John"`         |
| `number`  | Numeric value     | `--port 8000`           |
| `boolean` | Flag (true/false) | `--verbose`             |
| `array`   | Multiple values   | `--tags foo --tags bar` |

### Argument Configuration

```ts
parser.addArgument("--option", {
  type: "string", // Argument type
  default: "value", // Default value
  required: false, // Is it required?
  alias: "-o", // Short alias
  help: "Description", // Help text
  choices: ["a", "b"], // Valid values (optional)
});
```

### Positional Arguments

```ts
parser.addArgument("filename", {
  required: true,
  help: "File to process",
});

// Access in handle():
const filename = options.args._[0] as string;
```

### Output Methods

The `BaseCommand` class provides helper methods for output:

```ts
// Success message (green ✓)
this.success("Operation completed");

// Error message (red ✗)
this.error("Something went wrong");

// Warning message (yellow ⚠)
this.warn("This might cause issues");

// Info message (blue ℹ)
this.info("Processing started");

// Debug message (only if debug mode)
this.debug("Variable value: ...", options.debug);

// Raw output
this.stdout.log("Plain text");
this.stderr.error("Error text");
```

### Return Values

Commands must return a `CommandResult`:

```ts
import { failure, success } from "@alexi/core";

// Success
return success();
return success("Operation completed");
return { exitCode: 0 };

// Failure
return failure("Error message");
return failure("Error message", 2); // Custom exit code
return { exitCode: 1, message: "Error" };
```

---

## Registering Commands

### In an App Module

Commands are auto-discovered from the `commands/mod.ts` file in each app:

```ts
// src/myapp/commands/mod.ts
export { MyCommand } from "./mycommand.ts";
export { AnotherCommand } from "./another.ts";
```

The app must export these from its main module:

```ts
// src/myapp/mod.ts
import type { AppConfig } from "@alexi/types";

export * from "./commands/mod.ts";

export default {
  name: "myapp",
  verbose_name: "My Application",
} as AppConfig;
```

### Manual Registration

You can also register commands manually in `manage.ts`:

```ts
// manage.ts
import { ManagementUtility } from "@alexi/core";
import { MyCommand } from "./src/myapp/commands/mycommand.ts";

const cli = new ManagementUtility({
  commands: [MyCommand],
});

await cli.execute(Deno.args);
```

---

## ManagementUtility

The `ManagementUtility` class is the main entry point for the CLI:

```ts
import { ManagementUtility } from "@alexi/core";

// Basic usage
const cli = new ManagementUtility();
await cli.execute(Deno.args);

// With options
const cli = new ManagementUtility({
  debug: true,
  projectRoot: "./myproject",
  commands: [MyCommand, AnotherCommand],
});

await cli.execute(Deno.args);
```

### Configuration

| Option        | Type                   | Description            |
| ------------- | ---------------------- | ---------------------- |
| `debug`       | `boolean`              | Enable debug mode      |
| `projectRoot` | `string`               | Project root directory |
| `commands`    | `CommandConstructor[]` | Commands to register   |

### Methods

```ts
// Register a single command
cli.registerCommand(MyCommand);

// Register multiple commands
cli.registerCommands([MyCommand, AnotherCommand]);

// Execute with arguments
await cli.execute(["runserver", "--port", "3000"]);

// Get the command registry
const registry = cli.getRegistry();

// Check debug mode
const isDebug = cli.isDebug();

// Get project root
const root = cli.getProjectRoot();
```

---

## Example: Database Seed Command

A practical example of a custom command that seeds the database:

```ts
// src/myapp/commands/seed.ts
import { BaseCommand, failure, success } from "@alexi/core";
import type {
  CommandOptions,
  CommandResult,
  IArgumentParser,
} from "@alexi/core";
import { setup } from "@alexi/db";
import { TaskModel, UserModel } from "../models.ts";

export class SeedCommand extends BaseCommand {
  readonly name = "seed";
  readonly help = "Seed the database with sample data";

  override readonly description =
    "Creates sample users and tasks for development and testing.";

  override readonly examples = [
    "manage.ts seed                    - Seed with default count",
    "manage.ts seed --users 10         - Create 10 users",
    "manage.ts seed --tasks 50         - Create 50 tasks",
    "manage.ts seed --clear            - Clear existing data first",
  ];

  override addArguments(parser: IArgumentParser): void {
    parser.addArgument("--users", {
      type: "number",
      default: 5,
      help: "Number of users to create",
    });

    parser.addArgument("--tasks", {
      type: "number",
      default: 20,
      help: "Number of tasks to create",
    });

    parser.addArgument("--clear", {
      type: "boolean",
      default: false,
      help: "Clear existing data before seeding",
    });
  }

  async handle(options: CommandOptions): Promise<CommandResult> {
    const userCount = options.args.users as number;
    const taskCount = options.args.tasks as number;
    const clear = options.args.clear as boolean;

    try {
      // Initialize database
      await setup({
        database: { engine: "denokv", name: "myapp" },
      });

      // Clear existing data if requested
      if (clear) {
        this.info("Clearing existing data...");
        await UserModel.objects.all().delete();
        await TaskModel.objects.all().delete();
        this.success("Existing data cleared");
      }

      // Create users
      this.info(`Creating ${userCount} users...`);
      const users = [];

      for (let i = 1; i <= userCount; i++) {
        const user = await UserModel.objects.create({
          username: `user${i}`,
          email: `user${i}@example.com`,
          isActive: true,
        });
        users.push(user);
        this.debug(`Created user: ${user.username.get()}`, options.debug);
      }

      this.success(`Created ${userCount} users`);

      // Create tasks
      this.info(`Creating ${taskCount} tasks...`);

      for (let i = 1; i <= taskCount; i++) {
        const user = users[Math.floor(Math.random() * users.length)];
        await TaskModel.objects.create({
          title: `Task ${i}`,
          description: `Description for task ${i}`,
          status: Math.random() > 0.5 ? "open" : "closed",
          assigneeId: user.id.get(),
        });
      }

      this.success(`Created ${taskCount} tasks`);

      // Summary
      this.stdout.log("");
      this.stdout.log("┌─────────────────────────────────────┐");
      this.stdout.log("│         Seeding Complete!           │");
      this.stdout.log("└─────────────────────────────────────┘");
      this.stdout.log(`  Users:  ${userCount}`);
      this.stdout.log(`  Tasks:  ${taskCount}`);
      this.stdout.log("");

      return success();
    } catch (error) {
      this.error(`Seeding failed: ${error.message}`);
      return failure(error.message);
    }
  }
}
```

---

## Testing Commands

Commands can be tested by mocking the console output:

```ts
import { assertEquals } from "jsr:@std/assert@1";
import { MyCommand } from "./mycommand.ts";

Deno.test("MyCommand: runs successfully", async () => {
  const command = new MyCommand();

  // Mock console
  const logs: string[] = [];
  const mockConsole = {
    log: (...args: unknown[]) => logs.push(args.join(" ")),
    error: (...args: unknown[]) => logs.push(`ERROR: ${args.join(" ")}`),
    warn: (...args: unknown[]) => logs.push(`WARN: ${args.join(" ")}`),
    info: (...args: unknown[]) => logs.push(`INFO: ${args.join(" ")}`),
  };

  command.setConsole(mockConsole);

  // Run command
  const result = await command.run(["--count", "5", "testname"]);

  // Assertions
  assertEquals(result.exitCode, 0);
  assert(logs.some((l) => l.includes("Processed 5 items")));
});
```

---

## API Reference

### Types

```ts
/**
 * Options passed to command handle method
 */
interface CommandOptions {
  args: ParsedArguments; // Parsed arguments
  rawArgs: string[]; // Raw CLI arguments
  debug: boolean; // Debug mode flag
}

/**
 * Command execution result
 */
interface CommandResult {
  exitCode: number; // 0 = success
  message?: string; // Optional message
}

/**
 * Argument configuration
 */
interface ArgumentConfig {
  type?: "string" | "number" | "boolean" | "array";
  default?: unknown;
  required?: boolean;
  help?: string;
  alias?: string;
  choices?: readonly (string | number)[];
}
```

### BaseCommand

```ts
abstract class BaseCommand {
  // Required overrides
  abstract readonly name: string;
  abstract readonly help: string;
  abstract handle(options: CommandOptions): Promise<CommandResult>;

  // Optional overrides
  description?: string;
  examples?: string[];
  addArguments(parser: IArgumentParser): void;

  // Output helpers
  protected success(message: string): void;
  protected error(message: string): void;
  protected warn(message: string): void;
  protected info(message: string): void;
  protected debug(message: string, isDebug: boolean): void;

  // Console access
  protected stdout: IConsole;
  protected stderr: IConsole;
  setConsole(stdout: IConsole, stderr?: IConsole): void;

  // Execution
  run(args: string[], debug?: boolean): Promise<CommandResult>;
  printHelp(parser?: IArgumentParser): void;
}
```

### Helper Functions

```ts
// Create success result
function success(message?: string): CommandResult;

// Create failure result
function failure(message?: string, exitCode?: number): CommandResult;
```
