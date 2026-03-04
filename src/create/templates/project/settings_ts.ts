/**
 * Settings template generator
 *
 * @module @alexi/create/templates/project/settings_ts
 */

/**
 * Generate settings.ts content for a new project
 *
 * This is the single settings file for the project, containing all
 * configuration: database, server, installed apps, URL routing,
 * static files, and middleware.
 */
export function generateSettings(name: string): string {
  return _generateSettingsContent(name);
}

/**
 * Generate production.ts content for a new project.
 *
 * This file is intended for running management commands locally against a
 * production Deno Deploy KV database. It reads secrets from environment
 * variables only — never from insecure fallback values.
 *
 * Usage:
 * ```
 * # .env.production.local (never commit this file)
 * DENO_KV_ACCESS_TOKEN=<token from Deno Deploy dashboard>
 * DENO_KV_URL=https://api.deno.com/databases/<uuid>/connect
 * SECRET_KEY=<your production secret key>
 * CORS_ORIGINS=https://example.com
 *
 * deno run -A --unstable-kv --env-file .env.production.local manage.ts createsuperuser --settings ./project/production.ts
 * ```
 */
export function generateProductionSettings(name: string): string {
  return _generateProductionSettingsContent(name);
}

function _generateSettingsContent(name: string): string {
  return (
    `/**
 * ${name} - Project Settings
 *
 * All project configuration in one file.
 *
 * @module project/settings
 */

import { DenoKVBackend } from "@alexi/db/backends/denokv";
import {
  corsMiddleware,
  errorHandlerMiddleware,
  loggingMiddleware,
} from "@alexi/middleware";

// =============================================================================
// Environment
// =============================================================================

export const DEBUG = Deno.env.get("DEBUG") === "true";

export const SECRET_KEY = Deno.env.get("SECRET_KEY") ??
  "development-secret-key-change-in-production";

// =============================================================================
// Server Configuration
// =============================================================================

export const DEFAULT_HOST = "0.0.0.0";
export const DEFAULT_PORT = 8000;

// =============================================================================
// Database
// =============================================================================

/**
 * Django-style DATABASES configuration.
 * Keys are aliases (e.g. "default"); values are pre-built backend instances.
 */
export const DATABASES = {
  default: new DenoKVBackend({
    name: "${name}",
    path: Deno.env.get("DENO_KV_PATH"),
  }),
};

// =============================================================================
// Installed Apps
// =============================================================================

/**
 * INSTALLED_APPS contains import functions for each app.
 *
 * Using import functions ensures the import happens in this module's context,
 * so import maps defined in deno.jsonc work correctly.
 */
export const INSTALLED_APPS = [
  () => import("@alexi/staticfiles"),
  () => import("@alexi/web"),
  () => import("@alexi/db"),
  () => import("@alexi/restframework"),
  () => import("@${name}/mod.ts"),
];

// =============================================================================
// URL Configuration
// =============================================================================

/**
 * ROOT_URLCONF is an import function that returns the URL patterns module.
 */
export const ROOT_URLCONF = () => import("@${name}/urls.ts");

// =============================================================================
// Templates
// =============================================================================

/**
 * Django-style TEMPLATES configuration.
 * APP_DIRS: true auto-discovers <appPath>/templates/ for all INSTALLED_APPS.
 * DIRS: explicit extra template directories (e.g. worker/SW templates).
 *
 * See: https://docs.djangoproject.com/en/5.2/ref/settings/#templates
 */
export const TEMPLATES = [
  {
    APP_DIRS: true,
    DIRS: [
      // Shared templates used by both the server and the Service Worker.
      // Nested deeper than the app root, so APP_DIRS alone cannot discover them.
      "./src/${name}/templates",
    ],
  },
];

// =============================================================================
// Static Files
// =============================================================================

export const STATIC_URL = "/static/";
export const STATIC_ROOT = "./static";

/**
 * Explicit extra static file directories to serve / collect.
 * Each entry is a path relative to the project root (or an absolute path).
 * Convention-based <appPath>/static/ directories are discovered automatically.
 */
export const STATICFILES_DIRS: string[] = [];

/**
 * Frontend asset bundles to build.
 * Each entry specifies a source directory, output directory, and entry points.
 * The output filename matches the entrypoint filename (e.g. "worker.ts" → "worker.js").
 */
export const ASSETFILES_DIRS = [
  {
    // Service Worker bundle: workers/${name}/worker.ts → static/${name}/worker.js
    path: "./src/${name}/workers/${name}",
    outputDir: "./src/${name}/static/${name}",
    entrypoints: ["worker.ts"],
    templatesDir: "./src/${name}/templates",
  },
  {
    // Frontend bundle: assets/${name}/${name}.ts → static/${name}/${name}.js
    // Content-hash cache busting: output becomes ${name}-<hash>.js
    path: "./src/${name}/assets/${name}",
    outputDir: "./src/${name}/static/${name}",
    entrypoints: ["${name}.ts"],
    options: { entryNames: "[name]-[hash]" },
  },
];

// =============================================================================
// CORS
// =============================================================================

export const CORS_ORIGINS = Deno.env.get("CORS_ORIGINS")?.split(",") ?? [
  "http://localhost:8000",
  "http://127.0.0.1:8000",
];

// =============================================================================
// Middleware
// =============================================================================

export function createMiddleware() {
  return [
    loggingMiddleware(),
    corsMiddleware({ origins: CORS_ORIGINS }),
    errorHandlerMiddleware(),
  ];
}
`
  );
}

