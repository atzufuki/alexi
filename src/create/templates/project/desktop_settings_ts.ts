/**
 * Desktop settings template generator
 *
 * @module @alexi/create/templates/project/desktop_settings_ts
 */

/**
 * Generate desktop.settings.ts content for a new project
 */
export function generateDesktopSettings(name: string): string {
  const appName = toPascalCase(name);

  return `/**
 * ${appName} - Desktop Settings
 *
 * Settings for the WebUI desktop window application.
 *
 * @module project/desktop.settings
 */

// =============================================================================
// Environment
// =============================================================================

export const DEBUG = Deno.env.get("DEBUG") === "true";

// =============================================================================
// URLs
// =============================================================================

export const API_URL = Deno.env.get("API_URL") ?? "http://localhost:8000/api";
export const UI_URL = Deno.env.get("UI_URL") ?? "http://127.0.0.1:5173/";

// =============================================================================
// Desktop Configuration
// =============================================================================

export const DESKTOP = {
  title: "${appName}",
  width: 1200,
  height: 800,
  browser: "any" as const,
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
  () => import("@alexi/webui"),
  () => import("@${name}/desktop"),
];

// =============================================================================
// Custom Bindings
// =============================================================================

/**
 * Path to custom bindings (merged with alexi_webui defaults)
 */
export const BINDINGS_MODULE = "src/${name}-desktop/bindings.ts";
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
