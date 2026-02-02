/**
 * Alexi Web RunServer Command
 *
 * Django-style HTTP server with REST API, authentication, and admin panel.
 * This is the main backend server that provides:
 * - REST API endpoints (/api/...)
 * - Admin panel (/admin/...)
 * - Static file serving
 * - SPA fallback
 *
 * Usage:
 *   deno task dev:web
 *   deno run -A manage.ts runserver --settings web
 *
 * @module @alexi/web/commands/runserver
 */

import { BaseCommand, failure, success } from "@alexi/core";
import type { CommandOptions, CommandResult, IArgumentParser } from "@alexi/core";
import { Application } from "@alexi/core";
import { setup } from "@alexi/db";
import { DenoKVBackend } from "@alexi/db/backends/denokv";
import { path } from "@alexi/urls";

// =============================================================================
// Types
// =============================================================================

interface ServerConfig {
  port: number;
  host: string;
  debug: boolean;
  createHmrResponse?: () => Response;
}

// =============================================================================
// RunServerCommand
// =============================================================================

/**
 * Web RunServer Command
 *
 * Django-style HTTP server with REST API, admin panel, and static file serving.
 */
export class RunServerCommand extends BaseCommand {
  readonly name = "runserver";
  readonly help = "Start web server (API + Admin)";
  readonly description = "Starts a Django-style web server that provides REST API, " +
    "admin panel, static file serving, and SPA fallback. " +
    "Automatically bundles TypeScript frontends and supports HMR.";

  readonly examples = [
    "manage.ts runserver --settings web         - Start web server",
    "manage.ts runserver --settings web -p 3000 - Start on port 3000",
    "manage.ts runserver --settings web --no-bundle - Skip bundling",
  ];

  private serverAbortController: AbortController | null = null;
  private bundler: unknown = null;
  private backendWatcher: Deno.FsWatcher | null = null;
  private projectRoot: string = Deno.cwd();

  // ==========================================================================
  // Arguments
  // ==========================================================================

  addArguments(parser: IArgumentParser): void {
    parser.addArgument("--settings", {
      type: "string",
      alias: "-s",
      help: "Settings module (e.g., 'web')",
      required: true,
    });

    parser.addArgument("--port", {
      type: "number",
      alias: "-p",
      help: "Port to listen on",
    });

    parser.addArgument("--host", {
      type: "string",
      alias: "-H",
      help: "Host to bind to",
    });

    parser.addArgument("--no-reload", {
      type: "boolean",
      default: false,
      help: "Disable auto-reload",
    });

    parser.addArgument("--no-bundle", {
      type: "boolean",
      default: false,
      help: "Skip frontend bundling",
    });
  }

  // ==========================================================================
  // Main Handler
  // ==========================================================================

  async handle(options: CommandOptions): Promise<CommandResult> {
    const settingsArg = options.args.settings as string;
    const portArg = options.args.port as number | undefined;
    const hostArg = options.args.host as string | undefined;
    const noReload = options.args["no-reload"] as boolean;
    const noBundle = options.args["no-bundle"] as boolean;

    try {
      // Load settings
      this.info(`Loading settings: ${settingsArg}.settings.ts`);
      const settingsPath = `${this.projectRoot}/project/${settingsArg}.settings.ts`;
      const settings = await import(`file://${settingsPath}`);

      const port = portArg ?? settings.DEFAULT_PORT ?? 8000;
      const host = hostArg ?? settings.DEFAULT_HOST ?? "0.0.0.0";
      // Dev server is always in debug mode (no-cache headers, detailed logs, etc.)
      const debug = true;

      // Validate port
      if (port < 1 || port > 65535) {
        this.error(`Invalid port: ${port}`);
        return failure("Invalid port");
      }

      // Initialize database
      if (settings.DATABASE) {
        const backend = new DenoKVBackend({
          name: settings.DATABASE.name,
          path: settings.DATABASE.path,
        });
        await backend.connect();
        setup({ backend });
        this.success("Database initialized (denokv)");
      }

      // Bundle if needed
      let createHmrResponse: (() => Response) | undefined;
      if (!noBundle) {
        try {
          const { BundleCommand } = await import("@alexi/staticfiles/commands");
          this.bundler = new BundleCommand();
          (this.bundler as BaseCommand).setConsole(this.stdout, this.stderr);

          this.info("Bundling frontends...");

          if (noReload) {
            await (this.bundler as {
              run: (args: string[], debug: boolean) => Promise<unknown>;
            }).run([], debug);
          } else {
            await (this.bundler as {
              bundleAndWatch: (
                opts: { debug: boolean },
              ) => Promise<{ success: boolean }>;
            }).bundleAndWatch({ debug });
          }

          createHmrResponse = () =>
            (this.bundler as { createHmrResponse: () => Response })
              .createHmrResponse();
        } catch {
          // Bundle command not available or failed
        }
      }

      // Print banner
      this.printBanner(host, port, debug, !noReload);

      // Build server config
      const serverConfig: ServerConfig = {
        port,
        host,
        debug,
        createHmrResponse,
      };

      // Setup signal handlers
      this.setupSignalHandlers();

      // Start server
      await this.startServer(settings, serverConfig);

      // Start file watcher
      if (!noReload) {
        this.startBackendWatcher(settings, serverConfig);
      }

      // Keep alive
      await new Promise(() => {});

      return success();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.error(`Server startup failed: ${message}`);
      return failure(message);
    }
  }

  // ==========================================================================
  // Server
  // ==========================================================================

