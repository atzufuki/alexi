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
import type { Middleware, MiddlewareClass } from "@alexi/middleware";
import type { AppConfig, TemplatesConfig } from "@alexi/types";
import { appRegistrationHooks } from "@alexi/types";
import { registerTemplateDir } from "@alexi/views";

export type { Middleware, MiddlewareClass } from "@alexi/middleware";
export type { URLPattern } from "@alexi/urls";
export type { AppConfig, TemplatesConfig } from "@alexi/types";

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

  /**
   * Middleware stack.
   *
   * Accepts class-based middleware (preferred) or legacy function middleware
   * for backwards compatibility. Middleware is executed in order.
   *
   * @example Class-based (preferred)
   * ```ts
   * import { CorsMiddleware, LoggingMiddleware } from "@alexi/middleware";
   * export const MIDDLEWARE = [LoggingMiddleware, CorsMiddleware];
   * ```
   *
   * @example Legacy function-based
   * ```ts
   * export const MIDDLEWARE = [loggingMiddleware(), corsMiddleware()];
   * ```
   */
  MIDDLEWARE?: Array<MiddlewareClass | Middleware>;

  /** Debug mode */
  DEBUG?: boolean;

  /**
   * Secret key for cryptographic signing (JWT tokens, admin session tokens).
   *
   * Mirrors Django's `SECRET_KEY` setting.
   * If not set, falls back to the `SECRET_KEY` environment variable.
   *
   * @example
   * ```ts
   * export const SECRET_KEY = Deno.env.get("SECRET_KEY") ?? "dev-secret";
   * ```
   */
  SECRET_KEY?: string;

  /**
   * The user model class (or import path) used for authentication.
   *
   * Mirrors Django's `AUTH_USER_MODEL` setting.
   * Pass the model class directly (recommended) or a path string (deprecated).
   *
   * @example
   * ```ts
   * import { UserModel } from "@myapp/web/models.ts";
   * export const AUTH_USER_MODEL = UserModel;
   * ```
   */
  // deno-lint-ignore no-explicit-any
  AUTH_USER_MODEL?: (new () => any) | string;

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

  /**
   * List of installed application configurations.
   *
   * Mirrors Django's `INSTALLED_APPS`. Each entry is a plain `AppConfig`
   * object (not an import function). The framework calls `appConfig.ready()`
   * on each entry during application startup, after databases are initialised.
   *
   * When `TEMPLATES[0].APP_DIRS` is `true`, each app's `<appPath>/templates/`
   * directory is automatically registered as a template search directory.
   *
   * @example
   * ```ts
   * import { StaticfilesConfig } from "@alexi/staticfiles";
   * import { AuthConfig } from "@alexi/auth";
   *
   * export const INSTALLED_APPS = [
   *   StaticfilesConfig,
   *   AuthConfig,
   * ];
   * ```
   */
  INSTALLED_APPS?: AppConfig[];
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
 * Builds an Application from a settings object.
 *
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

  // 2. Process INSTALLED_APPS and TEMPLATES
  if (settings.INSTALLED_APPS || settings.TEMPLATES) {
    await _processInstalledApps(
      settings.INSTALLED_APPS ?? [],
      settings.TEMPLATES,
    );
  }

  // 3. Resolve URL patterns
  const urls = await _resolveUrlPatterns(settings);

  // 4. Build middleware
  const debug = settings.DEBUG ?? false;
  const middleware = _resolveMiddleware(settings, debug);

  // 5. Create and return Application
  const options: ApplicationOptions = {
    urls,
    middleware,
    debug,
  };

  return new Application(options);
}

/**
 * Process INSTALLED_APPS: call ready(), register template dirs, and notify
 * app-registration hooks (e.g. static file registration).
 *
 * For each app:
 * 1. All registered `appRegistrationHooks` are called with the app name and
 *    resolved path (e.g. `@alexi/staticfiles` uses this to populate the
 *    global `AppDirectoriesFinder`).
 * 2. When `TEMPLATES[0].APP_DIRS` is `true`, the app's `<appPath>/templates/`
 *    directory is registered with the global filesystem template loader.
 * 3. `app.ready()` is called (if defined).
 */
async function _processInstalledApps(
  installedApps: AppConfig[],
  templates?: TemplatesConfig[],
): Promise<void> {
  const appDirs = templates?.[0]?.APP_DIRS === true;
  const extraDirs = templates?.[0]?.DIRS ?? [];

  // Register explicit TEMPLATES[0].DIRS entries first
  for (const dir of extraDirs) {
    registerTemplateDir(dir);
  }

  for (const app of installedApps) {
    const appPath = app.appPath;

    // 1. Notify all app-registration hooks (e.g. static file registration)
    for (const hook of appRegistrationHooks) {
      await hook(app.name, appPath);
    }

    // 2. Register template directory when APP_DIRS is true
    if (appDirs && appPath) {
      // Normalise: convert file:// URL to path and strip trailing slash
      let resolvedPath = appPath;
      if (appPath.startsWith("file://")) {
        try {
          resolvedPath = new URL(appPath).pathname.replace(/\/$/, "");
        } catch {
          // keep original
        }
      }
      registerTemplateDir(`${resolvedPath}/templates`);
    }

    // 3. Call ready() hook
    if (typeof app.ready === "function") {
      await app.ready();
    }
  }
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
 * Reads the `MIDDLEWARE` array from settings.
 */
function _resolveMiddleware(
  settings: GetApplicationSettings,
  _debug: boolean,
): Array<MiddlewareClass | Middleware> {
  if (settings.MIDDLEWARE) {
    return settings.MIDDLEWARE;
  }

  return [];
}
