/**
 * Bundle Command for Alexi Static Files
 *
 * Django-style command that bundles TypeScript frontends to JavaScript.
 * Reads INSTALLED_APPS and finds apps with bundle configuration.
 *
 * Uses esbuild with code-splitting for lazy-loading templates.
 *
 * @module @alexi/staticfiles/commands/bundle
 */

import { BaseCommand, failure, success } from "@alexi/core";
import type { CommandOptions, CommandResult, IArgumentParser } from "@alexi/core";
import type { AppConfig, BundleConfig } from "@alexi/types";
import * as esbuild from "esbuild";
import { denoPlugins } from "esbuild-deno-loader";

// =============================================================================
// Types
// =============================================================================

/**
 * Result of bundling a single app
 */
interface BundleResult {
  appName: string;
  success: boolean;
  error?: string;
  outputPath?: string;
  duration?: number;
}

/**
 * HMR client connection controller
 */
type HmrClient = ReadableStreamDefaultController<Uint8Array>;

// =============================================================================
// BundleCommand Class
// =============================================================================

/**
 * Built-in command for bundling TypeScript frontends
 *
 * This command:
 * 1. Reads INSTALLED_APPS from project settings
 * 2. Finds each app's app.ts configuration
 * 3. Bundles apps that have a bundle configuration
 * 4. Writes output to the app's static directory
 *
 * @example Command line usage
 * ```bash
 * # Bundle all apps
 * deno run -A manage.ts bundle
 *
 * # Bundle specific app
 * deno run -A manage.ts bundle --app comachine
 *
 * # Bundle with watch mode
 * deno run -A manage.ts bundle --watch
 *
 * # Production build (minified)
 * deno run -A manage.ts bundle --minify
 * ```
 */
export class BundleCommand extends BaseCommand {
  readonly name = "bundle";
  readonly help = "Bundle TypeScript frontends to JavaScript";
  readonly description = "Reads INSTALLED_APPS and bundles the frontend for each app " +
    "that has a bundle configuration in app.ts. Output goes to the app's " +
    "static directory, from where collectstatic can collect it.";

  readonly examples = [
    "manage.ts bundle                  - Bundle all frontends",
    "manage.ts bundle --app comachine  - Bundle only comachine",
    "manage.ts bundle --watch          - Bundle and watch for changes",
    "manage.ts bundle --minify         - Production build (minified)",
  ];

  /**
   * Project root directory
   */
  private projectRoot: string = Deno.cwd();

  /**
   * HMR clients (for watch mode)
   */
  private clients: Set<HmrClient> = new Set();

  /**
   * File watcher (for watch mode)
   */
  private watcher: Deno.FsWatcher | null = null;

  /**
   * Debounce timer for file changes
   */
  private debounceTimer: number | undefined;

  // ===========================================================================
  // Argument Configuration
  // ===========================================================================

  addArguments(parser: IArgumentParser): void {
    parser.addArgument("--app", {
      type: "string",
      help: "Bundle only a specific app (app name in INSTALLED_APPS)",
    });

    parser.addArgument("--watch", {
      type: "boolean",
      default: false,
      alias: "-w",
      help: "Watch for file changes and rebuild automatically",
    });

    parser.addArgument("--minify", {
      type: "boolean",
      default: false,
      alias: "-m",
      help: "Minify output (production build)",
    });

    parser.addArgument("--no-css", {
      type: "boolean",
      default: false,
      help: "Do not bundle CSS files",
    });
  }

  // ===========================================================================
  // Command Execution
  // ===========================================================================

