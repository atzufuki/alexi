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

// =============================================================================
// Environment
// =============================================================================

export const DEBUG = Deno.env.get("DEBUG") === "true";

export const SECRET_KEY = Deno.env.get("SECRET_KEY") ??
  "development-secret-key-change-in-production";

// =============================================================================
// Database
// =============================================================================

export const DATABASE = {
  engine: "denokv" as const,
  name: "${name}",
  path: Deno.env.get("DENO_KV_PATH"),
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
