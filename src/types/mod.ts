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
 * Bundle configuration for frontend apps.
 */
export interface BundleConfig {
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
   * @example "./static/comachine"
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
   * @example "CoMachine"
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
   * @example "comachine"
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
 */
export interface AppConfig {
  /**
   * App name. Must match the name in INSTALLED_APPS.
   *
   * @example "comachine"
   */
  name: string;

  /**
   * Human-readable name for the app.
   *
   * @example "CoMachine Frontend"
   */
  verboseName?: string;

  /**
   * Frontend bundle configuration.
   * If defined, the `bundle` command will compile TypeScript → JavaScript.
   */
  bundle?: BundleConfig;

  /**
   * Static files directory.
   * These files are copied to STATIC_ROOT by the collectstatic command.
   * Path is relative to the app's directory.
   *
   * @example "./static"
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
}
