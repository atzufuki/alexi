/**
 * UI settings.ts template generator
 *
 * @module @alexi/create/templates/ui/settings_ts
 */

/**
 * Generate settings.ts content for the UI app
 */
export function generateUiSettingsTs(name: string): string {
  return `/**
 * ${toPascalCase(name)} UI Settings
 *
 * Frontend settings including backend configuration.
 *
 * @module ${name}-ui/settings
 */

import { IndexedDBBackend } from "@alexi/db/backends/indexeddb";
import { RestBackend } from "@alexi/db/backends/rest";
import { SyncBackend } from "@alexi/db/backends/sync";
import { ENDPOINTS } from "@${name}-ui/endpoints.ts";

// =============================================================================
// Environment
// =============================================================================

export const DEBUG = true;

// =============================================================================
// API Configuration
// =============================================================================

/**
 * Get API URL based on environment
 */
function getApiUrl(): string {
  // In production, you might want to use a different URL
  return "http://localhost:8000/api";
}

export const API_URL = getApiUrl();
export const DATABASE_NAME = "${name}";
export const TOKEN_STORAGE_KEY = "${name}_auth_tokens";

// =============================================================================
// Backend Instances
// =============================================================================

/**
 * IndexedDB backend for local storage
 */
export const indexeddb = new IndexedDBBackend({ name: DATABASE_NAME });

/**
 * REST backend for API communication
 */
export const rest = new RestBackend({
  apiUrl: API_URL,
  tokenStorageKey: TOKEN_STORAGE_KEY,
  debug: DEBUG,
  endpoints: ENDPOINTS,
});

/**
 * Sync backend - orchestrates IndexedDB + REST for offline-first
 */
export const sync = new SyncBackend(indexeddb, rest, {
  debug: DEBUG,
  failSilently: true,
});

// =============================================================================
// Named Backends (Django-style DATABASES)
// =============================================================================

/**
 * Named backends for use with Model.objects.using("name")
 */
export const DATABASES = {
  default: sync,
  indexeddb: indexeddb,
  rest: rest,
  sync: sync,
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return rest.isAuthenticated();
}

/**
 * Reload authentication tokens from storage
 */
export function reloadAuthTokens(): void {
  rest.reloadTokens();
}

/**
 * Get the REST backend instance
 */
export function getRestBackend(): typeof rest {
  return rest;
}
`;
}

/**
 * Convert kebab-case to PascalCase
 */
function toPascalCase(str: string): string {
  return str
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
}