  private async startServer(
    settings: Record<string, unknown>,
    config: ServerConfig,
  ): Promise<void> {
    this.serverAbortController = new AbortController();

    // Load URL patterns
    const rootUrlconf = settings.ROOT_URLCONF as string;
    const appPaths = settings.APP_PATHS as Record<string, string>;
    const appPath = appPaths[rootUrlconf];

    let urlpatterns: unknown[] = [];
    if (appPath) {
      try {
        const urlsPath = `${this.projectRoot}/${appPath}/urls.ts`;
        const urlsModule = await import(`file://${urlsPath}`);
        urlpatterns = urlsModule.urlpatterns ?? urlsModule.default ?? [];
        this.success(`Loaded URL patterns from ${rootUrlconf}/urls.ts`);
      } catch (error) {
        this.warn(`Could not load URL patterns: ${error}`);
      }
    }

    // Add HMR endpoint
    if (config.createHmrResponse) {
      urlpatterns = [
        path("hmr", () => config.createHmrResponse!(), {
          name: "hmr",
          methods: ["GET"],
        }),
        ...urlpatterns,
      ];
    }

    // Create middleware
    let middleware: unknown[] = [];
    const createMiddleware = settings.createMiddleware as
      | ((opts: {
        debug: boolean;
        installedApps: string[];
        appPaths: Record<string, string>;
      }) => unknown[])
      | undefined;

    if (createMiddleware) {
      middleware = createMiddleware({
        debug: config.debug,
        installedApps: settings.INSTALLED_APPS as string[],
        appPaths: settings.APP_PATHS as Record<string, string>,
      });
    }

    // Create application
    const app = new Application({
      urls: urlpatterns,
      middleware,
      debug: config.debug,
    });

    // Log configuration
    console.log("");
    console.log(`URL Configuration (${rootUrlconf}/urls.ts):`);
    console.log(
      `  Installed apps: ${(settings.INSTALLED_APPS as string[]).join(", ")}`,
    );
    console.log("");

    // Start server
    app.serve({
      port: config.port,
      hostname: config.host,
      signal: this.serverAbortController.signal,
    }).catch((err) => {
      if (err.name !== "AbortError") {
        console.error("Server error:", err);
      }
    });
  }

  // ==========================================================================
  // File Watcher
  // ==========================================================================

  private startBackendWatcher(
    settings: Record<string, unknown>,
    _serverConfig: ServerConfig,
  ): void {
    const watchDirs: string[] = [];
    const installedApps = settings.INSTALLED_APPS as string[];
    const appPaths = settings.APP_PATHS as Record<string, string>;

    // Frontend apps are handled by bundler HMR, not backend watcher
    const frontendApps = ["comachine-ui"];

    for (const appName of installedApps) {
      // Skip frontend apps - they use bundler HMR
      if (frontendApps.includes(appName)) continue;

      const appPath = appPaths[appName];
      if (!appPath) continue;

      const appDir = appPath.startsWith("./") ? `${this.projectRoot}/${appPath.slice(2)}` : appPath;

      try {
        const stat = Deno.statSync(appDir);
        if (stat.isDirectory) {
          watchDirs.push(appDir);
        }
      } catch {
        // Directory doesn't exist
      }
    }

    if (watchDirs.length === 0) return;

    this.backendWatcher = Deno.watchFs(watchDirs, { recursive: true });

    (async () => {
      if (!this.backendWatcher) return;

      for await (const event of this.backendWatcher) {
        const isBackendChange = event.paths.some((p) => {
          const isTs = p.endsWith(".ts");
          const isBundle = p.includes("/bundle") || p.includes("\\bundle");
          const isStatic = p.includes("/static/") || p.includes("\\static\\");
          return isTs && !isBundle && !isStatic;
        });

        if (isBackendChange && event.kind === "modify") {
          this.info("\n🔄 Backend change detected...");
          // Could restart server here if needed
        }
      }
    })();
  }

  // ==========================================================================
  // Signal Handlers
  // ==========================================================================

  private setupSignalHandlers(): void {
    let cleanupCalled = false;

    const cleanup = () => {
      if (cleanupCalled) return;
      cleanupCalled = true;

      this.info("\nShutting down server...");

      if (this.bundler) {
        try {
          (this.bundler as { stopWatching: () => void }).stopWatching();
        } catch {
          // Ignore
        }
        this.bundler = null;
      }

      if (this.backendWatcher) {
        this.backendWatcher.close();
        this.backendWatcher = null;
      }

      if (this.serverAbortController) {
        this.serverAbortController.abort();
        this.serverAbortController = null;
      }

      this.success("Server stopped.");
      Deno.exit(0);
    };

    try {
      Deno.addSignalListener("SIGINT", cleanup);
      Deno.addSignalListener("SIGTERM", cleanup);
    } catch {
      // Signal listeners not available
    }
  }

  // ==========================================================================
  // UI
  // ==========================================================================

  private printBanner(
    host: string,
    port: number,
    debug: boolean,
    reload: boolean,
  ): void {
    const lines = [
      "",
      "┌─────────────────────────────────────────────┐",
      "│       Alexi Web Development Server          │",
      "└─────────────────────────────────────────────┘",
      "",
      "Configuration:",
      `  URL:          http://${host}:${port}/`,
      `  Debug mode:   ${debug ? "Enabled" : "Disabled"}`,
      `  Auto-reload:  ${reload ? "Enabled" : "Disabled"}`,
      "",
      "Press Ctrl+C to stop the server.",
      "",
    ];

    this.stdout.log(lines.join("\n"));
  }
}
