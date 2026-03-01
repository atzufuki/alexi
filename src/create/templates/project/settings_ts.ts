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
  return `/**
 * ${name} - Project Settings
 *
 * All project configuration in one file.
 *
 * @module project/settings
 */

import { DenoKVBackend } from "@alexi/db/backends/denokv";
import {
  loggingMiddleware,
  corsMiddleware,
  errorHandlerMiddleware,
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
  () => import("@${name}/workers"),
];

// =============================================================================
// URL Configuration
// =============================================================================

/**
 * ROOT_URLCONF is an import function that returns the URL patterns module.
 */
export const ROOT_URLCONF = () => import("@${name}/urls.ts");

// =============================================================================
// Static Files
// =============================================================================

export const STATIC_URL = "/static/";
export const STATIC_ROOT = "./static";

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
`;
}
