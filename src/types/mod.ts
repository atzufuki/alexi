/**
 * Alexi Types
 *
 * Shared type definitions for the Alexi framework.
 */

// =============================================================================
// Target Configuration (DEPRECATED)
// =============================================================================

/**
 * @deprecated Target configuration is deprecated.
 * Use settings modules instead:
 * - project/web.settings.ts
 * - project/desktop.settings.ts
 *
 * The target system has been replaced with Django-style settings modules.
 * Use `deno task dev --settings web` or `deno task dev --settings desktop`.
 */

/**
 * Target types supported by Alexi.
 *
 * Each type has different deployment characteristics:
 * - web: HTTP server deployed to Deno Deploy, Cloudflare, etc.
 * - spa: Static SPA (no server) deployed to CDN, Netlify, Vercel, etc.
 * - desktop: Native-like app using WebUI, packaged as executable
 * - cli: Command-line tool, packaged as single executable
 * - mobile: Future support for mobile platforms
 */
export type TargetType = "web" | "spa" | "desktop" | "cli" | "mobile";

/**
 * Desktop-specific target configuration.
 *
 * Used when target type is "desktop".
 */
export interface DesktopTargetConfig {
  /**
   * Window title shown in the title bar.
   */
  title: string;

  /**
   * Window width in pixels.
   * @default 1280
   */
  width?: number;

  /**
   * Window height in pixels.
   * @default 800
   */
  height?: number;

  /**
   * Preferred browser to use for rendering.
   * @default "any"
   */
  browser?: "chrome" | "firefox" | "edge" | "safari" | "chromium" | "any";

  /**
   * Whether to start in kiosk/fullscreen mode.
   * @default false
   */
  kiosk?: boolean;

  /**
   * Whether to show DevTools on startup (development only).
   * @default false
   */
  devTools?: boolean;

  /**
   * Custom icon path (relative to target directory).
   * @example "./assets/icon.png"
   */
  icon?: string;

  /**
   * Path to WebUI bindings module.
   * Bindings are functions that frontend can call via webui.call().
   * @example "./bindings.ts"
   */
  bindingsModule?: string;

  /**
   * Path to URL patterns module.
   * @example "./urls.ts"
   */
  urlsModule?: string;
}

/**
 * Web-specific target configuration.
 *
 * Used when target type is "web".
 */
export interface WebTargetConfig {
  /**
   * Path to URL patterns module.
   * @example "./urls.ts"
   */
  urlsModule?: string;

  /**
   * Port for development server.
   * @default 8000
   */
  port?: number;

  /**
   * Host for development server.
   * @default "0.0.0.0"
   */
  host?: string;
}

/**
 * SPA-specific target configuration.
 *
 * Used when target type is "spa".
 * SPA targets produce static files (HTML, JS, CSS) that can be deployed
 * to any static hosting service without a server process.
 */
export interface SpaTargetConfig {
  /**
   * External API URL that the SPA will connect to.
   * This is injected into the HTML template at build time.
   * Can also be set via environment variable.
   * @example "https://api.comachine.io"
   */
  apiUrl?: string;

  /**
   * Environment variable name for API URL.
   * If set, the API URL is read from this env var at build time.
   * @default "COMACHINE_API_URL"
   */
  apiUrlEnvVar?: string;

  /**
   * Base path for the SPA (for subdirectory deployments).
   * @example "/app"
   * @default "/"
   */
  basePath?: string;

  /**
   * Whether to generate a 404.html for SPA routing on static hosts.
   * Many static hosts (GitHub Pages, Netlify) use this for client-side routing.
   * @default true
   */
  generate404?: boolean;

  /**
   * Path to index.html file (relative to project root).
   * This file is processed at build time (placeholder replacement)
   * and copied to the output directory.
   * @example "./project/targets/ui/index.html"
   */
  indexHtml?: string;
}

/**
 * CLI-specific target configuration.
 *
 * Used when target type is "cli".
 */
export interface CliTargetConfig {
  /**
   * Path to commands module.
   * @example "./commands.ts"
   */
  commandsModule?: string;

  /**
   * Name of the CLI executable.
   * @example "comachine"
   */
  binName?: string;
}

/**
 * Build output configuration.
 */
export interface TargetOutputConfig {
  /**
   * Output directory for build artifacts.
   * Path is relative to project root.
   * @example "./dist/web"
   */
  dir: string;

  /**
   * Executable names per platform (desktop/cli targets).
   */
  executable?: {
    windows?: string;
    macos?: string;
    linux?: string;
  };
}

/**
 * Target configuration.
 *
 * A target represents a deployment unit - something that can be built
 * and deployed independently. A project can have multiple targets
 * (e.g., web app, desktop app, CLI tool) that share common apps.
 *
 * @example Web target
 * ```ts
 * const config: TargetConfig = {
 *   name: "comachine-web",
 *   type: "web",
 *   apps: ["comachine-api", "comachine-ui"],
 *   web: {
 *     urlsModule: "./urls.ts",
 *     port: 8000,
 *   },
 * };
 * ```
 *
 * @example Desktop target
 * ```ts
 * const config: TargetConfig = {
 *   name: "comachine-desktop",
 *   type: "desktop",
 *   apps: ["comachine-api", "comachine-ui"],
 *   desktop: {
 *     title: "CoMachine",
 *     width: 1400,
 *     height: 900,
 *     bindingsModule: "./bindings.ts",
 *   },
 * };
 * ```
 */
export interface TargetConfig {
  /**
   * Target name. Must be unique within the project.
   * @example "comachine-web"
   */
  name: string;

  /**
   * Target type.
   */
  type: TargetType;

  /**
   * List of app names that belong to this target.
   * Apps are loaded in order (first app's static files take precedence).
   * @example ["comachine-api", "comachine-ui"]
   */
  apps: string[];

  /**
   * Entry point file for the target.
   * Path is relative to target directory.
   * @example "./main.ts"
   */
  entrypoint?: string;

  /**
   * Build output configuration.
   */
  output?: TargetOutputConfig;

  /**
   * Extend another target's configuration.
   * The extended target's apps and settings are inherited.
   * @example "web" - extends targets/web/target.ts
   */
  extends?: string;

  /**
   * Web-specific configuration.
   * Only used when type is "web".
   */
  web?: WebTargetConfig;

  /**
   * Desktop-specific configuration.
   * Only used when type is "desktop".
   */
  desktop?: DesktopTargetConfig;

  /**
   * CLI-specific configuration.
   * Only used when type is "cli".
   */
  cli?: CliTargetConfig;

  /**
   * SPA-specific configuration.
   * Only used when type is "spa".
   */
  spa?: SpaTargetConfig;

  /**
   * Additional settings that override project/settings.ts.
   * Merged with project settings when this target is active.
   */
  settings?: Record<string, unknown>;

  /**
   * Path to target-specific settings module.
   * This module exports settings that override project/settings.ts.
   * Path is relative to the target directory.
   * @example "./settings.ts"
   */
  settingsModule?: string;
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
}
