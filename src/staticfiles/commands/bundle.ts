/**
 * Bundle Command for Alexi Static Files
 *
 * Django-style command that bundles TypeScript frontends to JavaScript.
 * Reads INSTALLED_APPS and finds apps with bundle configuration.
 *
 * Uses esbuild with code-splitting for lazy-loading templates.
 *
 * Template embedding:
 * When bundling a Service Worker (outputName ends with .js and app has
 * bundle config), all installed apps' `templatesDir` directories are scanned
 * recursively and their `.html` files are embedded into the bundle via a
 * virtual esbuild module. This populates `templateRegistry` at runtime so
 * that `templateView` works without filesystem access inside a Service Worker.
 *
 * @module @alexi/staticfiles/commands/bundle
 */

import { BaseCommand, failure, success } from "@alexi/core";
import type {
  CommandOptions,
  CommandResult,
  IArgumentParser,
} from "@alexi/core";
import type { AppConfig, BundleConfig } from "@alexi/types";
import * as esbuild from "esbuild";
import { denoPlugins } from "esbuild-deno-loader";

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Convert a file path to a file:// URL string for dynamic import.
 * Only used for loading settings files.
 */
function toImportUrl(filePath: string): string {
  let normalized = filePath.replace(/\\/g, "/");

  if (normalized.startsWith("./")) {
    normalized = normalized.slice(2);
  }

  if (/^[a-zA-Z]:\//.test(normalized)) {
    return `file:///${normalized}`;
  }

  if (/^[a-zA-Z]:/.test(normalized)) {
    return `file:///${normalized}`;
  }

  if (normalized.startsWith("/")) {
    return `file://${normalized}`;
  }

  const cwd = Deno.cwd().replace(/\\/g, "/");
  if (/^[a-zA-Z]:\//.test(cwd)) {
    return `file:///${cwd}/${normalized}`;
  }
  return `file://${cwd}/${normalized}`;
}

// =============================================================================
// Types
// =============================================================================

/**
 * Import function type for apps.
 */
type AppImportFn = () => Promise<
  { default?: AppConfig; [key: string]: unknown }
>;

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

/**
 * A discovered template: its Django-style name and source content.
 *
 * @internal Exported for testing only.
 */
export interface DiscoveredTemplate {
  name: string;
  source: string;
}

// =============================================================================
// Template Scanning Helpers
// =============================================================================

/**
 * Normalise a `templatesDir` value (relative path or `file://` URL) to an
 * absolute filesystem path.  Returns `null` if the value is empty.
 *
 * @internal Exported for testing only.
 */
export function resolveTemplatesDir(
  templatesDir: string,
  projectRoot: string,
): string | null {
  if (!templatesDir) return null;

  if (templatesDir.startsWith("file://")) {
    try {
      // file:// URL → absolute OS path
      const url = new URL(templatesDir);
      // On Windows the pathname starts with /C:/...
      const pathname = url.pathname.replace(/\/$/, "");
      // Remove leading slash on Windows absolute paths
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
  return `${projectRoot}/${rel}`;
}

/**
 * Recursively scan a `templatesDir` and collect all `.html` files.
 *
 * Returns an array of `{ name, source }` pairs where `name` uses
 * Django-style namespacing: the path relative to `templatesDir`.
 *
 * @example
 * // templatesDir = "/project/src/my-app/templates"
 * // file at     = "/project/src/my-app/templates/my-app/note_list.html"
 * // → name      = "my-app/note_list.html"
 *
 * @internal Exported for testing only.
 */
export async function scanTemplatesDir(
  dir: string,
): Promise<DiscoveredTemplate[]> {
  const results: DiscoveredTemplate[] = [];

  async function walk(currentDir: string, relativePath: string): Promise<void> {
    let entries: Deno.DirEntry[];
    try {
      entries = [];
      for await (const entry of Deno.readDir(currentDir)) {
        entries.push(entry);
      }
    } catch {
      // Directory doesn't exist or can't be read
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
          // Django-style name: relative to templatesDir, forward slashes
          const name = entryRelPath.replace(/\\/g, "/");
          results.push({ name, source });
        } catch {
          // Skip unreadable files
        }
      }
    }
  }

  await walk(dir, "");
  return results;
}

