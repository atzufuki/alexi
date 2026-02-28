/**
 * Alexi Configuration Loader
 *
 * Django-style configuration loading.
 * Reads settings module and initializes the project automatically.
 *
 * @module @alexi/core/config
 */

import { setup } from "./setup.ts";
import type { DatabasesConfig } from "./setup.ts";
import { Application } from "./application.ts";
import { path } from "@alexi/urls";
import type { URLPattern } from "@alexi/urls";
import type { Middleware } from "@alexi/middleware";
import type { AppConfig } from "@alexi/types";

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Convert a file path to a file:// URL string for dynamic import.
 *
 * This is an internal helper for loading project-local settings files.
 * It handles Windows paths correctly.
 *
 * NOTE: This is only used for settings files (loaded via --settings CLI arg).
 * App modules use import functions provided by the user in settings.
 *
 * @param filePath - File system path
 * @returns file:// URL string suitable for dynamic import
 * @internal
 */
function toImportUrl(filePath: string): string {
  // Normalize backslashes to forward slashes
  let normalized = filePath.replace(/\\/g, "/");

  // Remove leading ./ if present
  if (normalized.startsWith("./")) {
    normalized = normalized.slice(2);
  }

  // Check if it's a Windows absolute path (e.g., C:/...)
  if (/^[a-zA-Z]:\//.test(normalized)) {
    return `file:///${normalized}`;
  }

  // Check if it's a Windows path without forward slash yet (e.g., C:\...)
  if (/^[a-zA-Z]:/.test(normalized)) {
    return `file:///${normalized}`;
  }

  // Unix absolute path
  if (normalized.startsWith("/")) {
    return `file://${normalized}`;
  }

  // Relative path - make it absolute
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
 * Database configuration (legacy engine-based format)
 */
export interface DatabaseConfig {
  engine: "denokv" | "indexeddb" | "memory";
  name: string;
  path?: string;
}

/**
 * Import function type for apps.
 * User provides these in INSTALLED_APPS to ensure correct import context.
 */
export type AppImportFn = () => Promise<
  { default?: AppConfig; [key: string]: unknown }
>;

/**
 * Import function type for URL patterns.
 * User provides this as ROOT_URLCONF to ensure correct import context.
 */
export type UrlImportFn = () => Promise<
  { urlpatterns?: unknown[]; default?: unknown[] }
>;

/**
 * Loaded settings module
 */
export interface AlexiSettings {
  // Core
  DEBUG: boolean;
  SECRET_KEY?: string;

  // Apps - array of import functions
  INSTALLED_APPS: AppImportFn[];

  // URL Configuration - import function
  ROOT_URLCONF?: UrlImportFn;

  // Database — Django-style named backends dict.
  // Keys are aliases (e.g. "default", "replica"); values are pre-built backend instances.
  // The user imports their chosen backend in settings so bundlers can tree-shake
  // server-only code from browser bundles.
  DATABASES?: DatabasesConfig;

  // Static files
  STATIC_URL: string;
  STATIC_ROOT: string;

  // Server
  DEFAULT_HOST: string;
  DEFAULT_PORT: number;

  // CORS
  CORS_ORIGINS: string[];
  CORS_METHODS?: string[];
  CORS_HEADERS?: string[];

  // Auth
  AUTH_EXCLUDE_PATHS?: string[];

  // Testing
  TEST_PATTERN?: string;

  // Middleware factory
  createMiddleware?: (options: {
    debug: boolean;
  }) => unknown[];
}

/**
 * Server configuration passed to the application
 */
export interface ServerConfig {
  port: number;
  host: string;
  debug: boolean;
  createHmrResponse?: () => Response;
}

/**
 * Loaded app module with config and optional exports
 */
export interface LoadedApp {
  config: AppConfig;
  module: Record<string, unknown>;
}

// =============================================================================
// Global State
// =============================================================================

let _settings: AlexiSettings | null = null;
let _settingsModule: string | null = null;
let _initialized = false;
let _loadedApps: LoadedApp[] = [];

// =============================================================================
// Settings Loading
// =============================================================================

/**
 * Get the settings module path from the settings argument.
 *
 * Supports short names (e.g., "web" → "project/web.settings.ts")
 * or full paths (e.g., "./project/settings.ts").
 *
 * @param settingsArg - Settings name or path
 */
export function getSettingsModulePath(settingsArg?: string): string {
  const settingsName = settingsArg ?? Deno.env.get("ALEXI_SETTINGS_MODULE");

  if (!settingsName) {
    throw new Error(
      "Settings module not specified. Use --settings <name> or set ALEXI_SETTINGS_MODULE.\n" +
        "Examples:\n" +
        "  deno task dev:web      (uses project/web.settings.ts)\n" +
        "  deno task dev:desktop  (uses project/desktop.settings.ts)\n" +
        "  deno task dev:ui       (uses project/ui.settings.ts)",
    );
  }

  // If it's a short name (no path separators), expand to project/*.settings.ts
  if (!settingsName.includes("/") && !settingsName.includes("\\")) {
    return `./project/${settingsName}.settings.ts`;
  }

  return settingsName;
}

/**
 * Load the settings module.
 *
 * @param settingsArg - Settings name or path (e.g., "web", "desktop", "ui")
 */
export async function loadSettings(
  settingsArg?: string,
): Promise<AlexiSettings> {
  const settingsPath = getSettingsModulePath(settingsArg);
  const projectRoot = Deno.cwd();

  try {
    // Resolve to absolute path
    const absolutePath = settingsPath.startsWith("./")
      ? `${projectRoot}/${settingsPath.slice(2)}`
      : settingsPath;

    // Import the settings module using file:// URL
    // This is the only place we need file:// URLs - for loading settings
    const settingsUrl = toImportUrl(absolutePath);
    const module = await import(settingsUrl);

    // Build settings object with defaults
    const settings: AlexiSettings = {
      // Core
      DEBUG: module.DEBUG ?? false,
      SECRET_KEY: module.SECRET_KEY,

      // Apps - must be array of import functions
      INSTALLED_APPS: module.INSTALLED_APPS ?? [],

      // URL Configuration - import function
      ROOT_URLCONF: module.ROOT_URLCONF,

      // Database — Django-style DATABASES dict (optional; user sets it in settings)
      DATABASES: module.DATABASES,

      // Static files
      STATIC_URL: module.STATIC_URL ?? "/static/",
      STATIC_ROOT: module.STATIC_ROOT ?? "./static",

      // Server
      DEFAULT_HOST: module.DEFAULT_HOST ?? "127.0.0.1",
      DEFAULT_PORT: module.DEFAULT_PORT ?? 8000,

      // CORS
      CORS_ORIGINS: module.CORS_ORIGINS ?? [],
      CORS_METHODS: module.CORS_METHODS,
      CORS_HEADERS: module.CORS_HEADERS,

      // Auth
      AUTH_EXCLUDE_PATHS: module.AUTH_EXCLUDE_PATHS,

      // Testing
      TEST_PATTERN: module.TEST_PATTERN,

      // Middleware factory
      createMiddleware: module.createMiddleware,
    };

    _settings = settings;
    _settingsModule = settingsPath;

    return settings;
  } catch (error) {
    throw new Error(
      `Failed to load settings from '${settingsPath}': ${error}`,
    );
  }
}

/**
 * Get the current settings.
 *
 * @throws Error if settings have not been loaded
 */
export function getSettings(): AlexiSettings {
  if (!_settings) {
    throw new Error(
      "Settings not loaded. Call loadSettings() first or specify --settings.",
    );
  }
  return _settings;
}

/**
 * Check if settings have been loaded.
 */
export function isConfigured(): boolean {
  return _settings !== null;
}

/**
 * Get the current settings module path.
 */
export function getSettingsModuleName(): string | null {
  return _settingsModule;
}

// =============================================================================
// App Loading
// =============================================================================

/**
 * Load all installed apps by calling their import functions.
 *
 * This executes the user-provided import functions in INSTALLED_APPS,
 * which ensures imports happen in the user's context (import maps work).
 *
 * @param settings - Settings object (optional, uses global settings if not provided)
 */
export async function loadInstalledApps(
  settings?: AlexiSettings,
): Promise<LoadedApp[]> {
  const config = settings ?? getSettings();
  const apps: LoadedApp[] = [];

  for (const importFn of config.INSTALLED_APPS) {
    try {
      // Call user's import function - this runs in user's context
      const module = await importFn();

      // Get AppConfig from default export
      const appConfig = module.default as AppConfig | undefined;
      if (appConfig) {
        apps.push({
          config: appConfig,
          module: module as Record<string, unknown>,
        });
      }
    } catch (error) {
      console.warn(`Failed to load app: ${error}`);
    }
  }

  _loadedApps = apps;
  return apps;
}

/**
 * Get loaded apps.
 */
export function getLoadedApps(): LoadedApp[] {
  return _loadedApps;
}

// =============================================================================
// URL Pattern Loading
// =============================================================================

/**
 * Load URL patterns from ROOT_URLCONF.
 *
 * ROOT_URLCONF is an import function provided by the user.
 * This ensures the import happens in user's context (import maps work).
 *
 * @param settings - Settings object (optional, uses global settings if not provided)
 */
export async function loadUrlPatterns(
  settings?: AlexiSettings,
): Promise<unknown[]> {
  const config = settings ?? getSettings();

  // Get ROOT_URLCONF import function
  const rootUrlConf = config.ROOT_URLCONF;
  if (!rootUrlConf) {
    console.warn("ROOT_URLCONF not set in settings. No URL patterns loaded.");
    return [];
  }

  if (typeof rootUrlConf !== "function") {
    throw new Error(
      "ROOT_URLCONF must be an import function, e.g.:\n" +
        '  export const ROOT_URLCONF = () => import("@myapp/web/urls");',
    );
  }

  try {
    // Call user's import function - this runs in user's context
    const module = await rootUrlConf();
    const patterns = module.urlpatterns ?? module.default ?? [];
    console.log("✓ Loaded URL patterns from ROOT_URLCONF");
    return patterns;
  } catch (error) {
    throw new Error(`Failed to load URL patterns from ROOT_URLCONF: ${error}`);
  }
}

// =============================================================================
// Database Initialization
// =============================================================================

/**
 * Initialize the database based on settings.
 *
 * Reads `DATABASES` from settings (Django-style named backends dict) and
 * delegates to the core `setup()` function.  If `DATABASES` is not set,
 * the database is skipped (no-op) — useful for apps that don't use a DB.
 */
export async function initializeDatabase(
  settings?: AlexiSettings,
): Promise<void> {
  const config = settings ?? getSettings();

  if (!config.DATABASES) {
    // No database configured — skip silently.
    return;
  }

  await setup({ DATABASES: config.DATABASES });
  console.log("✓ Database initialized");

  _initialized = true;
}

/**
 * Check if the database has been initialized.
 */
export function isDatabaseInitialized(): boolean {
  return _initialized;
}

// =============================================================================
// Application Factory
// =============================================================================

/**
 * Create an Application instance based on settings.
 *
 * This is the Alexi equivalent of Django's get_wsgi_application().
 *
 * @param serverConfig - Server configuration from runserver command
 */
export async function createApplication(
  serverConfig: ServerConfig,
): Promise<Application> {
  // Ensure settings are loaded
  if (!isConfigured()) {
    throw new Error(
      "Settings not loaded. Call loadSettings() before createApplication().",
    );
  }

  const settings = getSettings();

  // Initialize database if not already done
  if (!isDatabaseInitialized()) {
    await initializeDatabase(settings);
  }

  // Load installed apps
  const loadedApps = await loadInstalledApps(settings);

  // Load URL patterns from ROOT_URLCONF
  let urlpatterns = await loadUrlPatterns(settings);

  // Add HMR endpoint if provided (development only)
  if (serverConfig.createHmrResponse) {
    urlpatterns = [
      path("hmr", () => serverConfig.createHmrResponse!(), {
        name: "hmr",
        methods: ["GET"],
      }),
      ...urlpatterns,
    ];
  }

  // Create middleware
  let middleware: unknown[] = [];
  if (settings.createMiddleware) {
    middleware = settings.createMiddleware({
      debug: serverConfig.debug,
    });
  }

  // Create application
  const app = new Application({
    urls: urlpatterns as URLPattern[],
    middleware: middleware as Middleware[],
    debug: serverConfig.debug,
  });

  // Log configuration
  console.log("");
  console.log("App Configuration:");
  console.log(
    `  Loaded apps: ${loadedApps.map((a) => a.config.name).join(", ")}`,
  );
  console.log("");

  return app;
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Configure Alexi from settings module.
 *
 * This is the main entry point for Alexi configuration.
 * Similar to Django's django.setup().
 *
 * @param settingsArg - Settings name or path (e.g., "web", "desktop")
 */
export async function configure(settingsArg?: string): Promise<void> {
  // Load settings
  await loadSettings(settingsArg);

  // Initialize database
  await initializeDatabase();

  // Load installed apps
  await loadInstalledApps();
}

/**
 * Reset configuration (for testing).
 */
export function resetConfiguration(): void {
  _settings = null;
  _settingsModule = null;
  _initialized = false;
  _loadedApps = [];
}
