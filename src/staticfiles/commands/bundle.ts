/**
 * Bundle Command for Alexi Static Files
 *
 * Django-style command that bundles TypeScript frontends to JavaScript.
 * Reads ASSETFILES_DIRS from project settings to find build targets.
 *
 * Uses esbuild with code-splitting for lazy-loading templates.
 *
 * Template embedding:
 * When bundling a Service Worker, all installed apps' `templates/` directories
 * are scanned recursively (via the TEMPLATES setting with APP_DIRS: true) and
 * their `.html` files are embedded into the bundle via a virtual esbuild
 * module. This populates `templateRegistry` at runtime so that `templateView`
 * works without filesystem access inside a Service Worker.
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
  TemplatesConfig,
} from "@alexi/types";
import type * as esbuild from "esbuild";
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
 * A normalised build target derived from ASSETFILES_DIRS project settings.
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
  /**
   * esbuild `entryNames` pattern for the output filename.
   * When it contains `[hash]`, a `staticfiles.json` manifest is written.
   * Service Worker entries always use `[name]`, ignoring this option.
   */
  entryNames?: string;
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
 * Collect templates using the Django-style TEMPLATES setting.
 *
 * When `APP_DIRS: true`, auto-discovers `<appPath>/templates/` for each
 * installed app.  `DIRS` entries add explicit extra directories.
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
 * Return `true` when the given output filename looks like a Service Worker.
 *
 * Matches: `worker.js`, `sw.js`, `service-worker.js`, `my_worker.js`,
 * `app.worker.js`, etc. — any filename that contains "worker" or equals "sw".
 *
 * @internal Exported for testing only.
 */
export function isServiceWorkerFilename(filename: string): boolean {
  const base = filename.replace(/\.js$/, "").toLowerCase();
  return base === "sw" || base.includes("worker");
}

/**
 * Manifest format written to `staticfiles.json` in the output directory.
 *
 * ```json
 * {
 *   "version": 1,
 *   "files": {
 *     "my-project/document.js": "my-project/document-a1b2c3d4.js"
 *   }
 * }
 * ```
 *
 * Keys are the un-hashed logical filenames (relative to the static root).
 * Values are the actual hashed filenames on disk.
 *
 * @internal Exported for testing only.
 */
export interface StaticFilesManifest {
  version: 1;
  files: Record<string, string>;
}

/**
 * Read, merge, and write the `staticfiles.json` manifest in `outputDir`.
 *
 * The manifest maps un-hashed entry filenames (e.g. `my-app/document.js`)
 * to their hashed equivalents (e.g. `my-app/document-a1b2c3d4.js`).
 * Existing entries that are no longer produced by the current build are kept
 * (they may belong to other entry points in the same outputDir).
 *
 * @param outputDir  - Absolute path to the output directory
 * @param newEntries - New filename mappings to merge into the manifest
 *
 * @internal Exported for testing only.
 */
export async function writeManifest(
  outputDir: string,
  newEntries: Record<string, string>,
): Promise<void> {
  const manifestPath = `${outputDir}/staticfiles.json`;

  // Read existing manifest (if any)
  let existing: StaticFilesManifest = { version: 1, files: {} };
  try {
    const raw = await Deno.readTextFile(manifestPath);
    const parsed = JSON.parse(raw) as StaticFilesManifest;
    if (parsed.version === 1 && typeof parsed.files === "object") {
      existing = parsed;
    }
  } catch {
    // No existing manifest — start fresh
  }

  const merged: StaticFilesManifest = {
    version: 1,
    files: { ...existing.files, ...newEntries },
  };

  await Deno.writeTextFile(manifestPath, JSON.stringify(merged, null, 2));
}

