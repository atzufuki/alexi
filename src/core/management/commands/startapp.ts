/**
 * StartApp Command for Alexi Management Commands
 *
 * Creates a new unified app within an Alexi project.
 * Every app gets the full structure — no app types.
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
// StartAppCommand Class
// =============================================================================

/**
 * Command for creating new apps within an Alexi project.
 *
 * Every app is a single unified directory following Django conventions:
 * models, views, URLs, serializers, viewsets, migrations, assets, workers,
 * static files, and tests — all in one place.
 *
 * @example
 * ```bash
 * deno run -A manage.ts startapp posts
 * deno run -A manage.ts startapp blog
 * ```
 */
export class StartAppCommand extends BaseCommand {
  readonly name = "startapp";
  readonly help = "Create a new app within the project";
  override readonly description =
    "Creates a new unified app with models, views, URLs, serializers, " +
    "viewsets, assets (frontend), workers (Service Worker), static files, and tests.";

  override readonly examples = [
    "manage.ts startapp posts       - Create a new app called 'posts'",
    "manage.ts startapp blog        - Create a new app called 'blog'",
  ];

  // ===========================================================================
  // Argument Configuration
  // ===========================================================================

  override addArguments(parser: IArgumentParser): void {
    parser.addArgument("name", {
      required: true,
      help: "Name of the app to create",
    });
  }

  // ===========================================================================
  // Command Execution
  // ===========================================================================

