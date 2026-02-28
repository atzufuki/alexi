/**
 * StartApp Command for Alexi Management Commands
 *
 * Creates a new app within an Alexi project.
 *
 * @module @alexi/core/commands/startapp
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

export type AppType =
  | "cli"
  | "web"
  | "ui"
  | "desktop"
  | "mobile"
  | "library"
  | "sw";

interface AppTypeInfo {
  name: AppType;
  description: string;
  hasSettings: boolean;
}

const APP_TYPES: AppTypeInfo[] = [
  { name: "web", description: "HTTP API server", hasSettings: true },
  { name: "ui", description: "Frontend application", hasSettings: true },
  { name: "desktop", description: "Desktop app (WebUI)", hasSettings: true },
  { name: "mobile", description: "Mobile app (Capacitor)", hasSettings: true },
  { name: "cli", description: "Command-line tool", hasSettings: true },
  {
    name: "library",
    description: "Reusable library (no entrypoint)",
    hasSettings: false,
  },
  {
    name: "sw",
    description: "Service Worker (offline-first MPA)",
    hasSettings: true,
  },
];

// =============================================================================
// StartAppCommand Class
// =============================================================================

/**
 * Command for creating new apps within an Alexi project
 *
 * @example
 * ```bash
 * deno run -A manage.ts startapp myapp
 * deno run -A manage.ts startapp myapp --type web
 * deno run -A manage.ts startapp mylib --type library
 * ```
 */
export class StartAppCommand extends BaseCommand {
  readonly name = "startapp";
  readonly help = "Create a new app within the project";
  override readonly description =
    "Creates a new app with the specified name and type. " +
    "Entrypoint apps (web, ui, desktop, mobile, cli) get their own settings file.";

  override readonly examples = [
    "manage.ts startapp myapp              - Create app (interactive type selection)",
    "manage.ts startapp myapi --type web   - Create a web API app",
    "manage.ts startapp myui --type ui     - Create a UI frontend app",
    "manage.ts startapp mysw --type sw     - Create a Service Worker app",
    "manage.ts startapp mylib --type library - Create a library",
  ];

  // ===========================================================================
  // Argument Configuration
  // ===========================================================================

  override addArguments(parser: IArgumentParser): void {
    parser.addArgument("name", {
      required: true,
      help: "Name of the app to create",
    });

    parser.addArgument("--type", {
      type: "string",
      alias: "-t",
      help: "App type: cli, web, ui, desktop, mobile, library, sw",
    });

    parser.addArgument("--no-input", {
      type: "boolean",
      default: false,
      help: "Run without interactive prompts (requires --type)",
    });
  }

  // ===========================================================================
  // Command Execution
  // ===========================================================================

  async handle(options: CommandOptions): Promise<CommandResult> {
    const appName = options.args.name as string;
    const typeArg = options.args.type as string | undefined;
    const noInput = options.args["no-input"] as boolean;

    // Validate app name
    if (!this.isValidAppName(appName)) {
      this.error(
        `Invalid app name "${appName}". Use lowercase letters, numbers, and hyphens only.`,
      );
      return failure("Invalid app name");
    }

    // Check if app directory already exists
    const appDir = `src/${appName}`;
    try {
      const stat = await Deno.stat(appDir);
      if (stat.isDirectory) {
        this.error(`Directory "${appDir}" already exists.`);
        return failure("App already exists");
      }
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) {
        throw error;
      }
    }

    // Determine app type
    let appType: AppType;

    if (typeArg) {
      if (!this.isValidAppType(typeArg)) {
        this.error(`Invalid app type "${typeArg}".`);
        this.stdout.log("");
        this.stdout.log("Valid types:");
        for (const t of APP_TYPES) {
          this.stdout.log(`  ${t.name.padEnd(10)} - ${t.description}`);
        }
        return failure("Invalid app type");
      }
      appType = typeArg as AppType;
    } else if (noInput) {
      this.error("--type is required when using --no-input");
      return failure("Missing --type");
    } else {
      // Interactive mode
      appType = await this.promptForAppType();
    }

