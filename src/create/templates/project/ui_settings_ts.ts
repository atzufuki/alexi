/**
 * UI settings template generator
 *
 * @module @alexi/create/templates/project/ui_settings_ts
 */

/**
 * Generate ui.settings.ts content for a new project
 */
export function generateUiSettings(name: string): string {
  return `/**
 * ${toPascalCase(name)} - UI Server Settings
 *
 * Settings for the UI static file server (SPA development server).
 *
 * This server provides:
 * - Static file serving for the bundled SPA
 * - SPA fallback (index.html for all routes)
 *
 * The UI app connects to the web server's API.
 * Make sure dev:web is running for full functionality.
 *
 * @module project/ui.settings
 */

export { DEBUG } from "./settings.ts";

// =============================================================================
// Server Configuration
// =============================================================================

export const DEFAULT_HOST = "127.0.0.1";
export const DEFAULT_PORT = 5173;

// =============================================================================
// API Configuration
// =============================================================================

/**
 * URL of the web server's API.
 * The SPA makes API calls to this URL.
 */
export const API_URL = Deno.env.get("API_URL") ?? "http://localhost:8000/api";

// =============================================================================
// Installed Apps
// =============================================================================

/**
 * INSTALLED_APPS contains import functions for each app.
 *
 * Note: We include the UI app here so the bundler knows about it,
 * but the UI code runs in the browser, not on this server.
 */
export const INSTALLED_APPS = [
  () => import("@alexi/staticfiles"),
  () => import("@${name}/ui"),
];

// =============================================================================
// Static Files
// =============================================================================

export const STATIC_URL = "/";
export const STATIC_ROOT = "./static";

/**
 * The directory containing the SPA bundle.
 * This is where bundle.js, bundle.css, and index.html are located.
 */
export const SPA_ROOT = "./src/${name}-ui/static/${name}-ui";
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