/**
 * Rewrite `.html` files in `outputDir` that reference `unhashed` filename,
 * replacing all occurrences with `hashed`.
 *
 * Only the filename component (basename) is matched, so paths like
 * `/static/my-app/document.js` or `src="document.js"` are both rewritten.
 *
 * @param outputDir - Absolute path to the output directory to scan
 * @param unhashed  - Un-hashed basename (e.g. `document.js`)
 * @param hashed    - Hashed basename (e.g. `document-a1b2c3d4.js`)
 *
 * @internal Exported for testing only.
 */
export async function rewriteHtmlReferences(
  outputDir: string,
  unhashed: string,
  hashed: string,
): Promise<void> {
  let entries: Deno.DirEntry[];
  try {
    entries = [];
    for await (const entry of Deno.readDir(outputDir)) {
      entries.push(entry);
    }
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isFile || !entry.name.endsWith(".html")) continue;
    const filePath = `${outputDir}/${entry.name}`;
    try {
      const content = await Deno.readTextFile(filePath);
      // Replace all occurrences of the bare filename (not the hashed name)
      if (!content.includes(unhashed)) continue;
      const updated = content.replaceAll(unhashed, hashed);
      await Deno.writeTextFile(filePath, updated);
    } catch {
      // Skip unreadable / unwritable files
    }
  }
}

/**
 * Built-in command for bundling TypeScript frontends
 *
 * This command:
 * 1. Reads ASSETFILES_DIRS from project settings
 * 2. Bundles each entry point with esbuild
 * 3. Writes output to the configured output directory
 * 4. Optionally embeds templates into Service Worker bundles
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
 * Default binary asset loaders used by {@link buildSWBundle}.
 *
 * Maps common binary/asset file extensions to esbuild's `"binary"` loader,
 * which emits the raw bytes as a `Uint8Array` — matching Deno's
 * `with { type: "bytes" }` import-attribute semantics.
 *
 * Callers can override individual entries or add new ones via the
 * {@link BuildSWBundleOptions.loaders} option.
 */
export const DEFAULT_ASSET_LOADERS: Record<string, string> = {
  ".png": "binary",
  ".jpg": "binary",
  ".jpeg": "binary",
  ".gif": "binary",
  ".webp": "binary",
  ".ico": "binary",
  ".svg": "binary",
  ".wasm": "binary",
  ".ttf": "binary",
  ".otf": "binary",
  ".woff": "binary",
  ".woff2": "binary",
};

/**
 * Creates an esbuild plugin that intercepts binary asset imports **before**
 * `@luca/esbuild-deno-loader` can reject them as non-ESM modules.
 *
 * ## Why this is necessary
 *
 * `denoPlugins()` registers an `onLoad` hook with a catch-all filter and
 * `namespace: "file"` that intercepts every file-system import.  When it
 * encounters a `.png` (or other binary asset), it calls `deno info` on it,
 * receives `mediaType: "Unknown"`, and then tries to open it as an ESM module
 * — which throws `[unreachable] Not an ESM module.`.
 *
 * The `loader` map passed to `esbuild.build()` only applies to files that
 * esbuild itself loads (i.e. files *not* handled by any plugin).  Because
 * `denoPlugins` hooks in first, the `loader` map is never reached for binary
 * files.
 *
 * This plugin solves the problem by registering its own `onResolve` hook that
 * runs **before** `denoPlugins`.  It routes all known binary extensions to a
 * dedicated `"alexi-binary"` namespace, then serves them via a matching
 * `onLoad` hook that reads the raw bytes with `Deno.readFile()` and returns
 * `loader: "binary"` — identical to what esbuild's built-in binary loader
 * produces.  Because the file is already claimed by this plugin's namespace,
 * `denoPlugins` never sees it.
 *
 * @param loaders - Extension-to-loader map (e.g. `DEFAULT_ASSET_LOADERS`).
 *   Only extensions whose loader value is `"binary"` are handled; others are
 *   ignored by this plugin and left for esbuild / denoPlugins to process.
 * @returns An esbuild {@link esbuild.Plugin} ready to be prepended to the
 *   plugins array.
 *
 * @example
 * ```ts
 * plugins.unshift(createBinaryAssetsPlugin(effectiveLoaders));
 * plugins.push(...denoPlugins({ configPath }));
 * ```
 */
