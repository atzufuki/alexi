/**
 * Alexi Static Files
 *
 * Django-style static file serving and bundling for Alexi.
 * Similar to Django's django.contrib.staticfiles.
 *
 * @module @alexi/staticfiles
 */

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
