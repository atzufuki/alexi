/**
 * settings.ts template generator
 *
 * @module @alexi/create/templates/settings
 */

import type { ProjectOptions } from "../project.ts";

/**
 * Generate settings.ts content for a new project
 */
export function generateSettings(name: string, options: ProjectOptions): string {
  const installedApps: string[] = [];
  const appPaths: Record<string, string> = {};

  // Add framework apps
  installedApps.push("alexi_staticfiles");
  appPaths["alexi_staticfiles"] = "jsr:@alexi/staticfiles";

  installedApps.push("alexi_web");
  appPaths["alexi_web"] = "jsr:@alexi/web";

  if (options.database !== "none") {
    installedApps.push("alexi_db");
    appPaths["alexi_db"] = "jsr:@alexi/db";
  }

  if (options.withAuth) {
    installedApps.push("alexi_auth");
    appPaths["alexi_auth"] = "jsr:@alexi/auth";
  }

  if (options.withAdmin) {
    installedApps.push("alexi_admin");
    appPaths["alexi_admin"] = "jsr:@alexi/admin";
  }

  // Add project app
  installedApps.push(name);
  appPaths[name] = `./src/${name}`;

  const installedAppsStr = installedApps.map((app) => `  "${app}",`).join("\n");
  const appPathsStr = Object.entries(appPaths)
    .map(([key, value]) => `  "${key}": "${value}",`)
    .join("\n");

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

export const INSTALLED_APPS = [
${installedAppsStr}
];

export const APP_PATHS: Record<string, string> = {
${appPathsStr}
};

// =============================================================================
// URL Configuration
// =============================================================================

export const ROOT_URLCONF = "${name}";

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
