/**
 * Alexi's shared framework type definitions.
 *
 * `@alexi/types` contains lightweight cross-package interfaces used throughout
 * the Alexi ecosystem. It is the place to import framework configuration shapes
 * such as `AppConfig`, template and asset settings, and compatibility types
 * that multiple packages need without pulling in heavier runtime dependencies.
 *
 * Most application authors encounter this package indirectly through settings
 * files and app metadata, while framework and tooling code use it directly to
 * keep package boundaries small and environment-neutral.
 *
 * @module @alexi/types
 *
 * @example Describe an installed app
 * ```ts
 * import type { AppConfig } from "@alexi/types";
 *
 * const config: AppConfig = {
 *   name: "my-app",
 *   verboseName: "My App",
 *   appPath: new URL("./", import.meta.url).href,
 * };
 * ```
 */

// =============================================================================
// App Registration Hooks
// =============================================================================

/**
 * Callback invoked by `_buildApplication()` for every entry in `INSTALLED_APPS`
 * as part of application startup.
 *
 * Higher-layer packages (e.g. `@alexi/staticfiles`) can register a hook here
 * so that they are notified of each installed app without requiring
 * `@alexi/core` to import them directly (which would create a circular
 * dependency).
 *
 * @param appName - The app's `name` field.
 * @param appPath - The resolved app path (absolute path string), or `undefined`
 *                  if the app has no `appPath` configured.
 */
export type AppRegistrationHook = (
  appName: string,
  appPath: string | undefined,
) => void | Promise<void>;

/**
 * Global list of app-registration hooks.
 *
 * Populated at module-load time by packages such as `@alexi/staticfiles`.
 * `_buildApplication()` calls every hook for each installed app.
 *
 * @internal
 */
export const appRegistrationHooks: AppRegistrationHook[] = [];

/**
 * Register a hook to be called for each installed app during startup.
 *
 * @param hook - The callback to register.
 *
 * @example
 * ```ts
 * import { onAppRegistered } from "@alexi/types";
 *
 * onAppRegistered((name, appPath) => {
 *   console.log(`App registered: ${name} at ${appPath}`);
 * });
 * ```
 */
export function onAppRegistered(hook: AppRegistrationHook): void {
  appRegistrationHooks.push(hook);
}

// =============================================================================
// App Configuration
// =============================================================================

/**
 * Configuration for a single asset files directory entry.
 *
 * Replaces `AppConfig.staticfiles` — bundle configuration now lives in
 * project settings, not in individual app configs.
 *
 * Each entry specifies a source directory, one or more TypeScript entry
 * points to compile, and an output directory for the resulting JS files.
 * An optional `templatesDir` may be provided to embed HTML templates into
 * Service Worker bundles at build time.
 *
 * @example
 * ```ts
 * export const ASSETFILES_DIRS = [
 *   {
 *     path: "./src/my-project/workers/my-project",
 *     outputDir: "./src/my-project/static/my-project",
 *     entrypoints: ["worker.ts", "document.ts"],
 *     templatesDir: "./src/my-project/workers/my-project/templates",
 *   },
 * ];
 * ```
 */
export interface AssetfilesDirConfig {
  /**
   * Path to the source directory containing TypeScript entry points.
   * Relative to the project root.
   *
   * @example "./src/my-project/workers/my-project"
   */
  path: string;

  /**
   * Output directory for compiled JS files.
   * Relative to the project root.
   *
   * @example "./src/my-project/static/my-project"
   */
  outputDir: string;

  /**
   * Explicit list of entry point filenames (relative to `path`).
   *
   * @example ["worker.ts", "document.ts"]
   */
  entrypoints: string[];

  /**
   * Path to a templates directory to embed into Service Worker bundles.
   * All `.html` files under this directory are embedded via the virtual
   * `alexi:templates` module so that `templateView` works without filesystem
   * access inside a Service Worker.
   *
   * Relative to the project root, or an absolute `file://` URL.
   *
   * @example "./src/my-project/workers/my-project/templates"
   */
  templatesDir?: string;

