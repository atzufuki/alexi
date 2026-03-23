/**
 * Alexi's static asset serving and bundling package.
 *
 * `@alexi/staticfiles` provides the static file finders, storage helpers, and
 * middleware used to serve built assets and app-provided static files in a
 * Django-style way. It is also the package behind Alexi's static asset build
 * commands, including support for bundling frontend entrypoints and resolving
 * hashed filenames through generated manifests.
 *
 * Start with `staticFilesMiddleware()` when you want an application to serve
 * static assets, and use the exported finder and storage types when extending
 * discovery or delivery behavior. Build-time commands live under the
 * `@alexi/staticfiles/commands` subpath and are intended for server-side or
 * development tooling usage.
 *
 * Serving middleware is request/response based, while bundling and filesystem
 * discovery require server-side access to the local file system and build tools.
 *
 * @module @alexi/staticfiles
 *
 * @example Serve static assets from an application
 * ```ts
 * import { staticFilesMiddleware } from "@alexi/staticfiles";
 *
 * const middleware = [
 *   staticFilesMiddleware(),
 * ];
 * ```
 */

// =============================================================================
// App Configuration
// =============================================================================

import type { AppConfig } from "@alexi/types";

/**
 * App configuration for `@alexi/staticfiles`.
 *
 * Add to `INSTALLED_APPS` in your project settings to enable static file
 * discovery and serving via `AppDirectoriesFinder`.
 *
 * @example
 * ```ts
 * import { StaticfilesConfig } from "@alexi/staticfiles";
 *
 * export const INSTALLED_APPS = [StaticfilesConfig];
 * ```
 *
 * @category Configuration
 */
export const StaticfilesConfig: AppConfig = {
  name: "alexi_staticfiles",
  verboseName: "Alexi Static Files",
  appPath: new URL("./", import.meta.url).href,
};

// =============================================================================
// Finders
// =============================================================================

export {
  AppDirectoriesFinder,
  FileSystemFinder,
  globalAppDirectoriesFinder,
  registerStaticAppPath,
  StaticFileFinders,
} from "./finders.ts";

export type {
  AppDirectoriesFinderOptions,
  FileSystemFinderOptions,
  FinderResult,
  StaticFileFinder,
} from "./finders.ts";

// =============================================================================
// Storage
// =============================================================================

export {
  extractStaticPath,
  FileSystemStorage,
  getContentType,
  isStaticFileRequest,
  StaticFilesStorage,
} from "./storage.ts";

export type {
  StaticFile,
  StaticFileStorage,
  StorageOptions,
} from "./storage.ts";

// =============================================================================
// Middleware
// =============================================================================

export {
  MediaFilesMiddleware,
  mediaFilesMiddleware,
  mediaServe,
  serveBundleMiddleware,
  StaticFilesMiddleware,
  staticFilesMiddleware,
  staticServe,
} from "./middleware.ts";

export type { MediaServeOptions, StaticServeOptions } from "./middleware.ts";

// Re-export middleware base types so that symbols from this package that
// extend / return them satisfy deno doc --lint's public-type-ref requirement.
export type {
  BaseMiddleware,
  MiddlewareClass,
  NextFunction,
} from "@alexi/middleware";
