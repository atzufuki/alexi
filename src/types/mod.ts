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
   * @example "https://api.myapp.io"
   */
  apiUrl?: string;

  /**
   * Environment variable name for API URL.
   * If set, the API URL is read from this env var at build time.
   * @default "MYAPP_API_URL"
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
   * @example "myapp"
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
 *   name: "myapp-web",
 *   type: "web",
 *   apps: ["myapp-api", "myapp-ui"],
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
 *   name: "myapp-desktop",
 *   type: "desktop",
 *   apps: ["myapp-api", "myapp-ui"],
 *   desktop: {
 *     title: "MyApp",
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
   * @example "myapp-web"
   */
  name: string;

  /**
   * Target type.
   */
  type: TargetType;

  /**
   * List of app names that belong to this target.
   * Apps are loaded in order (first app's static files take precedence).
   * @example ["myapp-api", "myapp-ui"]
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
 * Static file bundle configuration for a single entry point.
 *
 * Used in `AppConfig.staticfiles` to declare multiple bundles per app
 * (e.g. a `worker.ts` Service Worker bundle and a `document.ts` DOM bundle).
 *
 * @deprecated Use `ASSETFILES_DIRS` in project settings instead.
 */
export interface StaticfileConfig {
  /**
   * Entrypoint file for bundling.
   * Path is relative to the app's directory.
   *
   * @example "./worker.ts"
   * @example "./document.ts"
   */
  entrypoint: string;

  /**
   * Output file path (including filename), relative to the app's directory.
   *
   * @example "./static/myapp/worker.js"
   * @example "./static/myapp/document.js"
   */
  outputFile: string;

  /**
   * Additional options for the bundler.
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
  };
}

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
 * Bundle configuration for frontend apps.
 */
export interface BundleConfig {
  /**
   * Path to the app directory.
   * If not specified, derived from app name as `./src/${name}`.
   *
   * @example "./src/myapp-ui"
   */
  appPath?: string;

  /**
   * Entrypoint file for bundling.
   * Path is relative to the app's directory.
   *
   * @example "./src/main.ts"
   */
  entrypoint: string;

  /**
   * Output directory for bundled files.
   * Path is relative to the app's directory.
   * This is typically the app's static directory.
   *
   * @example "./static/myapp"
   */
  outputDir: string;

  /**
   * Output filename for the bundled JavaScript.
   *
   * @example "bundle.js"
   */
  outputName: string;

  /**
   * Output filename for CSS (if bundler produces CSS).
   *
   * @example "bundle.css"
   */
  cssOutputName?: string;

  /**
   * Additional options for the bundler.
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
  };
}

/**
 * Project-level desktop settings.
 *
 * These settings are defined in project/desktop.settings.ts and apply
 * when running with `--settings desktop`.
 */
export interface DesktopSettings {
  /**
   * Whether desktop mode is enabled.
   * Set to true in desktop.settings.ts, false/null in web.settings.ts.
   */
  enabled?: boolean;

  /**
   * Window title shown in the title bar.
   *
   * @default Project name from settings
   */
  title?: string;

  /**
   * Window width in pixels.
   *
   * @default 1280
   */
  width?: number;

  /**
   * Window height in pixels.
   *
   * @default 800
   */
  height?: number;

  /**
   * Preferred browser to use.
   *
   * @default "any"
   */
  browser?: "chrome" | "firefox" | "edge" | "safari" | "chromium" | "any";

  /**
   * Whether to start in kiosk/fullscreen mode.
   *
   * @default false
   */
  kiosk?: boolean;

  /**
   * Whether to show DevTools on startup.
   *
   * @default false
   */
  devTools?: boolean;

  /**
   * Custom icon path (relative to project root).
   *
   * @example "./assets/icon.png"
   */
  icon?: string;
}

/**
 * Desktop app configuration using WebUI.
 *
 * When an app has this configuration, the `desktop` command
 * can launch it as a native-like desktop application using
 * the user's web browser.
 */
export interface DesktopConfig {
  /**
   * Window title shown in the title bar.
   *
   * @example "MyApp"
   */
  title: string;

  /**
   * Window width in pixels.
   *
   * @default 1280
   */
  width?: number;

  /**
   * Window height in pixels.
   *
   * @default 800
   */
  height?: number;

  /**
   * Preferred browser to use.
   * If not specified, WebUI will use any available browser.
   *
   * @example "chrome" | "firefox" | "edge" | "any"
   */
  browser?: "chrome" | "firefox" | "edge" | "safari" | "chromium" | "any";

  /**
   * Whether to start the browser in kiosk/fullscreen mode.
   *
   * @default false
   */
  kiosk?: boolean;

  /**
   * Custom icon path (relative to app directory).
   * Used when the app is compiled.
   *
   * @example "./assets/icon.png"
   */
  icon?: string;

  /**
   * Whether to hide the browser's URL bar and navigation.
   * WebUI does this by default in app mode.
   *
   * @default true
   */
  hideNavigation?: boolean;

