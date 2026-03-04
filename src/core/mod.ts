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
 * @example Deno Deploy / deno serve production entrypoint (http.ts)
 * ```ts
 * import { getHttpApplication } from "@alexi/core";
 *
 * export default await getHttpApplication();
 * ```
 *
 * @example Service Worker entrypoint (worker.ts)
 * ```ts
 * import { getWorkerApplication } from "@alexi/core";
 * import * as settings from "./settings.ts";
 *
 * declare const self: ServiceWorkerGlobalScope;
 * let app: Awaited<ReturnType<typeof getWorkerApplication>>;
 *
 * self.addEventListener("install", (event) => {
 *   event.waitUntil(
 *     (async () => {
 *       app = await getWorkerApplication(settings);
 *       await self.skipWaiting();
 *     })(),
 *   );
 * });
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
// Application Factories
// =============================================================================

export {
  getApplication,
  getHttpApplication,
  getWorkerApplication,
} from "./get_application.ts";
export type { GetApplicationSettings } from "./get_application.ts";

// =============================================================================
// Setup
// =============================================================================

export { setup } from "./setup.ts";
export type { DatabasesConfig } from "./setup.ts";

// =============================================================================
// Global Settings Registry (Django-style django.conf.settings)
// =============================================================================

export {
  conf,
  configureSettings,
  isSettingsConfigured,
  resetSettings,
} from "./conf.ts";
export type { GetApplicationSettings as ConfSettings } from "./get_application.ts";