  /**
   * Additional bundler options applied to all entry points in this directory.
   */
  options?: {
    /**
     * Enable minification for production builds.
     */
    minify?: boolean;

    /**
     * Enable source maps.
     */
    sourceMaps?: boolean;

    /**
     * External modules that should not be bundled.
     */
    external?: string[];

    /**
     * esbuild `entryNames` pattern for output filenames.
     *
     * Use `'[name]-[hash]'` to add a content hash to the output filename for
     * long-lived cache busting (e.g. `document-a1b2c3d4.js`).
     *
     * When the pattern contains `[hash]`, a `staticfiles.json` manifest is
     * written to `outputDir` after the build so that `AppDirectoriesFinder`
     * can resolve the hashed filenames at request time.
     *
     * Service Worker entries (filenames matching `*worker*.js`) always use
     * `[name]` regardless of this option — the browser's native SW update
     * mechanism (byte-diff on every page load) makes fingerprinting unnecessary.
     *
     * @default "[name]"
     * @example "[name]-[hash]"  → document-a1b2c3d4.js
     */
    entryNames?: string;
  };
}

/**
 * Django-style TEMPLATES setting configuration.
 *
 * Controls how Alexi discovers and loads server-side HTML templates.
 * Mirrors Django's TEMPLATES setting with APP_DIRS and DIRS support.
 *
 * @example
 * // project/settings.ts
 * export const TEMPLATES: TemplatesConfig[] = [
 *   {
 *     APP_DIRS: true,   // auto-discover <appPath>/templates/ for all INSTALLED_APPS
 *     DIRS: [           // additional explicit template directories
 *       "./src/my-project/templates",
 *     ],
 *   },
 * ];
 *
 * @see https://docs.djangoproject.com/en/5.2/ref/settings/#templates
 */
export interface TemplatesConfig {
  /**
   * Whether to automatically discover `<appPath>/templates/` directories
   * for every app in INSTALLED_APPS.
   *
   * When `true`, `runserver` and `bundle` scan each installed app's
   * `<appPath>/templates/` directory and register all `.html` files.
   *
   * @default false
   */
  APP_DIRS?: boolean;

  /**
   * Explicit additional template directories to scan.
   * Each entry is a path relative to the project root, or an absolute path.
   *
   * These directories are scanned regardless of the `APP_DIRS` setting.
   *
   * @example ["./src/my-project/templates", "./templates"]
   */
  DIRS?: string[];
}

/**
 * App configuration.
 *
 * Django-style app configuration that tells the framework what the app is.
 * Mirrors Django's `AppConfig` — only app identity metadata lives here.
 *
 * Build and file-serving configuration belongs in project settings:
 * - `ASSETFILES_DIRS` — TypeScript source directories for the bundler
 * - `STATICFILES_DIRS` — additional static file directories for collectstatic
 * - `TEMPLATES` — template discovery configuration
 *
 * Static files are auto-discovered by convention from `<appPath>/static/`
 * (like Django's `AppDirectoriesFinder`), templates from
 * `<appPath>/templates/`, and management commands from
 * `<appPath>/commands/mod.ts`.
 */
export interface AppConfig {
  /**
   * App name. Must match the import map key / name in INSTALLED_APPS.
   *
   * @example "my-app"
   */
  name: string;

  /**
   * Human-readable name for the app.
   *
   * @example "My App"
   */
  verboseName?: string;

  /**
   * Explicit path to the app's source directory.
   *
   * If not specified, the convention `./src/${name}` is used.
   * Use this when the app's directory doesn't match the convention
   * (e.g. a published package whose static/template dirs are absolute paths).
   *
   * Can be a relative path (resolved against the project root) or an
   * absolute `file://` URL (recommended for published packages).
   *
   * @example "./src/myapp"
   * @example "file:///path/to/package"  // new URL("./", import.meta.url).href
   */
  appPath?: string;

  /**
   * Called once during application startup after all apps have been loaded.
   *
   * Mirrors Django's `AppConfig.ready()`. Use this to perform one-time
   * initialisation that requires other apps to be available — for example,
   * registering signals, configuring third-party libraries, or populating
   * a cache.
   *
   * May be synchronous or asynchronous. Any error thrown here will abort
   * application startup.
   *
   * @example
   * ```ts
   * const config: AppConfig = {
   *   name: "my-app",
   *   async ready() {
   *     await populateCache();
   *   },
   * };
   * ```
   */
  ready?(): Promise<void> | void;
}
