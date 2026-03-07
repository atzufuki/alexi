/**
 * getHttpApplication / getWorkerApplication — Django-style application factories
 *
 * - `getHttpApplication()` is the server-side factory (equivalent of Django's
 *   `get_wsgi_application()`). It reads settings from the global `conf` proxy,
 *   which must already be populated by the management command via `--settings`.
 *
 * - `getWorkerApplication(settings)` is the Service Worker factory. It accepts
 *   a settings object directly because SWs run in the browser — there is no
 *   `--settings` flag and no management command.
 *
 * Works in both Deno server and Service Worker contexts.
 *
 * @module @alexi/core/get_application
 */

import { Application } from "./application.ts";
import type { ApplicationOptions } from "./application.ts";
import { conf, configureSettings } from "./conf.ts";
import { setup } from "./setup.ts";
import type { DatabasesConfig } from "./setup.ts";
import type { URLPattern } from "@alexi/urls";
import type { Middleware } from "@alexi/middleware";
import type { TemplatesConfig } from "@alexi/types";

export type { Middleware } from "@alexi/middleware";
export type { URLPattern } from "@alexi/urls";
export type { TemplatesConfig } from "@alexi/types";

// =============================================================================
// Types
// =============================================================================

/**
 * Settings accepted by getWorkerApplication() and configureSettings().
 *
 * This is a loose interface — it reads known keys from whatever the user
 * passes in. Unknown keys are silently ignored.
 *
 * Mirrors the shape of a project's settings.ts module.
 */
export interface GetApplicationSettings {
  /** Django-style DATABASES dict of pre-built backend instances */
  DATABASES?: DatabasesConfig;

  /**
   * URL patterns — either an array directly, or a function that returns
   * a module with a urlpatterns export (Django-style ROOT_URLCONF).
   */
  ROOT_URLCONF?:
    | URLPattern[]
    | (() => Promise<
      { urlpatterns?: URLPattern[]; default?: URLPattern[] }
    >);

  /** Middleware factory or middleware array */
  MIDDLEWARE?: Middleware[];

  /** Middleware factory function (alternative to MIDDLEWARE array) */
  createMiddleware?: (options: { debug: boolean }) => Middleware[];

  /** Debug mode */
  DEBUG?: boolean;

  /**
   * Django-style TEMPLATES setting.
   * Controls template discovery for runserver and bundle commands.
   *
   * @example
   * export const TEMPLATES = [
   *   { APP_DIRS: true, DIRS: ["./src/my-app/templates"] },
   * ];
   */
  TEMPLATES?: TemplatesConfig[];
}

// =============================================================================
// Server-side factory
// =============================================================================

/**
 * Create a fully initialised Application from the global `conf` settings.
 *
 * This is the Alexi equivalent of Django's `get_wsgi_application()`.
 * Settings must already be configured (via `--settings` CLI flag /
 * `configureSettings()`) before calling this function.
 *
 * Use this in server-side entry points (`http.ts`, `runserver`).
 * For Service Workers, use `getWorkerApplication(settings)` instead.
 *
 * @example Deno Deploy / deno serve (http.ts)
 * ```ts
 * import { getHttpApplication } from "@alexi/core";
 *
 * export default await getHttpApplication();
 * ```
 *
 * @returns A ready-to-use Application instance
 * @throws {Error} If settings have not been configured yet
 */
export async function getHttpApplication(): Promise<Application> {
  // conf proxy throws if not yet configured
  const settings: GetApplicationSettings = conf;
  return _buildApplication(settings);
}

// =============================================================================
// Service Worker factory
// =============================================================================

/**
 * Create a fully initialised Application from an explicit settings object.
 *
 * Use this in Service Worker entry points (`worker.ts`). The SW runs in the
 * browser — there is no `--settings` flag or management command, so settings
 * are passed directly.
 *
 * For server-side use, use `getHttpApplication()` instead.
 *
 * @example Service Worker (worker.ts)
 * ```ts
 * import { getWorkerApplication } from "@alexi/core";
 * import * as settings from "./settings.ts";
 *
 * declare const self: ServiceWorkerGlobalScope;
 *
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
 *
 * @param settings - The Service Worker settings module
 * @returns A ready-to-use Application instance
 */
export async function getWorkerApplication(
  settings: GetApplicationSettings,
): Promise<Application> {
  return _buildApplication(settings);
}

// =============================================================================
// Legacy alias — kept for backwards compatibility
// =============================================================================

/**
 * @deprecated Use `getHttpApplication()` for server-side code or
 * `getWorkerApplication(settings)` for Service Workers.
 *
 * @param settings Settings object used to build the application.
 */
export async function getApplication(
  settings: GetApplicationSettings,
): Promise<Application> {
  configureSettings(settings);
  return _buildApplication(settings);
}

// =============================================================================
// Internal helpers
// =============================================================================

/**
 * Core build logic shared by both factories.
 */
async function _buildApplication(
  settings: GetApplicationSettings,
): Promise<Application> {
  // 1. Initialise databases (if configured)
  if (settings.DATABASES) {
    await setup({ DATABASES: settings.DATABASES });
  }

  // 2. Resolve URL patterns
  const urls = await _resolveUrlPatterns(settings);

  // 3. Build middleware
  const debug = settings.DEBUG ?? false;
  const middleware = _resolveMiddleware(settings, debug);

  // 4. Create and return Application
  const options: ApplicationOptions = {
    urls,
    middleware,
    debug,
  };

  return new Application(options);
}

/**
 * Resolve URL patterns from settings.
 *
 * Supports three forms:
 * - ROOT_URLCONF as an import function (Django-style)
 * - ROOT_URLCONF as a direct URLPattern array
 * - No ROOT_URLCONF → empty patterns (useful for API-only setups)
 */
async function _resolveUrlPatterns(
  settings: GetApplicationSettings,
): Promise<URLPattern[]> {
  const rootUrlConf = settings.ROOT_URLCONF;

  if (!rootUrlConf) {
    return [];
  }

  // Direct array of URL patterns
  if (Array.isArray(rootUrlConf)) {
    return rootUrlConf;
  }

  // Import function (Django-style ROOT_URLCONF)
  if (typeof rootUrlConf === "function") {
    const module = await rootUrlConf();
    const patterns = module.urlpatterns ?? module.default ?? [];
    return patterns as URLPattern[];
  }

  return [];
}

/**
 * Resolve middleware from settings.
 *
 * Supports two forms:
 * - MIDDLEWARE as a direct array
 * - createMiddleware() factory function
 */
function _resolveMiddleware(
  settings: GetApplicationSettings,
  debug: boolean,
): Middleware[] {
  if (settings.MIDDLEWARE) {
    return settings.MIDDLEWARE;
  }

  if (settings.createMiddleware) {
    return settings.createMiddleware({ debug });
  }

  return [];
}
