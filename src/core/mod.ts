/**
 * Alexi's application bootstrap package.
 *
 * `@alexi/core` contains the framework entrypoints that wire together settings,
 * URL patterns, middleware, and database setup into a runnable `Application`.
 * It is the package most Alexi projects start from when creating a server
 * entrypoint, a Service Worker entrypoint, or shared framework setup code.
 *
 * The main starting points are `getHttpApplication()` for server runtimes,
 * `getWorkerApplication()` for browser Service Workers, `setup()` for explicit
 * database initialization, and the Django-style `conf` settings registry for
 * code that needs access to global framework settings.
 *
 * This root entrypoint is safe to import from browser, Service Worker, and
 * server code. Management commands, CLI helpers, and configuration-loading
 * utilities live under `@alexi/core/management`, which is server-only.
 *
 * @module @alexi/core
 *
 * @example Server entrypoint with framework-managed settings
 * ```ts
 * import { getHttpApplication } from "@alexi/core";
 *
 * export default await getHttpApplication();
 * ```
 *
 * @example Service Worker entrypoint with explicit settings
 * ```ts
 * import { getWorkerApplication } from "@alexi/core";
 * import * as settings from "./settings.ts";
 *
 * const app = await getWorkerApplication(settings);
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
export { BaseMiddleware } from "./application.ts";
export type {
  Middleware,
  MiddlewareClass,
  NextFunction,
  URLPattern,
  View,
} from "./application.ts";

// =============================================================================
// Application Factories
// =============================================================================

export { getHttpApplication, getWorkerApplication } from "./get_application.ts";
export type { GetApplicationSettings } from "./get_application.ts";
export type { AppConfig } from "@alexi/types";

// =============================================================================
// Setup
// =============================================================================

export { setup } from "./setup.ts";
export type { DatabasesConfig } from "./setup.ts";
export type { TemplatesConfig } from "./get_application.ts";

// =============================================================================
// Request Context (Django-style request.user side-channel)
// =============================================================================

export { getRequestContext, setRequestContext } from "./context.ts";
export type { RequestContext } from "./context.ts";

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
