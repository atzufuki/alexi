/**
 * Shared settings template generator
 *
 * @module @alexi/create/templates/project/settings_ts
 */

/**
 * Generate shared settings.ts content for a new project
 */
export function generateSharedSettings(name: string): string {
  return `/**
 * ${name} - Shared Settings
 *
 * Settings shared across all app configurations.
 *
 * @module project/settings
 */

import { DenoKVBackend } from "@alexi/db/backends/denokv";

// =============================================================================
// Environment
// =============================================================================

export const DEBUG = Deno.env.get("DEBUG") === "true";

export const SECRET_KEY = Deno.env.get("SECRET_KEY") ??
  "development-secret-key-change-in-production";

// =============================================================================
// Database
// =============================================================================

/**
 * Django-style DATABASES configuration.
 * Keys are aliases (e.g. "default"); values are pre-built backend instances.
 * Importing the backend here (not in core) means bundlers can tree-shake
 * server-only code from browser bundles.
 */
export const DATABASES = {
  default: new DenoKVBackend({
    name: "${name}",
    path: Deno.env.get("DENO_KV_PATH"),
  }),
};

// =============================================================================
// CORS
// =============================================================================

export const CORS_ORIGINS = Deno.env.get("CORS_ORIGINS")?.split(",") ?? [
  "http://localhost:8000",
  "http://127.0.0.1:8000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];
`;
}