export function createBinaryAssetsPlugin(
  loaders: Record<string, string>,
): import("esbuild").Plugin {
  // Build a regex that matches only extensions with loader === "binary".
  const binaryExts = Object.entries(loaders)
    .filter(([, loader]) => loader === "binary")
    .map(([ext]) => ext.replace(".", "\\."));

  // If no binary extensions are configured, return a no-op plugin.
  if (binaryExts.length === 0) {
    return {
      name: "alexi-binary-assets",
      setup(_build) {},
    };
  }

  const filter = new RegExp(`(${binaryExts.join("|")})$`);

  return {
    name: "alexi-binary-assets",
    setup(build) {
      // Intercept all imports whose path ends with a known binary extension.
      // We resolve to an absolute path so that onLoad receives a stable key.
      // On Windows, args.path may already be absolute (e.g. "C:/..."), so we
      // must guard against double-joining with resolveDir.
      build.onResolve({ filter }, (args) => {
        const resolvedPath = isAbsolute(args.path)
          ? args.path
          : join(args.resolveDir, args.path);
        return { path: resolvedPath, namespace: "alexi-binary" };
      });

      // Load the file as raw bytes and hand it back to esbuild with the
      // "binary" loader, which inlines it as a base64-decoded Uint8Array.
      build.onLoad(
        { filter: /.*/, namespace: "alexi-binary" },
        async (args) => ({
          contents: await Deno.readFile(args.path),
          loader: "binary",
        }),
      );
    },
  };
}

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
  /**
   * esbuild `entryNames` pattern for naming the output file.
   *
   * Defaults to `'[name]'` (no hash).  Use `'[name]-[hash]'` to add a
   * content hash for cache busting.
   *
   * When this option contains `[hash]`, the function:
   * 1. Passes the pattern to esbuild so the output filename includes the hash.
   * 2. Parses `result.metafile` to discover the hashed filename.
   * 3. Writes / updates a `staticfiles.json` manifest in the output directory
   *    so that `AppDirectoriesFinder` can resolve hashed filenames at request
   *    time.
   * 4. Rewrites `.html` files in the output directory that reference the
   *    un-hashed entry filename, replacing them with the hashed filename.
   *
   * Service Worker entries (filenames matching `*worker*.js`) always use
   * `[name]` regardless of this option.
   */
  entryNames?: string;
  /**
   * Whether this entry is a Service Worker bundle.
   *
   * When `true`, `entryNames` is ignored and `[name]` is always used.
   */
  isServiceWorker?: boolean;
  /**
   * Additional or override esbuild loader mappings for binary/asset file
   * extensions.
   *
   * These are merged on top of {@link DEFAULT_ASSET_LOADERS}, so you only need
   * to supply the entries you want to add or change.  Setting an extension to
   * `"file"` opts that type out of inline binary embedding.
   *
   * @example
   * ```ts
   * // Treat .mp4 as binary and opt .svg out of the default binary loader
   * loaders: { ".mp4": "binary", ".svg": "file" }
   * ```
   */
  loaders?: Record<string, string>;
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
 *
 * When `entryNames` contains `[hash]` (and the entry is not a Service Worker),
 * the function:
 * 1. Passes the pattern to esbuild to produce a hashed output filename.
 * 2. Parses `result.metafile` to find the hashed filename.
 * 3. Writes / updates a `staticfiles.json` manifest in the output directory.
 * 4. Rewrites HTML files in the output directory that reference the un-hashed
 *    entry filename, replacing them with the hashed filename.
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

  // Lazy-import esbuild and esbuild-deno-loader to prevent these server-only
  // modules from being statically included in browser/worker bundles.
  const esbuild = await import("esbuild");
  const { denoPlugins } = await import("esbuild-deno-loader");

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

  // Determine the effective entryNames pattern:
  // - Service Worker entries always use "[name]" (no fingerprinting).
  // - Otherwise, use the caller-supplied pattern (defaulting to "[name]").
  const isSW = options.isServiceWorker ?? isServiceWorkerFilename(outputName);
  const effectiveEntryNames = isSW
    ? outputName.replace(".js", "")
    : (options.entryNames ?? outputName.replace(".js", ""));
  const useHash = !isSW && effectiveEntryNames.includes("[hash]");

  // Merge default binary asset loaders with any caller-supplied overrides.
  // effectiveLoaders must be computed before building the plugins array because
  // createBinaryAssetsPlugin consumes it to know which extensions to intercept.
  const effectiveLoaders: Record<string, esbuild.Loader> = {
    ...DEFAULT_ASSET_LOADERS,
    ...(options.loaders ?? {}),
  } as Record<string, esbuild.Loader>;

  // alexi-binary-assets MUST be the first plugin in the array so that it runs
  // before @luca/esbuild-deno-loader.  denoPlugins registers an onLoad hook
  // for { filter: /.*/, namespace: "file" } that intercepts every file-system
  // import — including binary files — before esbuild's built-in loader map is
  // ever consulted.  By claiming binary extensions in onResolve here (routing
  // them to the "alexi-binary" namespace) we prevent denoPlugins from ever
  // seeing those files.  See https://github.com/atzufuki/alexi/issues/403.
  const plugins: esbuild.Plugin[] = [
    createBinaryAssetsPlugin(effectiveLoaders),
  ];

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

  let effectiveEntryPoint: string | { in: string; out: string } = entryPoint;
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
    // Name the virtual entry after the original source file so that esbuild
    // derives the correct [name] token when entryNames contains "[name]".
    // Using "__alexi_sw_entry__" here would cause esbuild to produce output
    // like `__alexi_sw_entry__-<hash>.js` instead of `<original>-<hash>.js`.
    // See https://github.com/atzufuki/alexi/issues/399
    //
    // We use esbuild's `{ in, out }` entryPoints form: the `in` value is a
    // uniquely-prefixed virtual path (preventing filesystem collisions with a
    // real file of the same name in absWorkingDir) while `out` is the bare
    // original stem, which esbuild substitutes for [name] in entryNames.
    const originalBasename = entryPoint
      .replace(/^.*[\\/]/, "") // strip directory (works for both paths and file:// URLs)
      .replace(/\.[^.]+$/, "") // strip extension
      .replace(/[^a-zA-Z0-9_\-]/g, "_"); // sanitise for use as a filename
    const virtualEntryIn = `__alexi_virtual__${originalBasename}.ts`;
    const virtualEntryNamespace = "alexi-sw-entry-virtual";

    plugins.unshift({
      name: "alexi-sw-entry",
      setup(build) {
        build.onResolve(
          { filter: /^__alexi_virtual__/ },
          (args) => ({
            path: args.path,
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

    effectiveEntryPoint = { in: virtualEntryIn, out: originalBasename };
  }

  const result = await esbuild.build({
    entryPoints: [effectiveEntryPoint] as
      | [string]
      | [{ in: string; out: string }],
    bundle: true,
    splitting: true,
    format: "esm",
    outdir: outputDir,
    entryNames: effectiveEntryNames,
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
    loader: effectiveLoaders,
    // Bound node_modules resolution to the project root so esbuild does not
    // walk up to the filesystem root (e.g. C:\) on Windows.
    absWorkingDir: cwd,
  });

  await esbuild.stop();

  if (result.errors.length > 0) {
    const errorMessages = result.errors.map((e) => e.text).join("\n");
    throw new Error(`Bundle failed: ${errorMessages}`);
  }

  // -------------------------------------------------------------------------
  // Post-build: manifest + HTML rewrite when content hashing is enabled
  // -------------------------------------------------------------------------
  if (useHash && result.metafile) {
    // The metafile outputs map is keyed by the output path relative to cwd.
    // Find the entry output (not chunks) that corresponds to our entry point.
    const outputsRelCwd = Object.keys(result.metafile.outputs);

    // The hashed output file is in outputDir and ends with .js (not a chunk).
    const outputDirNorm = outputDir.replace(/\\/g, "/");
    // Normalise cwd so we can strip it from metafile keys
    const cwdNorm = cwd.replace(/\\/g, "/").replace(/\/$/, "");

    const hashedKey = outputsRelCwd.find((key) => {
      const absKey = key.startsWith("/") || /^[a-zA-Z]:/.test(key)
        ? key.replace(/\\/g, "/")
        : `${cwdNorm}/${key.replace(/\\/g, "/")}`;
      return absKey.startsWith(outputDirNorm) &&
        !absKey.includes("/chunks/") &&
        absKey.endsWith(".js");
    });

    if (hashedKey) {
      // Derive the absolute hashed path
      const hashedAbsPath = hashedKey.startsWith("/") ||
          /^[a-zA-Z]:/.test(hashedKey)
        ? hashedKey.replace(/\\/g, "/")
        : `${cwdNorm}/${hashedKey.replace(/\\/g, "/")}`;

      const hashedFilename = hashedAbsPath.substring(
        hashedAbsPath.lastIndexOf("/") + 1,
      );

      // Build the manifest entry using the un-hashed logical filename
      // (the expected URL consumers would request) mapped to the hashed one.
      // Both keys and values are stored as namespaced paths
      // (e.g. "my-app/document.js" → "my-app/document-a1b2c3d4.js").
      const outputDirBasename = outputDirNorm.substring(
        outputDirNorm.lastIndexOf("/") + 1,
      );
      const logicalKey = `${outputDirBasename}/${outputName}`;
      const hashedValue = `${outputDirBasename}/${hashedFilename}`;

      // Write the manifest one level above outputDir (i.e. the static/ root),
      // because AppDirectoriesFinder reads it from <appDir>/static/staticfiles.json
      // while outputDir is <appDir>/static/<namespace>/.
      const manifestDir = outputDirNorm.substring(
        0,
        outputDirNorm.lastIndexOf("/"),
      );
      await writeManifest(manifestDir || outputDir, {
        [logicalKey]: hashedValue,
      });

      // Rewrite HTML files in outputDir that reference the un-hashed filename
      await rewriteHtmlReferences(outputDir, outputName, hashedFilename);
    }
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
    const settingsArg = (options.args.settings as string | undefined) ??
      Deno.env.get("ALEXI_SETTINGS_MODULE");

    // Skip bundling if SKIP_BUNDLE is set (e.g., in CI)
    if (Deno.env.get("SKIP_BUNDLE") === "1") {
      this.info("Skipping bundling (SKIP_BUNDLE=1)");
      return success();
    }

    // Resolve settings path when --settings or ALEXI_SETTINGS_MODULE is provided
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
   * Build the list of targets to bundle from ASSETFILES_DIRS project settings.
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
          entryNames: entry.options?.entryNames,
        });
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
      }

      const minify = target.minify ?? options.minify;
      this.info(`Bundling ${target.name}...`);
      await this.bundleJS(
        target.entryPoint,
        outputPath,
        minify,
        templates,
        target.entryNames,
      );

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
   *
   * When `entryNames` contains `[hash]` (and the entry is not a Service
   * Worker), a `staticfiles.json` manifest is written to the output directory
   * and HTML files referencing the un-hashed filename are rewritten.
   */
  private async bundleJS(
    entryPoint: string,
    outputPath: string,
    minify: boolean,
    templates: DiscoveredTemplate[] = [],
    entryNames?: string,
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

    await buildSWBundle({
      entryPoint,
      outputPath,
      minify,
      templates,
      entryNames,
    });

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