  async handle(options: CommandOptions): Promise<CommandResult> {
    const targetApp = options.args.app as string | undefined;
    const watch = options.args.watch as boolean;
    const minify = options.args.minify as boolean;
    const noCss = options.args["no-css"] as boolean;
    const debug = options.debug;

    // Skip bundling if SKIP_BUNDLE is set (e.g., in CI)
    if (Deno.env.get("SKIP_BUNDLE") === "1") {
      this.info("Skipping bundling (SKIP_BUNDLE=1)");
      return success();
    }

    try {
      // Load settings
      const settings = await this.loadSettings();
      if (!settings) {
        return failure("Failed to load settings");
      }

      // Find apps to bundle
      const appsToBuild = await this.findAppsToBuild(settings, targetApp);

      if (appsToBuild.length === 0) {
        this.warn("No apps found with bundle configuration");
        return success();
      }

      // Print banner
      this.printBanner(appsToBuild, { watch, minify, debug });

      // Bundle all apps
      const results = await this.bundleApps(appsToBuild, {
        minify,
        includeCss: !noCss,
        debug,
      });

      // Print results
      this.printResults(results);

      // Check for failures
      const failures = results.filter((r) => !r.success);
      if (failures.length > 0) {
        return failure(`${failures.length} bundles failed`);
      }

      // Start watching if requested
      if (watch) {
        await this.startWatching(appsToBuild, {
          minify,
          includeCss: !noCss,
          debug,
        });
        // Keep running until interrupted (only when run as CLI command)
        await new Promise(() => {}); // Never resolves
      }

      return success(`${results.length} apps bundled`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.error(`Bundling failed: ${message}`);
      return failure(message);
    }
  }

  // ===========================================================================
  // Settings Loading
  // ===========================================================================

  /**
   * Load project settings from all settings files
   * Aggregates INSTALLED_APPS and APP_PATHS from all *.settings.ts files
   */
  private async loadSettings(): Promise<
    {
      installedApps: string[];
      appPaths: Record<string, string>;
    } | null
  > {
    try {
      const projectDir = `${this.projectRoot}/project`;
      const allApps: Set<string> = new Set();
      const allPaths: Record<string, string> = {};

      // Find all settings files in project directory
      for await (const entry of Deno.readDir(projectDir)) {
        if (entry.isFile && entry.name.endsWith(".settings.ts")) {
          try {
            const settingsPath = `${projectDir}/${entry.name}`;
            const settings = await import(`file://${settingsPath}`);

            const installedApps: string[] = settings.INSTALLED_APPS ?? [];
            const appPaths: Record<string, string> = settings.APP_PATHS ?? {};

            // Collect all unique apps
            for (const appName of installedApps) {
              allApps.add(appName);
              if (appPaths[appName] && !allPaths[appName]) {
                allPaths[appName] = appPaths[appName];
              }
            }
          } catch {
            // Skip invalid settings files
          }
        }
      }

      if (allApps.size === 0) {
        return null;
      }

      return {
        installedApps: Array.from(allApps),
        appPaths: allPaths,
      };
    } catch (error) {
      if (this.watcher === null) {
        // Only log error if not in watch mode (to avoid spam)
        this.error(`Failed to load settings: ${error}`);
      }
      return null;
    }
  }

  // ===========================================================================
  // App Discovery
  // ===========================================================================

  /**
   * Find apps that have bundle configuration
   */
  private async findAppsToBuild(
    settings: { installedApps: string[]; appPaths: Record<string, string> },
    targetApp?: string,
  ): Promise<Array<{ name: string; path: string; config: AppConfig }>> {
    const apps: Array<{ name: string; path: string; config: AppConfig }> = [];

    for (const appName of settings.installedApps) {
      // Skip if targeting a specific app
      if (targetApp && appName !== targetApp) {
        continue;
      }

      const appPath = settings.appPaths[appName];
      if (!appPath) {
        this.debug(`App ${appName} not in APP_PATHS, skipping`, true);
        continue;
      }

      // Try to load app.ts
      const config = await this.loadAppConfig(appName, appPath);
      if (!config) {
        continue;
      }

      // Check if app has bundle configuration
      if (!config.bundle) {
        this.debug(`App ${appName} has no bundle configuration`, true);
        continue;
      }

      apps.push({ name: appName, path: appPath, config });
    }

    return apps;
  }

  /**
   * Load an app's configuration from app.ts
   */
  private async loadAppConfig(
    appName: string,
    appPath: string,
  ): Promise<AppConfig | null> {
    try {
      const fullPath = `${this.projectRoot}/${appPath}/app.ts`;
      const module = await import(`file://${fullPath}`);
      return module.default as AppConfig;
    } catch (error) {
      this.debug(`App ${appName} app.ts not found: ${error}`, true);
      return null;
    }
  }

  // ===========================================================================
  // Bundling
  // ===========================================================================

  /**
   * Bundle all apps
   */
  private async bundleApps(
    apps: Array<{ name: string; path: string; config: AppConfig }>,
    options: { minify: boolean; includeCss: boolean; debug: boolean },
  ): Promise<BundleResult[]> {
    const results: BundleResult[] = [];

    for (const app of apps) {
      const result = await this.bundleApp(app, options);
      results.push(result);
    }

    return results;
  }

  /**
   * Normalize path separators (Windows backslash → forward slash)
   */
  private normalizePath(path: string): string {
    return path.replace(/\\/g, "/");
  }

  /**
   * Bundle a single app
   */
  private async bundleApp(
    app: { name: string; path: string; config: AppConfig },
    options: { minify: boolean; includeCss: boolean; debug: boolean },
  ): Promise<BundleResult> {
    const startTime = performance.now();
    const bundleConfig = app.config.bundle!;

    try {
      // Resolve paths (normalize ./ prefixes)
      // Use relative paths for esbuild compatibility on Windows
      const appPath = app.path.replace(/^\.\//, "");
      const entrypoint = bundleConfig.entrypoint.replace(/^\.\//, "");
      const outputDirRel = bundleConfig.outputDir.replace(/^\.\//, "");

      // Relative paths for esbuild (works better cross-platform)
      const appDir = `./${appPath}`;
      const entryPoint = `${appDir}/${entrypoint}`;
      const outputDir = `${appDir}/${outputDirRel}`;
      const outputPath = `${outputDir}/${bundleConfig.outputName}`;

      // Ensure output directory exists
      await Deno.mkdir(outputDir, { recursive: true });

      // Bundle JavaScript/TypeScript
      this.info(`Bundling ${app.name}...`);
      await this.bundleJS(entryPoint, outputPath, options.minify);

      // Bundle CSS if configured
      if (options.includeCss && bundleConfig.cssOutputName) {
        const cssOutputPath = `${outputDir}/${bundleConfig.cssOutputName}`;
        await this.bundleCSS(appDir, cssOutputPath);
      }

      const duration = performance.now() - startTime;

      return {
        appName: app.name,
        success: true,
        outputPath,
        duration,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        appName: app.name,
        success: false,
        error: message,
        duration: performance.now() - startTime,
      };
    }
  }

  /**
   * Bundle JavaScript/TypeScript entry point using esbuild with code-splitting
   *
   * Code-splitting produces:
   * - main.js (entry point)
   * - chunk-XXXX.js (shared modules)
   * - Lazy-loaded templates as separate chunks
   */
  private async bundleJS(
    entryPoint: string,
    outputPath: string,
    minify: boolean,
  ): Promise<void> {
    // Output directory is the parent of outputPath
    const outputDir = outputPath.substring(0, outputPath.lastIndexOf("/"));
    const outputName = outputPath.substring(outputPath.lastIndexOf("/") + 1);

    // Clean up old chunks before building
    try {
      for await (const entry of Deno.readDir(outputDir)) {
        if (
          entry.isFile &&
          (entry.name.startsWith("chunk-") || entry.name.startsWith("main-")) &&
          entry.name.endsWith(".js")
        ) {
          await Deno.remove(`${outputDir}/${entry.name}`);
        }
      }
    } catch {
      // Directory might not exist yet
    }

    // Use absolute path for configPath (required by deno-loader)
    // But use file:// URL for Windows compatibility
    const configPath = `${Deno.cwd()}/deno.jsonc`.replace(/\\/g, "/");

    const result = await esbuild.build({
      entryPoints: [entryPoint],
      bundle: true,
      splitting: true, // 👈 Code-splitting for dynamic imports!
      format: "esm",
      outdir: outputDir,
      entryNames: outputName.replace(".js", ""), // main -> main.js
      chunkNames: "chunks/[name]-[hash]", // chunks/template-home-abc123.js
      platform: "browser",
      target: ["es2020"],
      minify,
      sourcemap: !minify,
      metafile: true, // For analysis
      plugins: [...denoPlugins({
        configPath,
      })],
      // Externalize nothing - bundle everything
      external: [],
      // Tree shaking
      treeShaking: true,
      // Keep console.log in dev
      drop: minify ? ["console", "debugger"] : [],
    });

    if (result.errors.length > 0) {
      const errorMessages = result.errors.map((e) => e.text).join("\n");
      throw new Error(`Bundle failed: ${errorMessages}`);
    }

    // Log chunk info in debug mode
    if (result.metafile) {
      const outputs = Object.keys(result.metafile.outputs);
      const chunks = outputs.filter((o) => o.includes("chunks/"));
      if (chunks.length > 0) {
        this.debug(`  Code-split: ${chunks.length} chunks created`, true);
      }
    }

    // Stop esbuild service to free resources
    await esbuild.stop();
  }

  /**
   * Bundle CSS files from app's src directory
   */
  private async bundleCSS(appDir: string, outputPath: string): Promise<void> {
    // Look for index.css or main.css in src directory
    const cssFiles = [
      `${appDir}/src/index.css`,
      `${appDir}/src/main.css`,
      `${appDir}/src/styles.css`,
    ];

    const contents: string[] = [];

    for (const cssFile of cssFiles) {
      try {
        const content = await Deno.readTextFile(cssFile);
        contents.push(content);
      } catch {
        // File doesn't exist, skip
      }
    }

    if (contents.length > 0) {
      await Deno.writeTextFile(outputPath, contents.join("\n"));
    }
  }

  // ===========================================================================
  // File Watching
  // ===========================================================================

  /**
   * Start watching for file changes
   */
  private async startWatching(
    apps: Array<{ name: string; path: string; config: AppConfig }>,
    options: { minify: boolean; includeCss: boolean; debug: boolean },
  ): Promise<void> {
    // Collect all source directories to watch
    const watchDirs: string[] = [];

    for (const app of apps) {
      const appDir = `${this.projectRoot}/${app.path}`;
      const srcDir = `${appDir}/src`;

      try {
        await Deno.stat(srcDir);
        watchDirs.push(srcDir);
      } catch {
        // src directory doesn't exist, watch app directory directly
        try {
          await Deno.stat(appDir);
          watchDirs.push(appDir);
        } catch {
          // App directory doesn't exist either
        }
      }
    }

    if (watchDirs.length === 0) {
      this.warn("No directories to watch");
      return;
    }

    this.watcher = Deno.watchFs(watchDirs);

    this.info(`Watching for changes: ${watchDirs.join(", ")}`);
    this.info("Press Ctrl+C to stop");

    for await (const event of this.watcher) {
      // Filter out changes to static/ and bundle files to prevent infinite loop
      const isSourceChange = event.paths.some((p) => {
        const isStatic = p.includes("/static/") || p.includes("\\static\\");
        const isBundle = p.includes("bundle.js") || p.includes("bundle.css");
        return !isStatic && !isBundle;
      });

      if (!isSourceChange) continue;

      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(async () => {
        console.log("");
        this.info("File change detected, rebuilding...");
        const results = await this.bundleApps(apps, options);
        this.printResults(results);
        this.broadcastReload();
      }, 100);
    }
  }

  /**
   * Stop watching for file changes
   */
  stopWatching(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
  }

  // ===========================================================================
  // HMR Support
  // ===========================================================================

  /**
   * Broadcast reload message to all connected HMR clients
   */
  broadcastReload(): void {
    const msg = new TextEncoder().encode("data: reload\n\n");
    for (const client of this.clients) {
      try {
        client.enqueue(msg);
      } catch {
        this.clients.delete(client);
      }
    }
    if (this.clients.size > 0) {
      this.debug(`Notified ${this.clients.size} HMR clients`, true);
    }
  }

  /**
   * Create an HMR SSE response
   */
  createHmrResponse(): Response {
    let controller: HmrClient;
    const stream = new ReadableStream<Uint8Array>({
      start: (c) => {
        controller = c;
        this.clients.add(controller);
        controller.enqueue(new TextEncoder().encode(": connected\n\n"));
      },
      cancel: () => {
        if (controller) this.clients.delete(controller);
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  /**
   * Get number of connected HMR clients
   */
  get clientCount(): number {
    return this.clients.size;
  }

  // ===========================================================================
  // Non-blocking Bundle + Watch (for runserver integration)
  // ===========================================================================

  /**
   * Bundle all apps and start watching in background (non-blocking)
   *
   * This is used by runserver to:
   * 1. Do initial bundle
   * 2. Start file watcher in background
   * 3. Return immediately so server can start
   *
   * @returns Promise that resolves after initial bundle completes
   */
  async bundleAndWatch(options: {
    minify?: boolean;
    debug?: boolean;
  } = {}): Promise<{ success: boolean; error?: string }> {
    const minify = options.minify ?? false;
    const debug = options.debug ?? false;

    try {
      // Load settings
      const settings = await this.loadSettings();
      if (!settings) {
        return { success: false, error: "Failed to load settings" };
      }

      // Find apps to bundle
      const appsToBuild = await this.findAppsToBuild(settings);

      if (appsToBuild.length === 0) {
        return { success: true };
      }

      // Print banner
      this.printBanner(appsToBuild, { watch: true, minify, debug });

      // Do initial bundle
      const results = await this.bundleApps(appsToBuild, {
        minify,
        includeCss: true,
        debug,
      });

      // Print results
      this.printResults(results);

      // Check for failures
      const failures = results.filter((r) => !r.success);
      if (failures.length > 0) {
        return {
          success: false,
          error: `${failures.length} bundles failed`,
        };
      }

      // Start watching in background (non-blocking)
      this.startWatchingBackground(appsToBuild, {
        minify,
        includeCss: true,
        debug,
      });

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }

  /**
   * Start watching for file changes (non-blocking, runs in background)
   */
  private startWatchingBackground(
    apps: Array<{ name: string; path: string; config: AppConfig }>,
    options: { minify: boolean; includeCss: boolean; debug: boolean },
  ): void {
    // Collect all source directories to watch
    const watchDirs: string[] = [];

    for (const app of apps) {
      const appPath = app.path.replace(/^\.\//, "");
      const appDir = `${this.projectRoot}/${appPath}`;
      const srcDir = `${appDir}/src`;

      try {
        const stat = Deno.statSync(srcDir);
        if (stat.isDirectory) {
          watchDirs.push(srcDir);
        }
      } catch {
        // src directory doesn't exist, watch app directory directly
        try {
          const appStat = Deno.statSync(appDir);
          if (appStat.isDirectory) {
            watchDirs.push(appDir);
          }
        } catch {
          // App directory doesn't exist either
        }
      }
    }

    if (watchDirs.length === 0) {
      return;
    }

    this.watcher = Deno.watchFs(watchDirs);

    this.info(`Watching for changes: ${watchDirs.join(", ")}`);

    // Start watching in background (don't await)
    (async () => {
      for await (const event of this.watcher!) {
        // Filter out changes to static/ and bundle files to prevent infinite loop
        const isSourceChange = event.paths.some((p) => {
          const isStatic = p.includes("/static/") || p.includes("\\static\\");
          const isBundle = p.includes("bundle.js") || p.includes("bundle.css");
          return !isStatic && !isBundle;
        });

        if (!isSourceChange) continue;

        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(async () => {
          console.log("");
          this.info("File change detected, rebuilding...");
          const results = await this.bundleApps(apps, options);
          this.printResults(results);
          this.broadcastReload();
        }, 100);
      }
    })();
  }

  // ===========================================================================
  // Output
  // ===========================================================================

  /**
   * Print startup banner
   */
  private printBanner(
    apps: Array<{ name: string; path: string; config: AppConfig }>,
    options: { watch: boolean; minify: boolean; debug: boolean },
  ): void {
    const lines: string[] = [];

    lines.push("┌─────────────────────────────────────────────┐");
    lines.push("│              Alexi Bundler                  │");
    lines.push("└─────────────────────────────────────────────┘");
    lines.push("");
    lines.push("Configuration:");
    lines.push(`  Minify:            ${options.minify ? "On" : "Off"}`);
    lines.push(`  Watch mode:        ${options.watch ? "On" : "Off"}`);
    lines.push(`  Debug mode:        ${options.debug ? "On" : "Off"}`);
    lines.push("");
    lines.push("Apps to bundle:");
    for (const app of apps) {
      lines.push(`  - ${app.name} (${app.path})`);
    }
    lines.push("");

    this.stdout.log(lines.join("\n"));
  }

  /**
   * Print bundle results
   */
  private printResults(results: BundleResult[]): void {
    for (const result of results) {
      if (result.success) {
        const duration = result.duration?.toFixed(0) ?? "?";
        this.success(`${result.appName} bundled (${duration}ms)`);
        if (result.outputPath) {
          this.stdout.log(`    → ${result.outputPath}`);
        }
      } else {
        this.error(`${result.appName} failed: ${result.error}`);
      }
    }
  }
}
