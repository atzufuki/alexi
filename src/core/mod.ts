/**
 * Alexi Core - Universal (browser + server safe) exports
 *
 * This module exports things that are safe to import in any environment
 * (browser, Service Worker, server).
 *
 * For management commands, CLI utilities, and configuration loader,
 * import from "@alexi/core/management" (server-only).
 *
 * @module @alexi/core
 *
 * @example Deno Deploy production entrypoint (http.ts)
 * ```ts
 * import { getApplication } from "@alexi/core";
 * import * as settings from "./project/settings.ts";
 *
 * export default await getApplication(settings);
 * ```
 *
 * @example Service Worker entrypoint (worker.ts)
 * ```ts
 * import { getApplication } from "@alexi/core";
 * import * as settings from "./settings.ts";
 *
 * const app = await getApplication(settings);
 *
 * self.addEventListener("fetch", (event) => {
 *   event.respondWith(app.handler(event.request));
 * });
 * ```
 */

// =============================================================================
// Application
// =============================================================================

export { Application } from "./application.ts";
export type {
  ApplicationOptions,
  Handler,
  ServeOptions,
} from "./application.ts";

// =============================================================================
// Application Factory
// =============================================================================

export { getApplication } from "./get_application.ts";
export type { GetApplicationSettings } from "./get_application.ts";

// =============================================================================
// Setup
// =============================================================================

export { setup } from "./setup.ts";
export type { DatabasesConfig } from "./setup.ts";
