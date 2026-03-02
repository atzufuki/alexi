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

import { RestBackend } from "@alexi/db/backends/rest";
import { PostEndpoint } from "./endpoints.ts";
import { urlpatterns } from "./urls.ts";

// =============================================================================
// Database — REST backend proxies ORM queries to the server API
// =============================================================================

export const DATABASES = {
  default: new RestBackend({
    apiUrl: "/api",
    endpoints: [PostEndpoint],
  }),
};

// =============================================================================
// URL Configuration
// =============================================================================

// Static import — dynamic import() is disallowed in Service Workers.
// See https://github.com/w3c/ServiceWorker/issues/1356
export const ROOT_URLCONF = urlpatterns;
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