function _generateProductionSettingsContent(name: string): string {
  return (
    `/**
 * ${name} - Production Settings
 *
 * Use this settings file to run management commands locally against your
 * production Deno Deploy KV database. Reads all secrets from environment
 * variables — never falls back to insecure defaults.
 *
 * Setup:
 *   1. Create .env.production.local (this file is git-ignored)
 *   2. Add the following variables:
 *
 *      DENO_KV_ACCESS_TOKEN=<token from Deno Deploy dashboard>
 *      DENO_KV_URL=https://api.deno.com/databases/<uuid>/connect
 *      SECRET_KEY=<your production secret key>
 *      CORS_ORIGINS=https://example.com
 *
 *   3. Run management commands with:
 *
 *      deno run -A --unstable-kv --env-file .env.production.local manage.ts <command> --settings ./project/production.ts
 *
 * Examples:
 *   deno run -A --unstable-kv --env-file .env.production.local manage.ts createsuperuser --settings ./project/production.ts
 *
 * @module project/production
 */

import { DenoKVBackend } from "@alexi/db/backends/denokv";
import {
  corsMiddleware,
  errorHandlerMiddleware,
  loggingMiddleware,
} from "@alexi/middleware";

// =============================================================================
// Environment
// =============================================================================

export const DEBUG = false;

/**
 * Production secret key — must be set via SECRET_KEY environment variable.
 * Never hard-code this value or commit it to version control.
 */
export const SECRET_KEY = Deno.env.get("SECRET_KEY")!;

// =============================================================================
// Server Configuration
// =============================================================================

export const DEFAULT_HOST = "0.0.0.0";
export const DEFAULT_PORT = 8000;

// =============================================================================
// Database
// =============================================================================

/**
 * Production database connects to Deno Deploy KV via remote URL.
 *
 * DENO_KV_URL:          The remote database URL from Deno Deploy dashboard.
 * DENO_KV_ACCESS_TOKEN: Auth token — picked up automatically by the Deno runtime.
 *
 * Both values can be found at: https://console.deno.com → your app → KV → Connect
 */
export const DATABASES = {
  default: new DenoKVBackend({
    name: "${name}",
    url: Deno.env.get("DENO_KV_URL"),
  }),
};

// =============================================================================
// Installed Apps
// =============================================================================

/**
 * INSTALLED_APPS contains import functions for each app.
 *
 * Using import functions ensures the import happens in this module's context,
 * so import maps defined in deno.jsonc work correctly.
 */
export const INSTALLED_APPS = [
  () => import("@alexi/staticfiles"),
  () => import("@alexi/web"),
  () => import("@alexi/db"),
  () => import("@alexi/restframework"),
  () => import("@${name}/mod.ts"),
];

// =============================================================================
// URL Configuration
// =============================================================================

/**
 * ROOT_URLCONF is an import function that returns the URL patterns module.
 */
export const ROOT_URLCONF = () => import("@${name}/urls.ts");

// =============================================================================
// Templates
// =============================================================================

export const TEMPLATES = [
  {
    APP_DIRS: true,
    DIRS: [
      "./src/${name}/templates",
    ],
  },
];

// =============================================================================
// Static Files
// =============================================================================

export const STATIC_URL = "/static/";
export const STATIC_ROOT = "./static";

export const STATICFILES_DIRS: string[] = [];

export const ASSETFILES_DIRS = [
  {
    path: "./src/${name}/workers/${name}",
    outputDir: "./src/${name}/static/${name}",
    entrypoints: ["worker.ts"],
    templatesDir: "./src/${name}/templates",
  },
  {
    path: "./src/${name}/assets/${name}",
    outputDir: "./src/${name}/static/${name}",
    entrypoints: ["${name}.ts"],
    options: { entryNames: "[name]-[hash]" },
  },
];

// =============================================================================
// CORS
// =============================================================================

export const CORS_ORIGINS = Deno.env.get("CORS_ORIGINS")?.split(",") ?? [];

// =============================================================================
// Middleware
// =============================================================================

export function createMiddleware() {
  return [
    loggingMiddleware(),
    corsMiddleware({ origins: CORS_ORIGINS }),
    errorHandlerMiddleware(),
  ];
}
`
  );
}
