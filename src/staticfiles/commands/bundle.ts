/**
 * Bundle Command for Alexi Static Files
 *
 * Django-style command that bundles TypeScript frontends to JavaScript.
 * Reads INSTALLED_APPS and finds apps with bundle configuration, and also
 * reads ASSETFILES_DIRS from project settings for the new settings-level
 * bundle configuration.
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
import type {
  AppConfig,
  AssetfilesDirConfig,
  BundleConfig,
  StaticfileConfig,
  TemplatesConfig,
} from "@alexi/types";
import * as esbuild from "esbuild";
import { denoPlugins } from "esbuild-deno-loader";
import { isAbsolute, join, toFileUrl } from "@std/path";

// =============================================================================
// Helper Functions
// =============================================================================

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
 * A normalised build target derived from either ASSETFILES_DIRS (new) or
 * AppConfig.bundle / AppConfig.staticfiles (legacy).
 */
interface BuildTarget {
  /** Display name shown in progress output */
  name: string;
  /** Entry point path relative to project root (e.g. "./src/app/worker.ts") */
  entryPoint: string;
  /** Absolute output file path */
  outputPath: string;
  /** Whether to minify (can be overridden per-entry) */
  minify?: boolean;
  /**
   * Templates directory to embed — scanned when this target is a SW bundle.
   * Absolute path or relative to project root.
   */
  templatesDir?: string;
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
  if (isAbsolute(templatesDir)) return templatesDir;
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
 * Collect templates using the Django-style TEMPLATES setting.
 *
 * When `APP_DIRS: true`, auto-discovers `<appPath>/templates/` for each
 * installed app.  `DIRS` entries add explicit extra directories.
 *
 * Falls back to `collectAllTemplates()` (legacy `config.templatesDir`) when
 * no TEMPLATES setting is provided.
 *
 * @param templatesConfig - Array from the `TEMPLATES` project setting
 * @param importFunctions - Array of app import functions from INSTALLED_APPS
 * @param projectRoot     - Absolute path to the project root
 *
 * @internal Exported for testing only.
 */
export async function collectTemplatesFromConfig(
  templatesConfig: TemplatesConfig[],
  importFunctions: AppImportFn[],
  projectRoot: string,
): Promise<DiscoveredTemplate[]> {
  const allTemplates: DiscoveredTemplate[] = [];

  // Build a map of appName → absolute appPath for APP_DIRS discovery
  const appPaths: string[] = [];
  for (const importFn of importFunctions) {
    try {
      const module = await importFn();
      const config = module.default as AppConfig | undefined;
      if (!config) continue;

      const appPath = (config.appPath ?? `./src/${config.name}`).replace(
        /^\.?\//,
        "",
      );
      const absAppDir = isAbsolute(appPath)
        ? appPath
        : `${projectRoot}/${appPath}`;
      appPaths.push(absAppDir);
    } catch {
      // Skip apps that fail to load
    }
  }

  for (const config of templatesConfig) {
    // APP_DIRS: auto-discover <appPath>/templates/ for all installed apps
    if (config.APP_DIRS) {
      for (const absAppDir of appPaths) {
        const conventionDir = `${absAppDir}/templates`;
        try {
          const stat = await Deno.stat(conventionDir);
          if (stat.isDirectory) {
            const templates = await scanTemplatesDir(conventionDir);
            allTemplates.push(...templates);
          }
        } catch {
          // No templates dir by convention, skip
        }
      }
    }

    // DIRS: explicit extra template directories
    if (Array.isArray(config.DIRS)) {
      for (const dir of config.DIRS) {
        const resolved = resolveTemplatesDir(dir, projectRoot);
        if (!resolved) continue;
        try {
          const stat = await Deno.stat(resolved);
          if (stat.isDirectory) {
            const templates = await scanTemplatesDir(resolved);
            allTemplates.push(...templates);
          }
        } catch {
          // Skip unreadable directories
        }
      }
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
 * deno run -A manage.ts bundle --app myapp
 *
 * # Bundle with watch mode
 * deno run -A manage.ts bundle --watch
 *
 * # Production build (minified)
 * deno run -A manage.ts bundle --minify
 * ```
 */
// =============================================================================
// buildSWBundle — exported for testing
// =============================================================================

/**
 * Options for {@link buildSWBundle}.
 */
export interface BuildSWBundleOptions {
  /** Entry point path (relative to cwd, e.g. "./src/my-app/sw.ts") */
  entryPoint: string;
  /** Absolute path to the output JS file */
  outputPath: string;
  /** Whether to minify the output */
  minify?: boolean;
  /** Templates to embed via the virtual alexi:templates module */
  templates?: DiscoveredTemplate[];
  /** Working directory (defaults to Deno.cwd()) */
  cwd?: string;
  /** Path to the deno.json config file (defaults to <cwd>/deno.json) */
  configPath?: string;
}

/**
 * Core bundling logic extracted for testability.
 *
 * Bundles a Service Worker entry point with optional template embedding.
 * Uses a virtual esbuild entry that side-effect imports `alexi:templates`
 * and re-exports everything from the real entry via an absolute `file://` URL
 * so that deno-resolver handles it correctly on all platforms (including Windows).
 *
 * `absWorkingDir` is always set to `cwd` so that esbuild's node_modules
 * scanner does not walk above the project root and hit system directories
 * (e.g. `$Recycle.Bin`, `PerfLogs`) on Windows.
 */
export async function buildSWBundle(
  options: BuildSWBundleOptions,
): Promise<void> {
  const {
    entryPoint,
    outputPath,
    minify = false,
    templates = [],
  } = options;

  const cwd = options.cwd ?? Deno.cwd();
  // configPath must be an absolute native filesystem path (not a file:// URL).
  // WasmWorkspace.discover() in esbuild-deno-loader expects a native path.
  // Auto-detect deno.jsonc (generated by `alexi startproject`) vs deno.json.
  const configPath = options.configPath ?? await (async () => {
    const jsonc = join(cwd, "deno.jsonc");
    try {
      await Deno.stat(jsonc);
      return jsonc;
    } catch {
      return join(cwd, "deno.json");
    }
  })();

  const outputDir = outputPath.substring(0, outputPath.lastIndexOf("/"));
  const outputName = outputPath.substring(outputPath.lastIndexOf("/") + 1);

  const plugins: esbuild.Plugin[] = [];

  // Inject templates virtual module plugin when templates are available
  if (templates.length > 0) {
    const templatesSource = generateTemplatesModule(templates);
    const virtualNamespace = "alexi-templates-virtual";

    plugins.push({
      name: "alexi-templates",
      setup(build) {
        build.onResolve(
          { filter: /^alexi:templates$/ },
          () => ({ path: "alexi:templates", namespace: virtualNamespace }),
        );
        build.onLoad(
          { filter: /.*/, namespace: virtualNamespace },
          () => ({ contents: templatesSource, loader: "ts" }),
        );
      },
    });
  }

  // Deno plugins must come last
  plugins.push(...denoPlugins({ configPath }));

  let effectiveEntryPoint = entryPoint;
  if (templates.length > 0) {
    // Use an absolute file:// URL so deno-resolver handles it correctly on all
    // platforms.  A relative path fails on Windows because deno-resolver
    // constructs an invalid URL from the virtual importer string.
    // See https://github.com/atzufuki/alexi/issues/172
    //
    // If the caller already passed a file:// URL, use it as-is; otherwise
    // resolve it relative to cwd and convert to a file:// URL.
    const absoluteEntryUrl = entryPoint.startsWith("file://")
      ? entryPoint
      : toFileUrl(
        `${cwd}/${entryPoint.replace(/^\.\//, "")}`,
      ).href;
    const wrappedSource = `import "alexi:templates";\nexport * from ${
      JSON.stringify(absoluteEntryUrl)
    };\n`;

    const cwdNorm = cwd.replace(/\\/g, "/");
    const virtualEntryPath = "__alexi_sw_entry__.ts";
    const virtualEntryNamespace = "alexi-sw-entry-virtual";

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
    splitting: true,
    format: "esm",
    outdir: outputDir,
    entryNames: outputName.replace(".js", ""),
    chunkNames: "chunks/[name]-[hash]",
    platform: "browser",
    target: ["es2020"],
    minify,
    sourcemap: false,
    metafile: true,
    plugins,
    external: [],
    treeShaking: true,
    keepNames: true,
    // Bound node_modules resolution to the project root so esbuild does not
    // walk up to the filesystem root (e.g. C:\) on Windows.
    absWorkingDir: cwd,
  });

  await esbuild.stop();

  if (result.errors.length > 0) {
    const errorMessages = result.errors.map((e) => e.text).join("\n");
    throw new Error(`Bundle failed: ${errorMessages}`);
  }
}

export class BundleCommand extends BaseCommand {
  readonly name = "bundle";
  readonly help = "Bundle TypeScript frontends to JavaScript";
  override readonly description =
    "Reads INSTALLED_APPS and bundles the frontend for each app " +
    "that has a bundle configuration in app.ts. Output goes to the app's " +
    "static directory, from where collectstatic can collect it.";

  override readonly examples = [
    "manage.ts bundle                  - Bundle all frontends",
    "manage.ts bundle --app myapp  - Bundle only myapp",
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
        templatesConfig: settings.templatesConfig,
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
          templatesConfig: settings.templatesConfig,
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
   * Delegates to the shared resolveSettingsPath utility.
   */
  private resolveSettingsPath(settingsArg: string): string {
    return resolveSettingsPath(settingsArg, this.projectRoot);
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
      assetfilesDirs: AssetfilesDirConfig[];
      templatesConfig: TemplatesConfig[];
    } | null
  > {
    try {
      const importFunctions: AppImportFn[] = [];
      const assetfilesDirs: AssetfilesDirConfig[] = [];
      const templatesConfig: TemplatesConfig[] = [];

      const processSettingsModule = (settings: Record<string, unknown>) => {
        const installedApps = settings.INSTALLED_APPS ?? [];
        for (const app of installedApps as unknown[]) {
          if (typeof app === "function") {
            importFunctions.push(app as AppImportFn);
          }
        }
        const dirs = settings.ASSETFILES_DIRS;
        if (Array.isArray(dirs)) {
          for (const d of dirs) {
            assetfilesDirs.push(d as AssetfilesDirConfig);
          }
        }
        const templates = settings.TEMPLATES;
        if (Array.isArray(templates)) {
          for (const t of templates) {
            templatesConfig.push(t as TemplatesConfig);
          }
        }
      };

      if (settingsPath) {
        // Load only the active settings file
        try {
          const settingsUrl = toImportUrl(settingsPath);
          const settings = await import(settingsUrl);
          processSettingsModule(settings as Record<string, unknown>);
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
              processSettingsModule(settings as Record<string, unknown>);
            } catch {
              // Skip invalid settings files
            }
          }
        }
      }

      if (importFunctions.length === 0 && assetfilesDirs.length === 0) {
        return null;
      }

      return { importFunctions, assetfilesDirs, templatesConfig };
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
   * Build the list of targets to bundle, combining:
   * 1. New-style: ASSETFILES_DIRS entries from project settings
   * 2. Legacy: AppConfig.staticfiles / AppConfig.bundle from INSTALLED_APPS
   */
  private async findAppsToBuild(
    settings: {
      importFunctions: AppImportFn[];
      assetfilesDirs: AssetfilesDirConfig[];
    },
    targetApp?: string,
  ): Promise<BuildTarget[]> {
    const targets: BuildTarget[] = [];

    // --- New-style: ASSETFILES_DIRS ---
    for (const entry of settings.assetfilesDirs) {
      const entryPath = entry.path.replace(/^\.\//, "");
      for (const ep of entry.entrypoints) {
        const epName = ep.replace(/^\.\//, "").replace(/\.ts$/, "");
        const outputFile = `${ep.replace(/^\.\//, "").replace(/\.ts$/, "")}.js`;
        const outputDir = entry.outputDir.replace(/^\.\//, "");
        const outputPath = `${this.projectRoot}/${outputDir}/${outputFile}`;
        const entryPoint = `./${entryPath}/${ep.replace(/^\.\//, "")}`;

        // --app filter by path/name heuristic
        if (targetApp) {
          if (!entry.path.includes(targetApp) && !ep.includes(targetApp)) {
            continue;
          }
        }

        targets.push({
          name: `${entry.path}/${epName}`,
          entryPoint,
          outputPath,
          minify: entry.options?.minify,
          templatesDir: entry.templatesDir,
        });
      }
    }

    // --- Legacy: INSTALLED_APPS with AppConfig.bundle / AppConfig.staticfiles ---
    for (const importFn of settings.importFunctions) {
      try {
        const module = await importFn();
        const config = module.default as AppConfig | undefined;

        if (!config) continue;

        // Skip if targeting a specific app
        if (targetApp && config.name !== targetApp) continue;

        // Check if app has legacy bundle configuration
        if (
          !config.bundle &&
          (!config.staticfiles || config.staticfiles.length === 0)
        ) {
          this.debug(`App ${config.name} has no bundle configuration`, true);
          continue;
        }

        const appPath = (config.appPath ?? config.bundle?.appPath ??
          `./src/${config.name}`).replace(/^\.\//, "");

        if (config.bundle) {
          const entrypoint = config.bundle.entrypoint.replace(/^\.\//, "");
          const outputDirRel = config.bundle.outputDir.replace(/^\.\//, "");
          const entryPoint = `./${appPath}/${entrypoint}`;
          const outputPath =
            `./${appPath}/${outputDirRel}/${config.bundle.outputName}`;

          targets.push({
            name: config.name,
            entryPoint,
            outputPath,
            minify: config.bundle.options?.minify,
            // Legacy bundle: collect templates from all apps via importFunctions
          });
        }

        if (config.staticfiles && config.staticfiles.length > 0) {
          for (const sf of config.staticfiles) {
            const entrypoint = sf.entrypoint.replace(/^\.\//, "");
            const outputFile = sf.outputFile.replace(/^\.\//, "");
            const entryPoint = `./${appPath}/${entrypoint}`;
            const outputPath = `./${appPath}/${outputFile}`;

            targets.push({
              name: `${config.name}/${outputFile.split("/").pop()}`,
              entryPoint,
              outputPath,
              minify: sf.options?.minify,
              // Legacy staticfiles: collect templates from all apps via importFunctions
            });
          }
        }
      } catch (error) {
        this.debug(`Failed to load app: ${error}`, true);
      }
    }

    return targets;
  }

  // ===========================================================================
  // Bundling
  // ===========================================================================

  /**
   * Bundle all targets
   */
  private async bundleApps(
    targets: BuildTarget[],
    options: {
      minify: boolean;
      includeCss: boolean;
      debug: boolean;
      importFunctions?: AppImportFn[];
      templatesConfig?: TemplatesConfig[];
    },
  ): Promise<BundleResult[]> {
    const results: BundleResult[] = [];

    for (const target of targets) {
      const result = await this.bundleTarget(target, options);
      results.push(result);
    }

    return results;
  }

  /**
   * Bundle a single BuildTarget
   */
  private async bundleTarget(
    target: BuildTarget,
    options: {
      minify: boolean;
      debug: boolean;
      importFunctions?: AppImportFn[];
      templatesConfig?: TemplatesConfig[];
    },
  ): Promise<BundleResult> {
    const startTime = performance.now();

    try {
      const outputPath = target.outputPath.replace(/\\/g, "/");
      const outputDir = outputPath.substring(0, outputPath.lastIndexOf("/"));

      // Ensure output directory exists
      await Deno.mkdir(outputDir, { recursive: true });

      // Determine templates to embed:
      // 1. If target specifies its own templatesDir, use that (ASSETFILES_DIRS style)
      // 2. Otherwise use TEMPLATES setting (new Django-style) if provided
      // 3. Otherwise fall back to collecting from all apps via importFunctions (legacy)
      let templates: DiscoveredTemplate[] = [];
      if (target.templatesDir) {
        const dir = resolveTemplatesDir(target.templatesDir, this.projectRoot);
        if (dir) {
          templates = await scanTemplatesDir(dir);
          if (templates.length > 0) {
            this.info(
              `  Embedding ${templates.length} templates from ${target.templatesDir}...`,
            );
          }
        }
      } else if (
        options.templatesConfig && options.templatesConfig.length > 0 &&
        options.importFunctions && options.importFunctions.length > 0
      ) {
        templates = await collectTemplatesFromConfig(
          options.templatesConfig,
          options.importFunctions,
          this.projectRoot,
        );
        if (templates.length > 0) {
          const outputName = outputPath.split("/").pop() ?? outputPath;
          this.info(
            `  Embedding ${templates.length} templates into ${outputName}...`,
          );
        }
      } else if (
        options.importFunctions && options.importFunctions.length > 0
      ) {
        templates = await collectAllTemplates(
          options.importFunctions,
          this.projectRoot,
        );
        if (templates.length > 0) {
          const outputName = outputPath.split("/").pop() ?? outputPath;
          this.info(
            `  Embedding ${templates.length} templates into ${outputName}...`,
          );
        }
      }

      const minify = target.minify ?? options.minify;
      this.info(`Bundling ${target.name}...`);
      await this.bundleJS(target.entryPoint, outputPath, minify, templates);

      return {
        appName: target.name,
        success: true,
        outputPath,
        duration: performance.now() - startTime,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        appName: target.name,
        success: false,
        error: message,
        duration: performance.now() - startTime,
      };
    }
  }

  /**
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
    const outputDir = outputPath.substring(0, outputPath.lastIndexOf("/"));

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

    await buildSWBundle({ entryPoint, outputPath, minify, templates });

    // Log a note in debug mode (metafile info is available inside buildSWBundle
    // but we keep the class method thin — chunk counts are visible via esbuild
    // stdout when running interactively).
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
    apps: BuildTarget[],
    options: {
      minify: boolean;
      includeCss: boolean;
      debug: boolean;
      importFunctions?: AppImportFn[];
      templatesConfig?: TemplatesConfig[];
    },
  ): Promise<void> {
    // Collect all source directories to watch
    const watchDirs: string[] = [];

    for (const target of apps) {
      // Derive watch dir from entryPoint (e.g. "./src/my-app/worker.ts" → "<root>/src/my-app")
      const entryRel = target.entryPoint.replace(/^\.\//, "");
      const entryDir = entryRel.includes("/")
        ? entryRel.substring(0, entryRel.lastIndexOf("/"))
        : entryRel;
      const appDir = `${this.projectRoot}/${entryDir}`;

      try {
        await Deno.stat(appDir);
        watchDirs.push(appDir);
      } catch {
        // Directory doesn't exist, skip
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
        templatesConfig: settings.templatesConfig,
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
        templatesConfig: settings.templatesConfig,
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
    apps: BuildTarget[],
    options: {
      minify: boolean;
      includeCss: boolean;
      debug: boolean;
      importFunctions?: AppImportFn[];
      templatesConfig?: TemplatesConfig[];
    },
  ): void {
    // Collect all source directories to watch
    const watchDirs: string[] = [];

    for (const target of apps) {
      // Derive watch dir from entryPoint (e.g. "./src/my-app/worker.ts" → "<root>/src/my-app")
      const entryRel = target.entryPoint.replace(/^\.\//, "");
      const entryDir = entryRel.includes("/")
        ? entryRel.substring(0, entryRel.lastIndexOf("/"))
        : entryRel;
      const appDir = `${this.projectRoot}/${entryDir}`;

      try {
        const stat = Deno.statSync(appDir);
        if (stat.isDirectory) {
          watchDirs.push(appDir);
        }
      } catch {
        // Directory doesn't exist, skip
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
    apps: BuildTarget[],
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
    for (const target of apps) {
      lines.push(`  - ${target.name} (${target.entryPoint})`);
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