  /**
   * The SPA app name to serve.
   * This should match an app in INSTALLED_APPS that has bundle config.
   * If not specified, defaults to the first app with bundle config.
   *
   * @example "myapp"
   */
  serveApp?: string;

  /**
   * Port for the embedded HTTP server.
   * If not specified, uses a random available port.
   *
   * @example 8000
   */
  port?: number;

  /**
   * Whether to show DevTools on startup (development only).
   *
   * @default false
   */
  devTools?: boolean;
}

/**
 * App configuration.
 *
 * Django-style app configuration that tells the framework
 * what the app contains and how to handle it.
 *
 * Following Django conventions, `AppConfig` contains only app identity
 * metadata (`name`, `verboseName`, `appPath`).  Build and file-serving
 * configuration now lives in project settings:
 * - `ASSETFILES_DIRS` — TypeScript source directories for the bundler
 * - `STATICFILES_DIRS` — additional static file directories for collectstatic
 *
 * Per-app static files are auto-discovered by convention from
 * `<appPath>/static/` (like Django's `AppDirectoriesFinder`), and templates
 * from `<appPath>/templates/` at `runserver` time.
 */
export interface AppConfig {
  /**
   * App name. Must match the name in INSTALLED_APPS.
   *
   * @example "myapp"
   */
  name: string;

  /**
   * Human-readable name for the app.
   *
   * @example "MyApp Frontend"
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
   * Path is relative to the project root.
   *
   * @example "./src/myapp"
   * @example "file:///path/to/package"
   */
  appPath?: string;

  /**
   * Frontend bundle configuration.
   * If defined, the `bundle` command will compile TypeScript → JavaScript.
   *
   * @deprecated Use `ASSETFILES_DIRS` in project settings instead.
   */
  bundle?: BundleConfig;

  /**
   * Multiple frontend bundle entry points.
   *
   * Use this instead of `bundle` when an app produces more than one JS output
   * (e.g. a browser app with a `worker.ts` Service Worker entry and a
   * `document.ts` DOM entry).  Each item is bundled independently.
   *
   * @deprecated Use `ASSETFILES_DIRS` in project settings instead.
   *
   * @example
   * staticfiles: [
   *   { entrypoint: "./worker.ts",   outputFile: "./static/myapp/worker.js" },
   *   { entrypoint: "./document.ts", outputFile: "./static/myapp/document.js" },
   * ]
   */
  staticfiles?: StaticfileConfig[];

  /**
   * Static files directory.
   * These files are copied to STATIC_ROOT by the collectstatic command.
   *
   * @deprecated Static file discovery is now convention-based (`<appPath>/static/`).
   * Extra directories can be registered via `STATICFILES_DIRS` in project settings.
   *
   * Can be either:
   * - A path relative to the app's `src/<name>/` directory: `"static"`
   * - An absolute `file://` URL derived from `import.meta.url` (recommended
   *   for published packages so the path resolves correctly regardless of
   *   whether the package is installed from JSR, npm, or a local path):
   *
   * @example
   * // Absolute URL (published packages — works in JSR cache, local dev, etc.)
   * staticDir: new URL("./static/", import.meta.url).href
   */
  staticDir?: string;

  /**
   * URL patterns module.
   * Path to a module that exports URL patterns.
   * Path is relative to the app's directory.
   *
   * @example "./urls.ts"
   */
  urlsModule?: string;

  /**
   * Models module.
   * Path to a module that exports database models.
   * Path is relative to the app's directory.
   *
   * @example "./models/mod.ts"
   */
  modelsModule?: string;

  /**
   * Desktop app configuration.
   * If defined, the `desktop` command can launch this app
   * as a desktop application using WebUI.
   */
  desktop?: DesktopConfig;

  /**
   * Management commands provided by this app.
   * Path to a module that exports command classes.
   * Path is relative to the app's directory.
   *
   * @example "./commands/mod.ts"
   */
  commandsModule?: string;

  /**
   * Import function for loading commands module.
   *
   * This is the preferred way to load commands - it runs in the app's
   * context so import maps work correctly.
   *
   * @example () => import("./commands/mod.ts")
   */
  commandsImport?: () => Promise<Record<string, unknown>>;

  /**
   * Template directory for this app.
   *
   * @deprecated Template discovery is now convention-based (`<appPath>/templates/`)
   * at `runserver` time, and `templatesDir` in `ASSETFILES_DIRS` is used for
   * bundle-time SW template embedding.
   *
   * Django-style namespacing: a template named `"my-app/note_list.html"`
   * should live at `<templatesDir>/my-app/note_list.html`.
   *
   * Can be either:
   * - A path relative to the project root: `"src/my-app/templates"`
   * - An absolute `file://` URL (recommended for published packages):
   *   `new URL("./templates/", import.meta.url).href`
   *
   * @example
   * // Absolute URL (published packages)
   * templatesDir: new URL("./templates/", import.meta.url).href
   */
  templatesDir?: string;
}