  async handle(options: CommandOptions): Promise<CommandResult> {
    const appName = options.args.name as string;

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

    // Create the app
    this.info(`Creating app "${appName}"...`);
    console.log("");

    try {
      await this.createApp(appName);

      console.log("");
      this.success(`App "${appName}" created successfully!`);

      console.log("");
      this.stdout.log("Next steps:");
      this.stdout.log(
        `  1. Add import map entries to deno.jsonc:`,
      );
      this.stdout.log(
        `     "@${appName}/": "./src/${appName}/"`,
      );
      this.stdout.log(
        `     "@${appName}/workers": "./src/${appName}/workers/${appName}/mod.ts"`,
      );
      this.stdout.log(
        `     "@${appName}/workers/urls": "./src/${appName}/workers/${appName}/urls.ts"`,
      );
      this.stdout.log(
        `     "@${appName}/workers/": "./src/${appName}/workers/${appName}/"`,
      );
      this.stdout.log(
        `  2. Add to INSTALLED_APPS in your settings:`,
      );
      this.stdout.log(
        `     () => import("@${appName}/mod.ts"),     // server app`,
      );
      this.stdout.log(
        `     () => import("@${appName}/workers"),    // worker app (for bundling)`,
      );
      this.stdout.log(
        `  3. Include URLs in ROOT_URLCONF`,
      );

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

  // ===========================================================================
  // App Creation
  // ===========================================================================

  private async createApp(name: string): Promise<void> {
    const appDir = `src/${name}`;

    // Create directories
    await this.createDirectories(name, appDir);

    // Generate files
    await this.generateFiles(name, appDir);
  }

  private async createDirectories(
    name: string,
    appDir: string,
  ): Promise<void> {
    const dirs = [
      appDir,
      // Server-side
      `${appDir}/migrations`,
      `${appDir}/tests`,
      // Frontend assets
      `${appDir}/assets/${name}`,
      `${appDir}/assets/${name}/components`,
      // Service Worker
      `${appDir}/workers/${name}`,
      `${appDir}/workers/${name}/templates/${name}`,
      // Static output
      `${appDir}/static/${name}`,
    ];

    for (const dir of dirs) {
      await Deno.mkdir(dir, { recursive: true });
      this.stdout.log(`  Created ${dir}/`);
    }
  }

  private async generateFiles(
    name: string,
    appDir: string,
  ): Promise<void> {
    const files: Array<{ path: string; content: string }> = [
      // ========================================================================
      // Root app files (server-side, Deno context)
      // ========================================================================
      {
        path: `${appDir}/app.ts`,
        content: this.generateAppTs(name),
      },
      {
        path: `${appDir}/mod.ts`,
        content: this.generateModTs(name),
      },
      {
        path: `${appDir}/models.ts`,
        content: this.generateModelsTs(name),
      },
      {
        path: `${appDir}/serializers.ts`,
        content: this.generateSerializersTs(name),
      },
      {
        path: `${appDir}/viewsets.ts`,
        content: this.generateViewsetsTs(name),
      },
      {
        path: `${appDir}/views.ts`,
        content: this.generateViewsTs(name),
      },
      {
        path: `${appDir}/urls.ts`,
        content: this.generateUrlsTs(name),
      },
      {
        path: `${appDir}/migrations/0001_init.ts`,
        content: this.generateInitMigration(name),
      },
      {
        path: `${appDir}/tests/basic_test.ts`,
        content: this.generateBasicTest(name),
      },

      // ========================================================================
      // Frontend assets (bundled → static/<app>/<app>.js)
      // ========================================================================
      {
        path: `${appDir}/assets/${name}/mod.ts`,
        content: this.generateAssetModTs(name),
      },

      // ========================================================================
      // Service Worker (bundled → static/<app>/worker.js)
      // ========================================================================
      {
        path: `${appDir}/workers/${name}/app.ts`,
        content: this.generateWorkerAppTs(name),
      },
      {
        path: `${appDir}/workers/${name}/mod.ts`,
        content: this.generateWorkerModTs(name),
      },
      {
        path: `${appDir}/workers/${name}/models.ts`,
        content: this.generateWorkerModelsTs(name),
      },
      {
        path: `${appDir}/workers/${name}/endpoints.ts`,
        content: this.generateWorkerEndpointsTs(name),
      },
      {
        path: `${appDir}/workers/${name}/settings.ts`,
        content: this.generateWorkerSettingsTs(name),
      },
      {
        path: `${appDir}/workers/${name}/urls.ts`,
        content: this.generateWorkerUrlsTs(name),
      },
      {
        path: `${appDir}/workers/${name}/views.ts`,
        content: this.generateWorkerViewsTs(name),
      },
      {
        path: `${appDir}/workers/${name}/templates/${name}/base.html`,
        content: this.generateWorkerBaseHtml(name),
      },
      {
        path: `${appDir}/workers/${name}/templates/${name}/index.html`,
        content: this.generateWorkerIndexHtml(name),
      },

      // ========================================================================
      // Static output (served by staticFilesMiddleware)
      // ========================================================================
      {
        path: `${appDir}/static/${name}/index.html`,
        content: this.generateStaticIndexHtml(name),
      },
    ];

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
  // Template Generators — Root (Server-side)
  // ===========================================================================

  private generateAppTs(name: string): string {
    const className = this.toPascalCase(name);

    return `/**
 * ${className} App Configuration
 *
 * @module ${name}/app
 */

import type { AppConfig } from "@alexi/types";

const config: AppConfig = {
  name: "${name}",
  verboseName: "${className}",
  staticDir: "static",
};

export default config;
`;
  }

  private generateModTs(name: string): string {
    return `/**
 * ${this.toPascalCase(name)} Module Exports
 *
 * @module ${name}
 */

export * from "./models.ts";
export * from "./views.ts";
export * from "./urls.ts";
export * from "./serializers.ts";
export * from "./viewsets.ts";
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

  private generateSerializersTs(name: string): string {
    return `/**
 * ${this.toPascalCase(name)} Serializers
 *
 * @module ${name}/serializers
 */

import { CharField, Serializer } from "@alexi/restframework";

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

  private generateUrlsTs(name: string): string {
    return `/**
 * ${this.toPascalCase(name)} URL Configuration
 *
 * @module ${name}/urls
 */

import { path } from "@alexi/urls";
import { healthView, homeView } from "./views.ts";

export const urlpatterns = [
  path("", homeView, { name: "home" }),
  path("api/health/", healthView, { name: "health" }),
];
`;
  }

  private generateInitMigration(name: string): string {
    return `/**
 * ${this.toPascalCase(name)} Initial Migration
 *
 * @module ${name}/migrations/0001_init
 */

// Placeholder for initial migration
// Migrations will be auto-generated by makemigrations
export const migration = {
  name: "0001_init",
  app: "${name}",
  operations: [],
};
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
  // Template Generators — Assets (Frontend)
  // ===========================================================================

  private generateAssetModTs(name: string): string {
    return `/**
 * ${this.toPascalCase(name)} Frontend Entry Point
 *
 * This file is bundled by @alexi/staticfiles into static/${name}/${name}.js.
 * Import your Web Components and client-side code here.
 *
 * @module ${name}/assets/${name}/mod
 */

// Import and register components
// import "./components/my_component.ts";

console.log("${this.toPascalCase(name)} frontend loaded");
`;
  }

  // ===========================================================================
  // Template Generators — Workers (Service Worker)
  // ===========================================================================

  private generateWorkerAppTs(name: string): string {
    const className = this.toPascalCase(name);

    return `/**
 * ${className} Worker App Configuration
 *
 * This is itself a valid Alexi app listed in INSTALLED_APPS
 * so the bundler can discover and bundle it.
 *
 * @module ${name}/workers/${name}/app
 */

import type { AppConfig } from "@alexi/types";

const config: AppConfig = {
  name: "${name}-worker",
  verboseName: "${className} Worker",
  staticfiles: [
    {
      entrypoint: "./workers/${name}/mod.ts",
      outputFile: "./static/${name}/worker.js",
      options: { minify: false, sourceMaps: true },
    },
    {
      entrypoint: "./assets/${name}/mod.ts",
      outputFile: "./static/${name}/${name}.js",
      options: { minify: false, sourceMaps: true },
    },
  ],
  staticDir: "static",
  templatesDir: "src/${name}/workers/${name}/templates",
};

export default config;
`;
  }

  private generateWorkerModTs(name: string): string {
    return `/**
 * ${this.toPascalCase(name)} Worker Entry Point
 *
 * Service Worker entry point — bundled into static/${name}/worker.js.
 * Runs in the browser's Service Worker context, never on the Deno server.
 *
 * Analogous to Django's wsgi.py / asgi.py — a thin shell that calls
 * getWorkerApplication(settings) and wires it to the SW lifecycle events.
 *
 * @module ${name}/workers/${name}/mod
 */

import { getWorkerApplication } from "@alexi/core";
import * as settings from "./settings.ts";

declare const self: ServiceWorkerGlobalScope;

let app: Awaited<ReturnType<typeof getWorkerApplication>>;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      try {
        app = await getWorkerApplication(settings);
      } catch (error) {
        console.error("[SW] install failed:", error);
        throw error;
      }
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

  private generateWorkerModelsTs(name: string): string {
    return `/**
 * ${this.toPascalCase(name)} Worker Models
 *
 * Client-side ORM models (IndexedDB / REST backends).
 *
 * @module ${name}/workers/${name}/models
 */

// Re-export server models that should be available in the browser
// import { ExampleModel } from "../../models.ts";
// export { ExampleModel };

// Or define browser-only models here
`;
  }

  private generateWorkerEndpointsTs(name: string): string {
    return `/**
 * ${this.toPascalCase(name)} REST Endpoints
 *
 * Declarative REST API endpoint definitions used by the REST backend.
 *
 * @module ${name}/workers/${name}/endpoints
 */

// import { DetailAction, ListAction, ModelEndpoint, SingletonQuery } from "@alexi/db/backends/rest";
// import { ExampleModel } from "./models.ts";

// Example endpoint:
// class ExampleEndpoint extends ModelEndpoint {
//   model = ExampleModel;
//   path = "/examples/";
// }
`;
  }

  private generateWorkerSettingsTs(name: string): string {
    return `/**
 * ${this.toPascalCase(name)} Worker Settings
 *
 * Client-side DATABASES config for the Service Worker context.
 *
 * @module ${name}/workers/${name}/settings
 */

import { IndexedDBBackend } from "@alexi/db/backends/indexeddb";
// import { RestBackend } from "@alexi/db/backends/rest";

export const DATABASES = {
  default: new IndexedDBBackend({ name: "${name}" }),
  // rest: new RestBackend({ apiUrl: "http://localhost:8000/api" }),
};
`;
  }

  private generateWorkerUrlsTs(name: string): string {
    return `/**
 * ${this.toPascalCase(name)} Worker URL Configuration
 *
 * URL patterns for the Service Worker context.
 *
 * @module ${name}/workers/${name}/urls
 */

import { path } from "@alexi/urls";
import { homeView } from "./views.ts";

export const urlpatterns = [
  path("", homeView, { name: "home" }),
];
`;
  }

  private generateWorkerViewsTs(name: string): string {
    return `/**
 * ${this.toPascalCase(name)} Worker Views
 *
 * Views rendered inside the Service Worker.
 *
 * @module ${name}/workers/${name}/views
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

  private generateWorkerBaseHtml(name: string): string {
    const title = this.toPascalCase(name);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{% block title %}${title}{% endblock %}</title>
  <script type="module" src="/static/${name}/${name}.js"></script>
</head>
<body>
  <main hx-boost="true">
    {% block content %}{% endblock %}
  </main>
</body>
</html>
`;
  }

  private generateWorkerIndexHtml(name: string): string {
    const title = this.toPascalCase(name);

    return `{% extends "${name}/base.html" %}

{% block title %}{{ title }}{% endblock %}

{% block content %}
<h1>Welcome to ${title}</h1>
<p>This page is rendered by a Service Worker using Alexi.</p>
{% endblock %}
`;
  }

  // ===========================================================================
  // Template Generators — Static
  // ===========================================================================

  private generateStaticIndexHtml(name: string): string {
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
    function render() {
      if (typeof htmx !== "undefined") {
        htmx.ajax("GET", "/", { target: "#content", swap: "innerHTML" });
      } else {
        document.addEventListener("DOMContentLoaded", function () {
          htmx.ajax("GET", "/", { target: "#content", swap: "innerHTML" });
        });
      }
    }
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/static/${name}/worker.js", { type: "module" }).then((reg) => {
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
