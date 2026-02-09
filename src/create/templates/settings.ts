/**
 * settings.ts template generator
 *
 * @module @alexi/create/templates/settings
 */

import type { ProjectOptions } from "../project.ts";

/**
 * Generate settings.ts content for a new project
 *
 * Uses import functions in INSTALLED_APPS for proper import context.
 */
export function generateSettings(
  name: string,
  options: ProjectOptions,
): string {
  // Build INSTALLED_APPS import functions
  const installedApps: string[] = [];

  installedApps.push('  () => import("@alexi/staticfiles")');
  installedApps.push('  () => import("@alexi/web")');

  if (options.database !== "none") {
    installedApps.push('  () => import("@alexi/db")');
  }

  if (options.withAuth) {
    installedApps.push('  () => import("@alexi/auth")');
  }

  if (options.withAdmin) {
    installedApps.push('  () => import("@alexi/admin")');
  }

  // Add project app
  installedApps.push(`  () => import("@${name}/web")`);

  const installedAppsStr = installedApps.join(",\n");

  const databaseConfig = options.database === "none" ? "" : `
// =============================================================================
// Database
// =============================================================================

export const DATABASE = {
  engine: "${options.database}" as const,
  name: "${name}",
  path: Deno.env.get("DENO_KV_PATH"),
};
`;

  const middlewareImports = [
    "loggingMiddleware",
    "corsMiddleware",
    "errorHandlerMiddleware",
  ];

  return `/**
 * ${name} Settings
 *
 * Main settings file for the project.
 *
 * @module project/settings
 */

import {
  ${middlewareImports.join(",\n  ")},
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
${databaseConfig}
// =============================================================================
// Installed Apps
// =============================================================================

/**
 * INSTALLED_APPS contains import functions for each app.
 *
 * Using import functions ensures the import happens in this module's context,
 * so import maps defined in deno.json work correctly.
 */
export const INSTALLED_APPS = [
${installedAppsStr},
];

// =============================================================================
// URL Configuration
// =============================================================================

/**
 * ROOT_URLCONF is an import function that returns the URL patterns module.
 *
 * Using an import function ensures the import happens in this module's context.
 */
export const ROOT_URLCONF = () => import("@${name}/web/urls");

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
