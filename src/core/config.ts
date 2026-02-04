/**
 * Alexi Configuration Loader
 *
 * Django-tyylinen konfiguraation lataus.
 * Lukee settings-moduulin ja alustaa projektin automaattisesti.
 *
 * @module @alexi/management/config
 */

import { setup } from "@alexi/db";
import { DenoKVBackend } from "@alexi/db/backends/denokv";
import { Application } from "./application.ts";
import { path } from "@alexi/urls";
import type { URLPattern } from "@alexi/urls";
import type { Middleware } from "@alexi/middleware";

// =============================================================================
// Types
// =============================================================================

/**
 * Database configuration
 */
export interface DatabaseConfig {
  engine: "denokv" | "indexeddb" | "memory";
  name: string;
  path?: string;
}

/**
 * Loaded settings module
 */
export interface AlexiSettings {
  // Core
  DEBUG: boolean;
  SECRET_KEY?: string;

  // Apps
  INSTALLED_APPS: string[];
  APP_PATHS: Record<string, string>;

  // Database
  DATABASE: DatabaseConfig;

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

  // URL Configuration (Django-style ROOT_URLCONF)
  ROOT_URLCONF?: string;

  // Middleware factory
  createMiddleware?: (options: {
    debug: boolean;
    installedApps: string[];
    appPaths: Record<string, string>;
  }) => unknown[];

  // URL patterns (legacy, prefer ROOT_URLCONF)
  urlpatterns?: unknown[];
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

// =============================================================================
// Global State
// =============================================================================

let _settings: AlexiSettings | null = null;
let _settingsModule: string | null = null;
let _initialized = false;

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

    // Import the settings module
    const module = await import(`file://${absolutePath}`);

    // Build settings object with defaults
    const settings: AlexiSettings = {
      // Core
      DEBUG: module.DEBUG ?? false,
      SECRET_KEY: module.SECRET_KEY,

      // Apps
      INSTALLED_APPS: module.INSTALLED_APPS ?? [],
      APP_PATHS: module.APP_PATHS ?? {},

      // Database
      DATABASE: module.DATABASE ?? {
        engine: "denokv",
        name: "alexi",
      },

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

      // URL Configuration
      ROOT_URLCONF: module.ROOT_URLCONF,

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
// URL Pattern Loading
// =============================================================================

/**
 * Load URL patterns from the ROOT_URLCONF app.
 *
 * Django-style URL loading:
 * 1. Look up ROOT_URLCONF in settings
 * 2. Find the app path in APP_PATHS
 * 3. Import urls.ts from that app
 * 4. Return urlpatterns export
 *
 * @param settings - Settings object (optional, uses global settings if not provided)
 */
export async function loadUrlPatterns(
  settings?: AlexiSettings,
): Promise<unknown[]> {
  const config = settings ?? getSettings();
  const projectRoot = Deno.cwd();

  // Get ROOT_URLCONF from settings
  const rootUrlConf = config.ROOT_URLCONF;
  if (!rootUrlConf) {
    console.warn("ROOT_URLCONF not set in settings. No URL patterns loaded.");
    return [];
  }

  // Get app path
  const appPath = config.APP_PATHS[rootUrlConf];
  if (!appPath) {
    throw new Error(
      `ROOT_URLCONF '${rootUrlConf}' not found in APP_PATHS. ` +
        `Available apps: ${Object.keys(config.APP_PATHS).join(", ")}`,
    );
  }

  // Construct urls.ts path
  const urlsPath = appPath.startsWith("./")
    ? `${projectRoot}/${appPath.slice(2)}/urls.ts`
    : `${projectRoot}/${appPath}/urls.ts`;

  try {
    const module = await import(`file://${urlsPath}`);

    // Support both named export and default export
    const patterns = module.urlpatterns ?? module.default ?? [];

    console.log(`✓ Loaded URL patterns from ${rootUrlConf}/urls.ts`);
    return patterns;
  } catch (error) {
    throw new Error(
      `Failed to load URL patterns from '${urlsPath}': ${error}`,
    );
  }
}

// =============================================================================
// Database Initialization
// =============================================================================

/**
 * Initialize the database based on settings.
 */
export async function initializeDatabase(
  settings?: AlexiSettings,
): Promise<void> {
  const config = settings ?? getSettings();

  switch (config.DATABASE.engine) {
    case "denokv": {
      const backend = new DenoKVBackend({
        name: config.DATABASE.name,
        path: config.DATABASE.path,
      });
      await backend.connect();
      setup({ backend });
      console.log(`✓ Database initialized (${config.DATABASE.engine})`);
      break;
    }

    case "indexeddb": {
      // Dynamic import for browser environments
      const { IndexedDBBackend } = await import("@alexi/db/backends/indexeddb");
      const backend = new IndexedDBBackend({
        name: config.DATABASE.name,
      });
      await backend.connect();
      setup({ backend });
      console.log(`✓ Database initialized (${config.DATABASE.engine})`);
      break;
    }

    case "memory": {
      // For testing - use IndexedDB with random name
      const { IndexedDBBackend } = await import("@alexi/db/backends/indexeddb");
      const backend = new IndexedDBBackend({
        name: `test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      });
      await backend.connect();
      setup({ backend });
      console.log(`✓ Database initialized (memory)`);
      break;
    }

    default:
      throw new Error(`Unknown database engine: ${config.DATABASE.engine}`);
  }

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
      installedApps: settings.INSTALLED_APPS,
      appPaths: settings.APP_PATHS,
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
  console.log(`URL Configuration (${settings.ROOT_URLCONF}/urls.ts):`);

  // List installed apps
  const appsList = settings.INSTALLED_APPS.join(", ");
  console.log(`  Installed apps: ${appsList}`);
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
}

/**
 * Reset configuration (for testing).
 */
export function resetConfiguration(): void {
  _settings = null;
  _settingsModule = null;
  _initialized = false;
}
