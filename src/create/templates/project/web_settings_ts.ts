/**
 * Web settings template generator
 *
 * @module @alexi/create/templates/project/web_settings_ts
 */

/**
 * Generate web.settings.ts content for a new project
 */
export function generateWebSettings(name: string): string {
  return `/**
 * ${name} - Web Server Settings
 *
 * Settings for the web server (REST API backend).
 *
 * @module project/web.settings
 */

import {
  loggingMiddleware,
  corsMiddleware,
  errorHandlerMiddleware,
} from "@alexi/middleware";

export { DEBUG, SECRET_KEY, DATABASES, CORS_ORIGINS } from "./settings.ts";
import { CORS_ORIGINS } from "./settings.ts";

// =============================================================================
// Server Configuration
// =============================================================================

export const DEFAULT_HOST = "0.0.0.0";
export const DEFAULT_PORT = 8000;

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
  () => import("@${name}/web"),
];

// =============================================================================
// URL Configuration
// =============================================================================

/**
 * ROOT_URLCONF is an import function that returns the URL patterns module.
 */
export const ROOT_URLCONF = () => import("@${name}/web/urls");

// =============================================================================
// Static Files
// =============================================================================

export const STATIC_URL = "/static/";
export const STATIC_ROOT = "./static";

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