/**
 * Scan all installed apps' `templatesDir` directories and return the
 * combined list of discovered templates.
 *
 * @param importFunctions - Array of app import functions from INSTALLED_APPS
 * @param projectRoot     - Absolute path to the project root
 *
 * @internal Exported for testing only.
 */
export async function collectAllTemplates(
  importFunctions: AppImportFn[],
  projectRoot: string,
): Promise<DiscoveredTemplate[]> {
  const allTemplates: DiscoveredTemplate[] = [];

  for (const importFn of importFunctions) {
    try {
      const module = await importFn();
      const config = module.default as AppConfig | undefined;
      if (!config?.templatesDir) continue;

      const dir = resolveTemplatesDir(config.templatesDir, projectRoot);
      if (!dir) continue;

      const templates = await scanTemplatesDir(dir);
      allTemplates.push(...templates);
    } catch {
      // Skip apps that fail to load
    }
  }

  return allTemplates;
}

/**
 * Generate the source of the virtual templates module.
 *
 * The generated module imports `templateRegistry` from `@alexi/views` and
 * calls `register()` for every discovered template.
 *
 * @internal Exported for testing only.
 */
export function generateTemplatesModule(
  templates: DiscoveredTemplate[],
): string {
  const lines: string[] = [
    "// Auto-generated by Alexi bundle command — do not edit",
    'import { templateRegistry } from "@alexi/views";',
    "",
  ];

  for (const { name, source } of templates) {
    // Escape backtick, backslash, and ${} in the template source
    const escaped = source
      .replace(/\\/g, "\\\\")
      .replace(/`/g, "\\`")
      .replace(/\$\{/g, "\\${");
    lines.push(
      `templateRegistry.register(${JSON.stringify(name)}, \`${escaped}\`);`,
    );
  }

  return lines.join("\n");
}

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
  override readonly description =
    "Reads INSTALLED_APPS and bundles the frontend for each app " +
    "that has a bundle configuration in app.ts. Output goes to the app's " +
    "static directory, from where collectstatic can collect it.";

  override readonly examples = [
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

  override addArguments(parser: IArgumentParser): void {
    parser.addArgument("--settings", {
      type: "string",
      alias: "-s",
      help: "Settings module to use (e.g. 'farmhub-sw'). " +
        "When provided, only apps from this settings file are bundled.",
    });

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
    const settingsArg = options.args.settings as string | undefined;

    // Skip bundling if SKIP_BUNDLE is set (e.g., in CI)
    if (Deno.env.get("SKIP_BUNDLE") === "1") {
      this.info("Skipping bundling (SKIP_BUNDLE=1)");
      return success();
    }

    // Resolve settings path when --settings is provided
    let settingsPath: string | undefined;
    if (settingsArg) {
      settingsPath = this.resolveSettingsPath(settingsArg);
    }

    try {
      // Load settings
      const settings = await this.loadSettings(settingsPath);
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
        importFunctions: settings.importFunctions,
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
          importFunctions: settings.importFunctions,
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
   * Resolve a short settings name (e.g. "farmhub-sw") to an absolute file path.
   * Mirrors the logic used by web/commands/runserver.ts.
   */
  private resolveSettingsPath(settingsArg: string): string {
    if (settingsArg.endsWith(".ts")) {
      if (settingsArg.startsWith("./") || settingsArg.startsWith("../")) {
        return `${this.projectRoot}/${settingsArg.slice(2)}`;
      }
      return `${this.projectRoot}/${settingsArg}`;
    }

    if (settingsArg.includes(".")) {
      const modulePath = settingsArg.replace(/\./g, "/");
      return `${this.projectRoot}/${modulePath}.ts`;
    }

    return `${this.projectRoot}/project/${settingsArg}.settings.ts`;
  }

  /**
   * Load project settings.
   *
   * When `settingsPath` is provided (e.g. passed from `runserver`), only that
   * single file is loaded.  This ensures that only the apps belonging to the
   * active settings context are bundled.
   *
   * When no path is given (e.g. `bundle` command run directly without
   * `--settings`), the original behaviour of scanning every `*.settings.ts`
   * file in the `project/` directory is used as a fallback.
   */
  private async loadSettings(settingsPath?: string): Promise<
    {
      importFunctions: AppImportFn[];
    } | null
  > {
    try {
      const importFunctions: AppImportFn[] = [];

      if (settingsPath) {
        // Load only the active settings file
        try {
          const settingsUrl = toImportUrl(settingsPath);
          const settings = await import(settingsUrl);
          const installedApps = settings.INSTALLED_APPS ?? [];
          for (const app of installedApps) {
            if (typeof app === "function") {
              importFunctions.push(app as AppImportFn);
            }
          }
        } catch {
          // Invalid settings file
        }
      } else {
        // Fallback: scan all settings files in project directory
        const projectDir = `${this.projectRoot}/project`;
        for await (const entry of Deno.readDir(projectDir)) {
          if (entry.isFile && entry.name.endsWith(".settings.ts")) {
            try {
              const filePath = `${projectDir}/${entry.name}`;
              const settingsUrl = toImportUrl(filePath);
              const settings = await import(settingsUrl);
              const installedApps = settings.INSTALLED_APPS ?? [];
              for (const app of installedApps) {
                if (typeof app === "function") {
                  importFunctions.push(app as AppImportFn);
                }
              }
            } catch {
              // Skip invalid settings files
            }
          }
        }
      }

      if (importFunctions.length === 0) {
        return null;
      }

      return { importFunctions };
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
   * Find apps that have bundle configuration.
   * Calls each import function to get the app module.
   */
  private async findAppsToBuild(
    settings: { importFunctions: AppImportFn[] },
    targetApp?: string,
  ): Promise<Array<{ name: string; path: string; config: AppConfig }>> {
    const apps: Array<{ name: string; path: string; config: AppConfig }> = [];

    for (const importFn of settings.importFunctions) {
      try {
        // Call the user's import function
        const module = await importFn();
        const config = module.default as AppConfig | undefined;

        if (!config) {
          continue;
        }

        // Skip if targeting a specific app
        if (targetApp && config.name !== targetApp) {
          continue;
        }

        // Check if app has bundle configuration
        if (!config.bundle) {
          this.debug(`App ${config.name} has no bundle configuration`, true);
          continue;
        }

        // Get the app path from bundle config or derive from name
        const appPath = config.bundle.appPath ?? `./src/${config.name}`;

        apps.push({ name: config.name, path: appPath, config });
      } catch (error) {
        this.debug(`Failed to load app: ${error}`, true);
      }
    }

    return apps;
  }

  // ===========================================================================
  // Bundling
  // ===========================================================================

  /**
   * Bundle all apps
   */
  private async bundleApps(
    apps: Array<{ name: string; path: string; config: AppConfig }>,
    options: {
      minify: boolean;
      includeCss: boolean;
      debug: boolean;
      importFunctions?: AppImportFn[];
    },
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
    options: {
      minify: boolean;
      includeCss: boolean;
      debug: boolean;
      importFunctions?: AppImportFn[];
    },
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

      // Collect templates for embedding when bundling a Service Worker.
      // We embed templates when the output is a JS bundle (not CSS-only) and
      // there are import functions available from settings.
      let templates: DiscoveredTemplate[] = [];
      if (options.importFunctions && options.importFunctions.length > 0) {
        templates = await collectAllTemplates(
          options.importFunctions,
          this.projectRoot,
        );
        if (templates.length > 0) {
          this.info(
            `  Embedding ${templates.length} templates into ${bundleConfig.outputName}...`,
          );
        }
      }

      // Bundle JavaScript/TypeScript
      this.info(`Bundling ${app.name}...`);
      await this.bundleJS(entryPoint, outputPath, options.minify, templates);

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
   *
   * When `templates` are provided, a virtual `alexi:templates` module is
   * injected into the bundle that registers all discovered template files into
   * `templateRegistry` at runtime.  The entry point is automatically wrapped
   * so it imports the virtual module before any app code runs.
   */
  private async bundleJS(
    entryPoint: string,
    outputPath: string,
    minify: boolean,
    templates: DiscoveredTemplate[] = [],
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

    // Build the esbuild plugin list
    const plugins: esbuild.Plugin[] = [];

    // Inject templates virtual module plugin when templates are available
    if (templates.length > 0) {
      const templatesSource = generateTemplatesModule(templates);
      const virtualNamespace = "alexi-templates-virtual";

      plugins.push({
        name: "alexi-templates",
        setup(build) {
          // Resolve the virtual module specifier
          build.onResolve(
            { filter: /^alexi:templates$/ },
            () => ({ path: "alexi:templates", namespace: virtualNamespace }),
          );

          // Provide the generated source as the module contents
          build.onLoad(
            { filter: /.*/, namespace: virtualNamespace },
            () => ({ contents: templatesSource, loader: "ts" }),
          );
        },
      });
    }

    // Deno plugins must come last (they handle all other module resolutions)
    plugins.push(...denoPlugins({ configPath }));

    // Determine the effective entry point.
    // When templates are injected we create a synthetic entry that side-effect
    // imports the virtual templates module and then re-exports everything from
    // the original entry point.
    let effectiveEntryPoint = entryPoint;
    if (templates.length > 0) {
      // Build a thin wrapper as a virtual entry so we don't touch the user's file
      const wrappedSource = `import "alexi:templates";\nexport * from ${
        JSON.stringify("./" + entryPoint.replace(/^\.\//, ""))
      };\n`;

      // Use only the filename as the virtual entry path so that the namespace +
      // path combination is always a valid URL on every OS.  On Windows an
      // absolute path such as "C:/Users/..." would be interpreted as an invalid
      // port/scheme by @luca/esbuild-deno-loader when it constructs:
      //   new URL("alexi-sw-entry-virtual:C:/Users/...")
      // which breaks relative-import resolution.  Using just the filename avoids
      // this: the deno-resolver plugin uses `resolveDir` (set below) to resolve
      // imports from the virtual entry instead of deriving a base URL from the
      // importer path.  See https://github.com/atzufuki/alexi/issues/172.
      const cwdNorm = Deno.cwd().replace(/\\/g, "/");
      const virtualEntryPath = "__alexi_sw_entry__.ts";
      const virtualEntryNamespace = "alexi-sw-entry-virtual";

      // Add a plugin that intercepts the virtual entry path
      plugins.unshift({
        name: "alexi-sw-entry",
        setup(build) {
          build.onResolve(
            { filter: /^__alexi_sw_entry__\.ts$/ },
            (args) => ({
              path: virtualEntryPath,
              namespace: virtualEntryNamespace,
              pluginData: args,
            }),
          );

          build.onLoad(
            { filter: /.*/, namespace: virtualEntryNamespace },
            () => ({
              contents: wrappedSource,
              loader: "ts",
              resolveDir: cwdNorm,
            }),
          );
        },
      });

      effectiveEntryPoint = "__alexi_sw_entry__.ts";
    }

    const result = await esbuild.build({
      entryPoints: [effectiveEntryPoint],
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
      plugins,
      // Externalize nothing - bundle everything
      external: [],
      // Tree shaking
      treeShaking: true,
      // Keep console.log in dev
      drop: minify ? ["console", "debugger"] : [],
      // Preserve class names for ModelRegistry (reverse relations use constructor.name)
      keepNames: true,
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
    options: {
      minify: boolean;
      includeCss: boolean;
      debug: boolean;
      importFunctions?: AppImportFn[];
    },
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
   * @param options.settingsPath - Absolute path to the active settings file.
   *   When provided, only the apps from that file are bundled (fixes #169).
   *
   * @returns Promise that resolves after initial bundle completes
   */
  async bundleAndWatch(options: {
    minify?: boolean;
    debug?: boolean;
    settingsPath?: string;
  } = {}): Promise<{ success: boolean; error?: string }> {
    const minify = options.minify ?? false;
    const debug = options.debug ?? false;

    try {
      // Load settings — restrict to the active settings file when provided
      const settings = await this.loadSettings(options.settingsPath);
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
        importFunctions: settings.importFunctions,
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
        importFunctions: settings.importFunctions,
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
    options: {
      minify: boolean;
      includeCss: boolean;
      debug: boolean;
      importFunctions?: AppImportFn[];
    },
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
