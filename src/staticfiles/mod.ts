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

export { default } from "./app.ts";

// =============================================================================
// Finders
// =============================================================================

export {
  AppDirectoriesFinder,
  FileSystemFinder,
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
  serveBundleMiddleware,
  staticFilesMiddleware,
  staticServe,
} from "./middleware.ts";

export type { StaticServeOptions } from "./middleware.ts";
