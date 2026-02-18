/**
 * API Versioning module for Alexi REST Framework
 *
 * @module @alexi/restframework/versioning
 */

export {
  AcceptHeaderVersioning,
  applyVersioning,
  BaseVersioning,
  QueryParameterVersioning,
  URLPathVersioning,
  VersionNotAllowedError,
} from "./versioning.ts";

export type { VersioningClass, VersioningConfig } from "./versioning.ts";
