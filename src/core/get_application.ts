/**
 * getApplication — Django-style application factory
 *
 * Isomorphic equivalent of Django's get_wsgi_application().
 * Takes a settings module, initialises databases, resolves URL patterns,
 * builds the middleware chain, and returns a ready-to-use Application.
 *
 * Works in both Deno server and Service Worker contexts.
 *
 * @module @alexi/core/get_application
 */

import { Application } from "./application.ts";
import type { ApplicationOptions } from "./application.ts";
import { setup } from "./setup.ts";
import type { DatabasesConfig } from "./setup.ts";
import type { URLPattern } from "@alexi/urls";
import type { Middleware } from "@alexi/middleware";

// =============================================================================
// Types
// =============================================================================

/**
 * Settings accepted by getApplication().
 *
 * This is a loose interface — it reads known keys from whatever the user
 * passes in via `import * as settings`. Unknown keys are silently ignored.
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
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create a fully initialised Application from a settings module.
 *
 * This is the Alexi equivalent of Django's `get_wsgi_application()`.
 * It performs setup (database init) and returns the Application in one call.
 *
 * @example Deno Deploy (http.ts)
 * ```ts
 * import { getApplication } from "@alexi/core";
 * import * as settings from "./project/settings.ts";
 *
 * export default await getApplication(settings);
 * ```
 *
 * @example Service Worker (worker.ts)
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
 *
 * @param settings - A settings module (import * as settings from "./settings.ts")
 * @returns A ready-to-use Application instance
 */
export async function getApplication(
  settings: GetApplicationSettings,
): Promise<Application> {
  // 1. Initialise databases (if configured)
  if (settings.DATABASES) {
    await setup({ DATABASES: settings.DATABASES });
  }

  // 2. Resolve URL patterns
  const urls = await resolveUrlPatterns(settings);

  // 3. Build middleware
  const debug = settings.DEBUG ?? false;
  const middleware = resolveMiddleware(settings, debug);

  // 4. Create and return Application
  const options: ApplicationOptions = {
    urls,
    middleware,
    debug,
  };

  return new Application(options);
}

// =============================================================================
// Internal helpers
// =============================================================================

/**
 * Resolve URL patterns from settings.
 *
 * Supports three forms:
 * - ROOT_URLCONF as an import function (Django-style)
 * - ROOT_URLCONF as a direct URLPattern array
 * - No ROOT_URLCONF → empty patterns (useful for API-only setups)
 */
async function resolveUrlPatterns(
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
function resolveMiddleware(
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
