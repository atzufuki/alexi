/**
 * Worker settings.ts template generator
 *
 * @module @alexi/create/templates/unified/workers/settings_ts
 */

/**
 * Generate workers/<name>/settings.ts content
 *
 * This is the Service Worker's settings module — the browser-side equivalent
 * of project/settings.ts. It is passed to getApplication(settings) in mod.ts.
 */
export function generateWorkerSettingsTs(name: string): string {
  return `/**
 * ${toPascalCase(name)} Worker Settings
 *
 * Service Worker settings module — the browser-side equivalent of
 * project/settings.ts. Passed to getApplication() in mod.ts.
 *
 * @module ${name}/workers/${name}/settings
 */

import { IndexedDBBackend } from "@alexi/db/backends/indexeddb";

// =============================================================================
// Database
// =============================================================================

export const DATABASES = {
  default: new IndexedDBBackend({ name: "${name}" }),
};

// =============================================================================
// URL Configuration
// =============================================================================

export const ROOT_URLCONF = () => import("./urls.ts");
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