    // Create the app
    this.info(`Creating ${appType} app "${appName}"...`);
    console.log("");

    try {
      await this.createApp(appName, appType);

      console.log("");
      this.success(`App "${appName}" created successfully!`);

      const typeInfo = APP_TYPES.find((t) => t.name === appType)!;
      if (typeInfo.hasSettings) {
        console.log("");
        this.stdout.log("Next steps:");
        this.stdout.log(
          `  1. Add "${appName}" to INSTALLED_APPS in project/${appName}.settings.ts`,
        );
        this.stdout.log(
          `  2. Run: deno run -A manage.ts runserver --settings ${appName}`,
        );
      } else {
        console.log("");
        this.stdout.log("Next steps:");
        this.stdout.log(
          `  1. Add "${appName}" to INSTALLED_APPS in your settings file`,
        );
        this.stdout.log(`  2. Import and use the app in your project`);
      }

      return success();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.error(`Failed to create app: ${message}`);
      return failure(message);
    }
  }

  // ===========================================================================
  // Validation
  // ===========================================================================

  private isValidAppName(name: string): boolean {
    return /^[a-z][a-z0-9-]*$/.test(name);
  }

  private isValidAppType(type: string): boolean {
    return APP_TYPES.some((t) => t.name === type);
  }

  // ===========================================================================
  // Interactive Prompt
  // ===========================================================================

  private async promptForAppType(): Promise<AppType> {
    this.stdout.log("App type? (Use number to select)");
    this.stdout.log("");

    for (let i = 0; i < APP_TYPES.length; i++) {
      const t = APP_TYPES[i];
      this.stdout.log(`  ${i + 1}. ${t.name.padEnd(10)} - ${t.description}`);
    }

    this.stdout.log("");

    const buf = new Uint8Array(10);
    await Deno.stdin.read(buf);
    const input = new TextDecoder().decode(buf).trim();

    const num = parseInt(input, 10);
    if (num >= 1 && num <= APP_TYPES.length) {
      return APP_TYPES[num - 1].name;
    }

    // Check if they typed the name directly
    const typeByName = APP_TYPES.find((t) => t.name === input.toLowerCase());
    if (typeByName) {
      return typeByName.name;
    }

    // Default to web
    this.warn(`Invalid selection, defaulting to "web"`);
    return "web";
  }

  // ===========================================================================
  // App Creation
  // ===========================================================================

  private async createApp(name: string, type: AppType): Promise<void> {
    const appDir = `src/${name}`;

    // Create directories
    await this.createDirectories(name, appDir, type);

    // Generate files based on type
    await this.generateFiles(name, type, appDir);
  }

  private async createDirectories(
    name: string,
    appDir: string,
    type: AppType,
  ): Promise<void> {
    const dirs = [appDir, `${appDir}/tests`];

    // Type-specific directories
    if (type === "cli") {
      dirs.push(`${appDir}/commands`);
    } else if (type === "ui") {
      dirs.push(`${appDir}/templates`);
      dirs.push(`${appDir}/components`);
      dirs.push(`${appDir}/static`);
    } else if (type === "sw") {
      dirs.push(`${appDir}/static/${name}`);
      dirs.push(`${appDir}/templates/${name}`);
    }

    for (const dir of dirs) {
      await Deno.mkdir(dir, { recursive: true });
      this.stdout.log(`  Created ${dir}/`);
    }
  }

  private async generateFiles(
    name: string,
    type: AppType,
    appDir: string,
  ): Promise<void> {
    const files: Array<{ path: string; content: string }> = [];

    // Common files for all app types
    files.push({
      path: `${appDir}/app.ts`,
      content: this.generateAppTs(name, type),
    });

    files.push({
      path: `${appDir}/mod.ts`,
      content: this.generateModTs(name, type),
    });

    files.push({
      path: `${appDir}/tests/basic_test.ts`,
      content: this.generateBasicTest(name),
    });

    // Type-specific files
    switch (type) {
      case "web":
        files.push({
          path: `${appDir}/models.ts`,
          content: this.generateModelsTs(name),
        });
        files.push({
          path: `${appDir}/urls.ts`,
          content: this.generateUrlsTs(name),
        });
        files.push({
          path: `${appDir}/views.ts`,
          content: this.generateViewsTs(name),
        });
        files.push({
          path: `${appDir}/serializers.ts`,
          content: this.generateSerializersTs(name),
        });
        files.push({
          path: `${appDir}/viewsets.ts`,
          content: this.generateViewsetsTs(name),
        });
        files.push({
          path: `project/${name}.settings.ts`,
          content: this.generateWebSettings(name),
        });
        break;

      case "ui":
        files.push({
          path: `${appDir}/urls.ts`,
          content: this.generateUiUrlsTs(name),
        });
        files.push({
          path: `${appDir}/views.ts`,
          content: this.generateUiViewsTs(name),
        });
        files.push({
          path: `${appDir}/templates/base.ts`,
          content: this.generateBaseTemplate(name),
        });
        files.push({
          path: `${appDir}/components/mod.ts`,
          content: this.generateComponentsMod(name),
        });
        files.push({
          path: `${appDir}/static/index.html`,
          content: this.generateIndexHtml(name),
        });
        files.push({
          path: `project/${name}.settings.ts`,
          content: this.generateUiSettings(name),
        });
        break;

      case "desktop":
        files.push({
          path: `${appDir}/bindings.ts`,
          content: this.generateBindingsTs(name),
        });
        files.push({
          path: `${appDir}/urls.ts`,
          content: this.generateDesktopUrlsTs(name),
        });
        files.push({
          path: `project/${name}.settings.ts`,
          content: this.generateDesktopSettings(name),
        });
        break;

      case "mobile":
        files.push({
          path: `${appDir}/urls.ts`,
          content: this.generateMobileUrlsTs(name),
        });
        files.push({
          path: `${appDir}/capacitor.config.ts`,
          content: this.generateCapacitorConfig(name),
        });
        files.push({
          path: `project/${name}.settings.ts`,
          content: this.generateMobileSettings(name),
        });
        break;

      case "cli":
        files.push({
          path: `${appDir}/commands/mod.ts`,
          content: this.generateCommandsMod(name),
        });
        files.push({
          path: `${appDir}/main.ts`,
          content: this.generateCliMain(name),
        });
        files.push({
          path: `project/${name}.settings.ts`,
          content: this.generateCliSettings(name),
        });
        break;

      case "library":
        files.push({
          path: `${appDir}/models.ts`,
          content: this.generateModelsTs(name),
        });
        // No settings file for library
        break;

      case "sw":
        files.push({
          path: `${appDir}/models.ts`,
          content: this.generateModelsTs(name),
        });
        files.push({
          path: `${appDir}/views.ts`,
          content: this.generateSwViewsTs(name),
        });
        files.push({
          path: `${appDir}/urls.ts`,
          content: this.generateSwUrlsTs(name),
        });
        files.push({
          path: `${appDir}/sw.ts`,
          content: this.generateSwTs(name),
        });
        files.push({
          path: `${appDir}/static/${name}/index.html`,
          content: this.generateSwIndexHtml(name),
        });
        files.push({
          path: `${appDir}/templates/${name}/base.html`,
          content: this.generateSwBaseHtml(name),
        });
        files.push({
          path: `${appDir}/templates/${name}/index.html`,
          content: this.generateSwHomeHtml(name),
        });
        files.push({
          path: `project/${name}.settings.ts`,
          content: this.generateSwSettingsTs(name),
        });
        break;
    }

    for (const file of files) {
      // Ensure parent directory exists
      const parentDir = file.path.substring(0, file.path.lastIndexOf("/"));
      if (parentDir) {
        await Deno.mkdir(parentDir, { recursive: true });
      }
      await Deno.writeTextFile(file.path, file.content);
      this.stdout.log(`  Created ${file.path}`);
    }
  }

  // ===========================================================================
  // Template Generators
  // ===========================================================================

  private generateAppTs(name: string, type: AppType): string {
    const className = this.toPascalCase(name);
    const hasCommands = type === "cli";

    if (type === "sw") {
      return `/**
 * ${className} App Configuration
 *
 * @module ${name}/app
 */

import type { AppConfig } from "@alexi/types";

const config: AppConfig = {
  name: "${name}",
  verboseName: "${className}",
  bundle: {
    entrypoint: "./sw.ts",
    outputDir: "./static/${name}",
    outputName: "sw.js",
    options: {
      minify: false,
      sourceMaps: true,
    },
  },
  templatesDir: "src/${name}/templates",
};

export default config;
`;
    }

    return `/**
 * ${className} App Configuration
 *
 * @module ${name}/app
 */

import type { AppConfig } from "@alexi/types";

const config: AppConfig = {
  name: "${name}",
  verboseName: "${className}",${
      hasCommands ? `\n  commandsModule: "./commands/mod.ts",` : ""
    }
};

export default config;
`;
  }

  private generateModTs(name: string, type: AppType): string {
    const exports: string[] = [];

    switch (type) {
      case "web":
        exports.push('export * from "./models.ts";');
        exports.push('export * from "./views.ts";');
        exports.push('export * from "./urls.ts";');
        exports.push('export * from "./serializers.ts";');
        exports.push('export * from "./viewsets.ts";');
        break;
      case "ui":
        exports.push('export * from "./views.ts";');
        exports.push('export * from "./urls.ts";');
        break;
      case "desktop":
        exports.push('export * from "./bindings.ts";');
        exports.push('export * from "./urls.ts";');
        break;
      case "mobile":
        exports.push('export * from "./urls.ts";');
        break;
      case "cli":
        exports.push('export * from "./commands/mod.ts";');
        break;
      case "library":
        exports.push('export * from "./models.ts";');
        break;
      case "sw":
        exports.push('export * from "./models.ts";');
        exports.push('export * from "./views.ts";');
        exports.push('export * from "./urls.ts";');
        break;
    }

    return `/**
 * ${this.toPascalCase(name)} Module Exports
 *
 * @module ${name}
 */

${exports.join("\n")}
`;
  }

  private generateModelsTs(name: string): string {
    const className = this.toPascalCase(name);

    return `/**
 * ${className} Models
 *
 * @module ${name}/models
 */

import {
  AutoField,
  CharField,
  DateTimeField,
  Manager,
  Model,
} from "@alexi/db";

// Example model - replace with your own
export class ExampleModel extends Model {
  id = new AutoField({ primaryKey: true });
  name = new CharField({ maxLength: 200 });
  createdAt = new DateTimeField({ autoNowAdd: true });
  updatedAt = new DateTimeField({ autoNow: true });

  static objects = new Manager(ExampleModel);
  static meta = {
    dbTable: "${name}_examples",
    ordering: ["-createdAt"],
  };
}
`;
  }

  private generateUrlsTs(name: string): string {
    return `/**
 * ${this.toPascalCase(name)} URL Configuration
 *
 * @module ${name}/urls
 */

import { path } from "@alexi/urls";
import { homeView, healthView } from "./views.ts";

export const urlpatterns = [
  path("", homeView, { name: "home" }),
  path("api/health/", healthView, { name: "health" }),
];
`;
  }

  private generateViewsTs(name: string): string {
    return `/**
 * ${this.toPascalCase(name)} Views
 *
 * @module ${name}/views
 */

export function homeView(_request: Request): Response {
  return Response.json({
    message: "Welcome to ${name}!",
  });
}

export function healthView(_request: Request): Response {
  return Response.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}
`;
  }

  private generateSerializersTs(name: string): string {
    return `/**
 * ${this.toPascalCase(name)} Serializers
 *
 * @module ${name}/serializers
 */

import { Serializer, CharField } from "@alexi/restframework";

export class ExampleSerializer extends Serializer {
  id = new CharField({ readOnly: true });
  name = new CharField({ maxLength: 200 });
}
`;
  }

  private generateViewsetsTs(name: string): string {
    return `/**
 * ${this.toPascalCase(name)} ViewSets
 *
 * @module ${name}/viewsets
 */

import { ModelViewSet } from "@alexi/restframework";
import { ExampleModel } from "./models.ts";
import { ExampleSerializer } from "./serializers.ts";

export class ExampleViewSet extends ModelViewSet {
  model = ExampleModel;
  serializer_class = ExampleSerializer;
}
`;
  }

  private generateUiUrlsTs(name: string): string {
    return `/**
 * ${this.toPascalCase(name)} UI URL Configuration
 *
 * @module ${name}/urls
 */

import { path } from "@alexi/urls";
import { homeView } from "./views.ts";

export const urlpatterns = [
  path("", homeView, { name: "home" }),
];
`;
  }

  private generateUiViewsTs(name: string): string {
    return `/**
 * ${this.toPascalCase(name)} UI Views
 *
 * @module ${name}/views
 */

export async function homeView(_request: Request): Promise<Response> {
  // Return the SPA shell
  const html = await Deno.readTextFile("src/${name}/static/index.html");
  return new Response(html, {
    headers: { "Content-Type": "text/html" },
  });
}
`;
  }

  private generateBaseTemplate(name: string): string {
    return `/**
 * ${this.toPascalCase(name)} Base Template
 *
 * @module ${name}/templates/base
 */

import { HTMLPropsMixin } from "@html-props/core";
import { Div } from "@html-props/built-ins";

export class BaseLayout extends HTMLPropsMixin(HTMLElement) {
  render() {
    return new Div({
      content: [
        // Add your layout here
      ],
    });
  }
}

BaseLayout.define("base-layout");
`;
  }

  private generateComponentsMod(name: string): string {
    return `/**
 * ${this.toPascalCase(name)} Components
 *
 * @module ${name}/components
 */

// Export your components here
// export { MyComponent } from "./my_component.ts";
`;
  }

  private generateIndexHtml(name: string): string {
    const title = this.toPascalCase(name);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="stylesheet" href="/bundle.css">
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/bundle.js"></script>
</body>
</html>
`;
  }

  private generateBindingsTs(name: string): string {
    return `/**
 * ${this.toPascalCase(name)} Desktop Bindings
 *
 * Native functions available to the frontend via webui.call()
 *
 * @module ${name}/bindings
 */

export function getAppInfo(): Record<string, unknown> {
  return {
    name: "${name}",
    platform: Deno.build.os,
    arch: Deno.build.arch,
  };
}

export const bindings = {
  getAppInfo,
};
`;
  }

  private generateDesktopUrlsTs(name: string): string {
    return `/**
 * ${this.toPascalCase(name)} Desktop URL Configuration
 *
 * @module ${name}/urls
 */

// Desktop apps typically use the UI app's URLs
// Add any desktop-specific routes here

export const urlpatterns = [];
`;
  }

  private generateMobileUrlsTs(name: string): string {
    return `/**
 * ${this.toPascalCase(name)} Mobile URL Configuration
 *
 * @module ${name}/urls
 */

// Mobile apps typically use the UI app's URLs
// Add any mobile-specific routes here

export const urlpatterns = [];
`;
  }

  private generateCapacitorConfig(name: string): string {
    return `/**
 * ${this.toPascalCase(name)} Capacitor Configuration
 *
 * @module ${name}/capacitor.config
 */

export const capacitorConfig = {
  appId: "com.example.${name.replace(/-/g, "")}",
  appName: "${this.toPascalCase(name)}",
  webDir: "dist",
  bundledWebRuntime: false,
};

export default capacitorConfig;
`;
  }

  private generateCommandsMod(name: string): string {
    return `/**
 * ${this.toPascalCase(name)} CLI Commands
 *
 * @module ${name}/commands
 */

// Export your commands here
// export { MyCommand } from "./my_command.ts";
`;
  }

  private generateCliMain(name: string): string {
    return `#!/usr/bin/env -S deno run -A
/**
 * ${this.toPascalCase(name)} CLI Entry Point
 *
 * @module ${name}/main
 */

import { execute } from "@alexi/core";

const exitCode = await execute();
Deno.exit(exitCode);
`;
  }

  private generateWebSettings(name: string): string {
    return `/**
 * ${this.toPascalCase(name)} Web Settings
 *
 * @module project/${name}.settings
 */

import {
  loggingMiddleware,
  corsMiddleware,
  errorHandlerMiddleware,
} from "@alexi/middleware";

export const DEBUG = Deno.env.get("DEBUG") === "true";
export const DEFAULT_HOST = "0.0.0.0";
export const DEFAULT_PORT = 8000;

export const INSTALLED_APPS = [
  () => import("@alexi/staticfiles"),
  () => import("@alexi/web"),
  () => import("@alexi/db"),
  () => import("@${name}/web"),
];

export const ROOT_URLCONF = () => import("@${name}/web/urls");

export function createMiddleware() {
  return [
    loggingMiddleware(),
    corsMiddleware({ origins: ["http://localhost:8000"] }),
    errorHandlerMiddleware(),
  ];
}
`;
  }

  private generateUiSettings(name: string): string {
    return `/**
 * ${this.toPascalCase(name)} UI Settings
 *
 * @module project/${name}.settings
 */

export const DEBUG = Deno.env.get("DEBUG") === "true";
export const DEFAULT_HOST = "127.0.0.1";
export const DEFAULT_PORT = 5173;

export const INSTALLED_APPS = [
  () => import("@alexi/staticfiles"),
  () => import("@${name}/ui"),
];

export const API_URL = Deno.env.get("API_URL") ?? "http://localhost:8000/api";
export const SPA_ROOT = "./src/${name}/static";
`;
  }

  private generateDesktopSettings(name: string): string {
    return `/**
 * ${this.toPascalCase(name)} Desktop Settings
 *
 * @module project/${name}.settings
 */

export const DEBUG = Deno.env.get("DEBUG") === "true";
export const DEFAULT_HOST = "127.0.0.1";
export const DEFAULT_PORT = 51730;

export const INSTALLED_APPS = [
  () => import("@alexi/webui"),
  () => import("@${name}/desktop"),
];

export const API_URL = Deno.env.get("API_URL") ?? "http://localhost:8000/api";
export const UI_URL = Deno.env.get("UI_URL") ?? "http://127.0.0.1:5173/";

export const DESKTOP = {
  title: "${this.toPascalCase(name)}",
  width: 1200,
  height: 800,
  browser: "any" as const,
};

export const BINDINGS_MODULE = "src/${name}/bindings.ts";
`;
  }

  private generateMobileSettings(name: string): string {
    return `/**
 * ${this.toPascalCase(name)} Mobile Settings
 *
 * @module project/${name}.settings
 */

export const DEBUG = Deno.env.get("DEBUG") === "true";

export const INSTALLED_APPS = [
  () => import("@alexi/capacitor"),
  () => import("@${name}/mobile"),
];

export const API_URL = Deno.env.get("API_URL") ?? "http://localhost:8000/api";
`;
  }

  private generateCliSettings(name: string): string {
    return `/**
 * ${this.toPascalCase(name)} CLI Settings
 *
 * @module project/${name}.settings
 */

export const DEBUG = Deno.env.get("DEBUG") === "true";

export const INSTALLED_APPS = [
  () => import("@${name}/cli"),
];
`;
  }

  private generateSwViewsTs(name: string): string {
    return `/**
 * ${this.toPascalCase(name)} SW Views
 *
 * @module ${name}/views
 */

import { templateView } from "@alexi/views";

export const homeView = templateView({
  templateName: "${name}/index.html",
  context: async (_request, _params) => ({
    title: "${this.toPascalCase(name)}",
  }),
});
`;
  }

  private generateSwUrlsTs(name: string): string {
    return `/**
 * ${this.toPascalCase(name)} SW URL Configuration
 *
 * @module ${name}/urls
 */

import { path } from "@alexi/urls";
import { homeView } from "./views.ts";

export const urlpatterns = [
  path("", homeView, { name: "home" }),
];
`;
  }

  private generateSwTs(name: string): string {
    return `/**
 * ${this.toPascalCase(name)} Service Worker Entry Point
 *
 * @module ${name}/sw
 */

import { Application, setup } from "@alexi/core";
import { IndexedDBBackend } from "@alexi/db/backends/indexeddb";
import { urlpatterns } from "./urls.ts";

declare const self: ServiceWorkerGlobalScope;

const app = new Application({ urls: urlpatterns });

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const backend = new IndexedDBBackend({ name: "${name}" });
      await setup({ DATABASES: { default: backend } });
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/static/")) return;
  event.respondWith(app.handler(event.request));
});
`;
  }

  private generateSwIndexHtml(name: string): string {
    const title = this.toPascalCase(name);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body>
  <div id="content"></div>
  <script src="https://unpkg.com/htmx.org@2" defer></script>
  <script>
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/static/${name}/sw.js").then((reg) => {
        function render() {
          htmx.ajax("GET", location.href, { target: "#content", swap: "innerHTML" });
        }
        if (navigator.serviceWorker.controller) {
          render();
        } else {
          const worker = reg.installing || reg.waiting;
          if (worker) {
            worker.addEventListener("statechange", function () {
              if (this.state === "activated") render();
            });
          }
        }
      });
    }
  </script>
</body>
</html>
`;
  }

  private generateSwBaseHtml(name: string): string {
    const title = this.toPascalCase(name);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{% block title %}${title}{% endblock %}</title>
</head>
<body>
  <main hx-boost="true">
    {% block content %}{% endblock %}
  </main>
</body>
</html>
`;
  }

  private generateSwHomeHtml(name: string): string {
    const title = this.toPascalCase(name);

    return `{% extends "${name}/base.html" %}

{% block title %}{{ title }}{% endblock %}

{% block content %}
<h1>Welcome to ${title}</h1>
<p>This page is rendered by a Service Worker using Alexi.</p>
{% endblock %}
`;
  }

  private generateSwSettingsTs(name: string): string {
    return `/**
 * ${this.toPascalCase(name)} SW Settings
 *
 * @module project/${name}.settings
 */

export const DEBUG = Deno.env.get("DEBUG") === "true";
export const DEFAULT_HOST = "0.0.0.0";
export const DEFAULT_PORT = 8000;

export const INSTALLED_APPS = [
  () => import("@alexi/staticfiles"),
  () => import("@alexi/web"),
  () => import("@${name}/sw"),
];

export const ROOT_URLCONF = () => import("@${name}/sw/urls");
`;
  }

  private generateBasicTest(name: string): string {
    return `/**
 * Basic tests for ${name}
 */

import { assertEquals } from "jsr:@std/assert@1";

Deno.test("${name}: basic test", () => {
  assertEquals(1 + 1, 2);
});
`;
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  private toPascalCase(name: string): string {
    return name
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join("");
  }
}
