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

import { configureSettings, getHttpApplication } from "@alexi/core";
import type { GetApplicationSettings } from "@alexi/core";
import {
  BaseCommand,
  failure,
  resolveSettingsPath,
  success,
  toImportUrl,
} from "@alexi/core/management";
import type {
  CommandOptions,
  CommandResult,
  IArgumentParser,
} from "@alexi/core/management";
import { path } from "@alexi/urls";
import type { URLPattern } from "@alexi/urls";
import type { Middleware } from "@alexi/middleware";
import type { AppConfig } from "@alexi/types";
import { templateRegistry } from "@alexi/views";
import { staticFilesMiddleware } from "@alexi/staticfiles";

// =============================================================================
// Helper Functions
// =============================================================================

// =============================================================================
// Types
// =============================================================================

interface ServerConfig {
  port: number;
  host: string;
  debug: boolean;
  createHmrResponse?: () => Response;
}

/**
 * App import function type, matching INSTALLED_APPS entries.
 */
type AppImportFn = () => Promise<
  { default?: AppConfig; [key: string]: unknown }
>;

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
  override readonly description =
    "Starts a Django-style web server that provides REST API, " +
    "admin panel, static file serving, and SPA fallback. " +
    "Automatically bundles TypeScript frontends and supports HMR.";

  override readonly examples = [
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

  override addArguments(parser: IArgumentParser): void {
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
      const settingsPath = this.resolveSettingsPath(settingsArg);
      this.info(`Loading settings: ${settingsArg}`);

      const settingsUrl = toImportUrl(settingsPath);
      const settings = await import(settingsUrl);

      const port = portArg ?? settings.DEFAULT_PORT ?? 8000;
      const host = hostArg ?? settings.DEFAULT_HOST ?? "0.0.0.0";
      const debug = true; // Dev server is always in debug mode

      // Validate port
      if (port < 1 || port > 65535) {
        this.error(`Invalid port: ${port}`);
        return failure("Invalid port");
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
                opts: { debug: boolean; settingsPath?: string },
              ) => Promise<{ success: boolean }>;
            }).bundleAndWatch({ debug, settingsPath });
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
        this.startBackendWatcher(settings);
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
  // Settings Resolution
  // ==========================================================================

  private resolveSettingsPath(settingsArg: string): string {
    return resolveSettingsPath(settingsArg, this.projectRoot);
  }

  // ==========================================================================
  // Installed Apps Loading
  // ==========================================================================

  /**
   * Collected app info from INSTALLED_APPS.
   * Used for static file serving and template loading.
   */
  private appNames: string[] = [];
  private appPaths: Record<string, string> = {};

  /**
   * Load all installed apps' configurations.
   *
   * This populates:
   * - `templateRegistry` via TEMPLATES setting (APP_DIRS + DIRS), or fallback
   *   to legacy `config.templatesDir` / convention-based `<appPath>/templates/`
   * - `this.appNames` and `this.appPaths` for static file serving
   *   (includes explicit `STATICFILES_DIRS` from settings)
   *
   * Called at server startup before creating the Application.
   */
  private async loadInstalledApps(
    settings: Record<string, unknown>,
  ): Promise<void> {
    const installedApps = settings.INSTALLED_APPS as
      | Array<AppImportFn>
      | undefined;

    if (!installedApps || !Array.isArray(installedApps)) return;

    // Collect app paths first (needed for APP_DIRS discovery)
    const appPathMap: Record<string, string> = {};
    for (const importFn of installedApps) {
      if (typeof importFn !== "function") continue;
      try {
        const module = await importFn();
        const config = module.default as AppConfig | undefined;
        if (!config?.name) continue;

        const appPath = this.resolveAppPath(config);
        if (appPath) {
          this.appNames.push(config.name);
          this.appPaths[config.name] = appPath;
          appPathMap[config.name] = appPath;
        }
      } catch {
        // Skip apps that fail to load
      }
    }

    let templatesRegistered = 0;

    // Check for Django-style TEMPLATES setting
    const templatesConfig = settings.TEMPLATES as
      | Array<{ APP_DIRS?: boolean; DIRS?: string[] }>
      | undefined;

    if (Array.isArray(templatesConfig) && templatesConfig.length > 0) {
      // New-style: TEMPLATES setting
      for (const config of templatesConfig) {
        // APP_DIRS: auto-discover <appPath>/templates/ for all installed apps
        if (config.APP_DIRS) {
          for (const [, appPath] of Object.entries(appPathMap)) {
            const absAppDir = appPath.startsWith("/")
              ? appPath
              : `${this.projectRoot}/${appPath.replace(/^\.\//, "")}`;
            const conventionDir = `${absAppDir}/templates`;
            try {
              const stat = await Deno.stat(conventionDir);
              if (stat.isDirectory) {
                await this.scanAndRegisterTemplates(conventionDir);
                templatesRegistered++;
              }
            } catch {
              // No templates dir by convention, skip
            }
          }
        }

        // DIRS: explicit extra template directories
        if (Array.isArray(config.DIRS)) {
          for (const dir of config.DIRS) {
            const resolved = this.resolveTemplatesDir(dir);
            if (!resolved) continue;
            try {
              const stat = await Deno.stat(resolved);
              if (stat.isDirectory) {
                await this.scanAndRegisterTemplates(resolved);
                templatesRegistered++;
              }
            } catch {
              // Skip unreadable directories
            }
          }
        }
      }
    } else {
      // Legacy fallback: explicit `config.templatesDir` on AppConfig or
      // convention-based `<appPath>/templates/` auto-discovery
      for (const importFn of installedApps) {
        if (typeof importFn !== "function") continue;

        try {
          const module = await importFn();
          const config = module.default as AppConfig | undefined;
          if (!config?.name) continue;

          const appPath = appPathMap[config.name];

          let templatesDir: string | null = null;
          if (config.templatesDir) {
            // 1. Legacy: explicit `config.templatesDir` on AppConfig
            templatesDir = this.resolveTemplatesDir(config.templatesDir);
          } else if (appPath) {
            // 2. Convention: `<appPath>/templates/` auto-discovery
            const absAppDir = appPath.startsWith("/")
              ? appPath
              : `${this.projectRoot}/${appPath.replace(/^\.\//, "")}`;
            const conventionDir = `${absAppDir}/templates`;
            try {
              const stat = await Deno.stat(conventionDir);
              if (stat.isDirectory) {
                templatesDir = conventionDir;
              }
            } catch {
              // No templates dir by convention, skip
            }
          }

          if (templatesDir) {
            await this.scanAndRegisterTemplates(templatesDir);
            templatesRegistered++;
          }
        } catch {
          // Skip apps that fail to load or have unreadable template dirs
        }
      }
    }

    // Also register templates from explicit STATICFILES_DIRS entries that
    // live alongside a templates/ sibling — but this is intentionally NOT done
    // here: STATICFILES_DIRS is for static assets only; templates from
    // ASSETFILES_DIRS are embedded at bundle time, not served by runserver.

    if (templatesRegistered > 0) {
      this.success(`Templates loaded from ${templatesRegistered} app(s)`);
    }

    // Handle explicit STATICFILES_DIRS: add each as a synthetic "app"
    const staticfilesDirs = settings.STATICFILES_DIRS as string[] | undefined;
    if (Array.isArray(staticfilesDirs)) {
      for (const dir of staticfilesDirs) {
        const resolved = dir.startsWith("file://")
          ? (() => {
            try {
              const url = new URL(dir);
              let pathname = url.pathname.replace(/\/$/, "");
              if (/^\/[a-zA-Z]:\//.test(pathname)) {
                pathname = pathname.slice(1);
              }
              return pathname;
            } catch {
              return null;
            }
          })()
          : dir.startsWith("/")
          ? dir
          : `${this.projectRoot}/${dir.replace(/^\.\//, "")}`;

        if (!resolved) continue;

        try {
          const stat = await Deno.stat(resolved);
          if (stat.isDirectory) {
            // Use a synthetic name based on path; store absolute path directly
            const syntheticName = `__staticfiles_dir_${this.appNames.length}__`;
            this.appNames.push(syntheticName);
            // Store absolute dir path; staticFilesMiddleware resolves via appPaths
            this.appPaths[syntheticName] = resolved;
          }
        } catch {
          // Directory doesn't exist, skip
        }
      }
    }

    if (this.appNames.length > 0) {
      this.success(
        `Static file serving enabled for ${this.appNames.length} app(s)`,
      );
    }
  }

  /**
   * Resolve an app's source directory from its AppConfig.
   *
   * Returns a path suitable for `AppDirectoriesFinder` (which resolves
   * relative paths against `projectRoot`).
   *
   * Supports two strategies:
   * - `staticDir` with `file://` URL → derive absolute parent directory
   * - Convention: `./src/${config.name}` (relative, resolved by the finder)
   *
   * Returns the app's source directory path, or null if not resolvable.
   */
  private resolveAppPath(config: AppConfig): string | null {
    // Strategy 0: explicit appPath on config (e.g. worker apps whose name
    // doesn't match their directory)
    if (config.appPath) {
      return config.appPath;
    }

    // Strategy 1: derive from file:// staticDir (published packages)
    if (config.staticDir?.startsWith("file://")) {
      try {
        const url = new URL(config.staticDir);
        let pathname = url.pathname.replace(/\/$/, "");
        // Remove leading slash on Windows absolute paths (/C:/...)
        if (/^\/[a-zA-Z]:\//.test(pathname)) {
          pathname = pathname.slice(1);
        }
        // staticDir points to e.g. /path/to/src/admin/static
        // The app dir is the parent of the static dir
        const lastSlash = pathname.lastIndexOf("/");
        if (lastSlash > 0) {
          // Return absolute path — starts with / (Unix) or C:/ (Windows)
          // The finder recognises / as absolute; for Windows, we prefix with /
          const absPath = pathname.slice(0, lastSlash);
          if (/^[a-zA-Z]:\//.test(absPath)) {
            return `/${absPath}`;
          }
          return absPath;
        }
        return null;
      } catch {
        return null;
      }
    }

    // Strategy 2: convention-based relative path from app name
    // The finder resolves this against projectRoot
    return `./src/${config.name}`;
  }

  /**
   * Normalize a `templatesDir` value (relative path or `file://` URL) to an
   * absolute filesystem path.  Returns `null` if the value cannot be resolved.
   */
  private resolveTemplatesDir(templatesDir: string): string | null {
    if (!templatesDir) return null;

    if (templatesDir.startsWith("file://")) {
      try {
        const url = new URL(templatesDir);
        const pathname = url.pathname.replace(/\/$/, "");
        // Remove leading slash on Windows absolute paths (/C:/...)
        if (/^\/[a-zA-Z]:\//.test(pathname)) {
          return pathname.slice(1);
        }
        return pathname;
      } catch {
        return null;
      }
    }

    // Relative path → resolve against project root
    const rel = templatesDir.replace(/^\.\//, "");
    return `${this.projectRoot}/${rel}`;
  }

  /**
   * Recursively scan `dir` for `.html` files and register each one into
   * `templateRegistry` using Django-style namespacing (path relative to `dir`).
   */
  private async scanAndRegisterTemplates(dir: string): Promise<void> {
    const walk = async (
      currentDir: string,
      relativePath: string,
    ): Promise<void> => {
      let entries: Deno.DirEntry[];
      try {
        entries = [];
        for await (const entry of Deno.readDir(currentDir)) {
          entries.push(entry);
        }
      } catch {
        return;
      }

      for (const entry of entries) {
        const entryRelPath = relativePath
          ? `${relativePath}/${entry.name}`
          : entry.name;
        const fullPath = `${currentDir}/${entry.name}`;

        if (entry.isDirectory) {
          await walk(fullPath, entryRelPath);
        } else if (entry.isFile && entry.name.endsWith(".html")) {
          try {
            const source = await Deno.readTextFile(fullPath);
            const name = entryRelPath.replace(/\\/g, "/");
            templateRegistry.register(name, source);
          } catch {
            // Skip unreadable files
          }
        }
      }
    };

    await walk(dir, "");
  }

  // ==========================================================================
  // Server
  // ==========================================================================

  private async startServer(
    settings: Record<string, unknown>,
    config: ServerConfig,
  ): Promise<void> {
    this.serverAbortController = new AbortController();

    // Load templates from all installed apps into templateRegistry and collect
    // static file paths. Must happen before building the augmented settings so
    // that this.appNames / this.appPaths are populated for staticFilesMiddleware.
    await this.loadInstalledApps(settings);

    // Build augmented settings for getApplication():
    //   1. DEBUG is always true in dev mode
    //   2. ROOT_URLCONF is wrapped to prepend the HMR endpoint (if active)
    //   3. createMiddleware is wrapped to prepend staticFilesMiddleware
    const baseSettings = settings as unknown as GetApplicationSettings;

    const augmentedSettings: GetApplicationSettings = {
      ...baseSettings,
      DEBUG: config.debug,
    };

    // Wrap ROOT_URLCONF to inject HMR endpoint at the front
    if (config.createHmrResponse) {
      const hmrPattern = path("hmr", () => config.createHmrResponse!(), {
        name: "hmr",
        methods: ["GET"],
      });
      const originalUrlConf = baseSettings.ROOT_URLCONF;
      augmentedSettings.ROOT_URLCONF = async () => {
        let base: URLPattern[] = [];
        if (typeof originalUrlConf === "function") {
          const mod = await originalUrlConf();
          base = (mod.urlpatterns ?? mod.default ?? []) as URLPattern[];
        } else if (Array.isArray(originalUrlConf)) {
          base = originalUrlConf;
        }
        return { urlpatterns: [hmrPattern, ...base] };
      };
    }

    // Wrap middleware to prepend staticFilesMiddleware
    if (this.appNames.length > 0) {
      const staticMw = staticFilesMiddleware({
        installedApps: this.appNames,
        appPaths: this.appPaths,
        projectRoot: this.projectRoot,
        debug: config.debug,
      });

      const originalCreateMiddleware = baseSettings.createMiddleware;
      const originalMiddleware = baseSettings.MIDDLEWARE;

      augmentedSettings.MIDDLEWARE = undefined;
      augmentedSettings.createMiddleware = (opts) => {
        let userMiddleware: Middleware[] = [];
        if (originalCreateMiddleware) {
          userMiddleware = originalCreateMiddleware(opts);
        } else if (originalMiddleware) {
          userMiddleware = originalMiddleware;
        }
        return [staticMw, ...userMiddleware];
      };
    }

    // Configure global settings registry, then build the application.
    // configureSettings() must be called before getHttpApplication() so
    // that conf proxy is populated.
    configureSettings(augmentedSettings);
    const app = await getHttpApplication();

    if (settings.ROOT_URLCONF) {
      this.success("Loaded URL patterns from ROOT_URLCONF");
    } else {
      this.warn("ROOT_URLCONF not set in settings. No URL patterns loaded.");
    }

    if (settings.DATABASES) {
      this.success("Database initialized");
    }

    // Log configuration
    console.log("");
    console.log("Server Configuration:");
    console.log(`  URL: http://${config.host}:${config.port}/`);
    console.log("");

    // Start server
    app.serve({
      port: config.port,
      hostname: config.host,
      signal: this.serverAbortController.signal,
    }).catch((err: unknown) => {
      if ((err as { name?: string }).name !== "AbortError") {
        console.error("Server error:", err);
      }
    });
  }

  // ==========================================================================
  // File Watcher
  // ==========================================================================

  private startBackendWatcher(settings: Record<string, unknown>): void {
    const watchDirs: string[] = [];
    const installedApps = settings.INSTALLED_APPS as
      | Array<() => Promise<unknown>>
      | undefined;

    if (!installedApps || !Array.isArray(installedApps)) {
      return;
    }

    // Watch the project's src directory for backend changes
    const srcDir = `${this.projectRoot}/src`;
    try {
      const stat = Deno.statSync(srcDir);
      if (stat.isDirectory) {
        watchDirs.push(srcDir);
      }
    } catch {
      // src directory doesn't exist
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
