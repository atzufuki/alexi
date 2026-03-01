/**
 * Template for alexi-core SKILL.md
 *
 * Generates the Agent Skills file for @alexi/core management commands and application setup.
 */

export function generateAlexiCoreSkillMd(): string {
  return `---
name: alexi-core
description: Use when working with @alexi/core - creating management commands, configuring applications, project settings, and Django-style app structure in Deno.
license: MIT
metadata:
  author: atzufuki
  version: "1.0"
  package: "@alexi/core"
---

# Alexi Core

## Overview

\`@alexi/core\` provides the foundation for Alexi applications, including management
commands, application configuration, and settings handling. It mirrors Django's
\`django.core\` module patterns.

## When to Use This Skill

- Creating custom management commands
- Configuring application settings
- Setting up INSTALLED_APPS and ROOT_URLCONF
- Understanding Alexi project structure
- Running management commands (runserver, test, etc.)

## Installation

\`\`\`bash
deno add jsr:@alexi/core
\`\`\`

## Management Commands

### Running Commands

\`\`\`bash
# Start development server
deno task dev

# Or run directly
deno run -A --unstable-kv manage.ts runserver --settings web

# Other common commands
deno run -A --unstable-kv manage.ts help
deno run -A --unstable-kv manage.ts test
deno run -A --unstable-kv manage.ts createsuperuser
deno run -A --unstable-kv manage.ts collectstatic
deno run -A --unstable-kv manage.ts flush
\`\`\`

### Built-in Commands

| Command           | Description                     |
|-------------------|---------------------------------|
| \`help\`            | Show available commands         |
| \`runserver\`       | Start HTTP server               |
| \`test\`            | Run tests                       |
| \`createsuperuser\` | Create admin user               |
| \`bundle\`          | Bundle frontend apps            |
| \`collectstatic\`   | Collect static files            |
| \`flush\`           | Clear database                  |
| \`startproject\`    | Create new project              |
| \`startapp\`        | Create new app                  |

### Creating Custom Commands

Create a command class extending \`BaseCommand\`:

\`\`\`typescript
// src/myapp-web/commands/sync_data.ts
import { BaseCommand, failure, success } from "@alexi/core/management";
import type { ArgumentParser, CommandOptions, CommandResult } from "@alexi/core/management";

export class SyncDataCommand extends BaseCommand {
  readonly name = "syncdata";
  readonly help = "Sync data from external API";

  override defineOptions(parser: ArgumentParser): void {
    parser.add_argument("--source", {
      type: "str",
      help: "Data source URL",
      required: true,
    });
    parser.add_argument("--dry-run", {
      action: "store_true",
      help: "Preview changes without applying",
    });
    parser.add_argument("--limit", {
      type: "int",
      default: 100,
      help: "Maximum records to sync",
    });
  }

  async handle(options: CommandOptions): Promise<CommandResult> {
    const source = options.source as string;
    const dryRun = options["dry-run"] as boolean;
    const limit = options.limit as number;

    this.info(\`Syncing from \${source} (limit: \${limit})\`);

    if (dryRun) {
      this.warning("Dry run mode - no changes will be made");
    }

    try {
      const response = await fetch(source);
      const data = await response.json();
      
      let synced = 0;
      for (const item of data.slice(0, limit)) {
        if (!dryRun) {
          await MyModel.objects.updateOrCreate(
            { externalId: item.id },
            { ...item }
          );
        }
        synced++;
      }

      this.success(\`Synced \${synced} records\`);
      return success();
    } catch (error) {
      this.error(\`Sync failed: \${error.message}\`);
      return failure(error.message);
    }
  }
}
\`\`\`

### Registering Commands

Commands are auto-discovered from app's \`commands/\` directory, or register in AppConfig:

\`\`\`typescript
// src/myapp-web/app.ts
import { AppConfig } from "@alexi/core/management";
import { SyncDataCommand } from "./commands/sync_data.ts";

export default class MyAppConfig extends AppConfig {
  name = "myapp";
  
  override get commands() {
    return [SyncDataCommand];
  }
}
\`\`\`

### Command Output Methods

\`\`\`typescript
// Available in handle() method
this.info("Informational message");     // Blue
this.success("Success message");         // Green
this.warning("Warning message");         // Yellow
this.error("Error message");             // Red
this.debug("Debug message");             // Gray (only with --verbose)
\`\`\`

## Application Configuration

### AppConfig

Each app module exports an AppConfig:

\`\`\`typescript
// src/myapp-web/app.ts
import { AppConfig } from "@alexi/core/management";

export default class MyAppConfig extends AppConfig {
  name = "myapp";
  
  override get commands() {
    return [SyncDataCommand];
  }
}
}
\`\`\`

### mod.ts Entry Point

Each app needs a mod.ts that exports the AppConfig:

\`\`\`typescript
// src/myapp-web/mod.ts
export { default } from "./app.ts";
export * from "./models.ts";
export * from "./views.ts";
\`\`\`

## Settings Configuration

### Project Settings Structure

\`\`\`
project/
├── settings.ts           # Shared settings
├── web.settings.ts       # Web server settings
├── ui.settings.ts        # Frontend settings
└── desktop.settings.ts   # Desktop app settings
\`\`\`

### Web Settings Example

\`\`\`typescript
// project/web.settings.ts
export const DEBUG = Deno.env.get("DEBUG") === "true";
export const SECRET_KEY = Deno.env.get("SECRET_KEY") ?? "dev-secret-change-me";

export const DEFAULT_HOST = "0.0.0.0";
export const DEFAULT_PORT = 8000;

// INSTALLED_APPS - import functions for each app
export const INSTALLED_APPS = [
  () => import("@alexi/staticfiles"),
  () => import("@alexi/web"),
  () => import("@alexi/db"),
  () => import("@alexi/auth"),
  () => import("@alexi/admin"),
  () => import("@myapp-web"),  // Your app
];

// ROOT_URLCONF - import function for URL patterns
export const ROOT_URLCONF = () => import("@myapp-web/urls");

// Database configuration
export const DATABASE = {
  engine: "denokv" as const,
  name: "myapp",
  path: "./data/myapp.db",
};

// Middleware stack
export const MIDDLEWARE = [
  "corsMiddleware",
  "loggingMiddleware",
  "errorHandlerMiddleware",
];
\`\`\`

### Why Import Functions?

Import functions ensure imports happen in the user's module context where the
import map is defined:

\`\`\`typescript
// ✅ Correct - import function
export const INSTALLED_APPS = [
  () => import("@alexi/web"),
  () => import("@myapp-web"),
];

// ❌ Wrong - string paths (won't work)
export const INSTALLED_APPS = [
  "@alexi/web",
  "@myapp-web",
];
\`\`\`

## manage.ts Entry Point

\`\`\`typescript
#!/usr/bin/env -S deno run -A --unstable-kv
import { ManagementUtility } from "@alexi/core/management";

const utility = new ManagementUtility(Deno.args);
await utility.execute();
\`\`\`

## Project Structure

\`\`\`
my-project/
├── manage.ts                 # Management entry point
├── deno.jsonc                # Workspace config with import map
├── project/
│   ├── settings.ts           # Shared settings
│   ├── web.settings.ts       # Web server settings
│   ├── ui.settings.ts        # UI settings
│   └── desktop.settings.ts   # Desktop settings
└── src/
    ├── myproject-web/        # Backend app
    │   ├── app.ts            # AppConfig
    │   ├── mod.ts            # Module exports
    │   ├── models.ts         # Database models
    │   ├── serializers.ts    # REST serializers
    │   ├── viewsets.ts       # ViewSets
    │   ├── urls.ts           # URL patterns
    │   └── commands/         # Custom commands
    ├── myproject-ui/         # Frontend app
    └── myproject-desktop/    # Desktop app
\`\`\`

## deno.jsonc Configuration

\`\`\`jsonc
{
  "name": "@myproject",
  "tasks": {
    "dev": "deno run -A --unstable-kv manage.ts runserver --settings web",
    "test": "deno run -A --unstable-kv manage.ts test",
    "check": "deno check manage.ts"
  },
  "imports": {
    "@alexi/core": "jsr:@alexi/core@^0.19",
    "@alexi/db": "jsr:@alexi/db@^0.19",
    "@alexi/web": "jsr:@alexi/web@^0.19",
    "@myapp-web": "./src/myproject-web/mod.ts",
    "@myapp-web/": "./src/myproject-web/"
  }
}
\`\`\`

## Common Mistakes

**Not using import functions in INSTALLED_APPS**

\`\`\`typescript
// ❌ Wrong - strings don't work
export const INSTALLED_APPS = ["@alexi/web", "@myapp-web"];

// ✅ Correct - import functions
export const INSTALLED_APPS = [
  () => import("@alexi/web"),
  () => import("@myapp-web"),
];
\`\`\`

**Forgetting required Deno flags**

\`\`\`bash
# ❌ Missing flags
deno run manage.ts runserver

# ✅ Required flags for full functionality
deno run -A --unstable-kv manage.ts runserver
\`\`\`

**Not exporting AppConfig as default**

\`\`\`typescript
// ❌ Wrong - named export
export class MyAppConfig extends AppConfig { }

// ✅ Correct - default export
export default class MyAppConfig extends AppConfig { }
\`\`\`

## Import Reference

\`\`\`typescript
// Application & commands (server-only)
import { Application, AppConfig, ManagementUtility } from "@alexi/core/management";

// Commands
import { BaseCommand, failure, success } from "@alexi/core/management";
import type { ArgumentParser, CommandOptions, CommandResult } from "@alexi/core/management";

// Database setup (universal)
import { setup } from "@alexi/core";
\`\`\`
`;
}
