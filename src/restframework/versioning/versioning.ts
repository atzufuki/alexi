/**
 * API Versioning classes for Alexi REST Framework
 *
 * Provides DRF-style API versioning to allow multiple API versions to coexist.
 * The detected version is set on the request via context.version.
 *
 * @module @alexi/restframework/versioning/versioning
 */

import type { ViewSetContext } from "../viewsets/viewset.ts";

// ============================================================================
// Types
// ============================================================================

/**
 * Versioning class constructor type
 */
export interface VersioningClass {
  new (): BaseVersioning;
}

/**
 * Configuration for versioning classes
 */
export interface VersioningConfig {
  /** Default version when none is specified */
  defaultVersion?: string | null;
  /** List of versions that are accepted. null means all versions are allowed. */
  allowedVersions?: string[] | null;
  /** Query parameter name (for QueryParameterVersioning) */
  versionParam?: string;
  /** Header name (for AcceptHeaderVersioning) */
}

// ============================================================================
// Base Versioning
// ============================================================================

/**
 * Base versioning class
 *
 * All versioning schemes should extend this class and implement
 * `determineVersion()`.
 *
 * @example
 * ```ts
 * class CustomVersioning extends BaseVersioning {
 *   override determineVersion(
 *     request: Request,
 *     params: Record<string, string>,
 *   ): string | null {
 *     return request.headers.get("X-API-Version");
 *   }
 * }
 * ```
 */
export abstract class BaseVersioning {
  /**
   * The default version to use when none is specified.
   * Override or set via ViewSet.versioning_config.
   */
  defaultVersion: string | null = null;

  /**
   * List of allowed versions. null means all versions are accepted.
   * Override or set via ViewSet.versioning_config.
   */
  allowedVersions: string[] | null = null;

  /**
   * Determine the API version from the request.
   *
   * Return null to use the default version.
   * Throw an error to reject the request.
   *
   * @param request - The HTTP request
   * @param params - URL parameters
   * @returns The detected version string, or null
   */
  abstract determineVersion(
    request: Request,
    params: Record<string, string>,
  ): string | null;

  /**
   * Validate and return the version for the request.
   *
   * Returns the determined version (or defaultVersion if none found).
   * Returns null if no version and no default.
   * Throws VersionNotAllowedError if the version is not in allowedVersions.
   *
   * @param request - The HTTP request
   * @param params - URL parameters
   * @returns The validated version string, or null
   */
  getVersion(
    request: Request,
    params: Record<string, string>,
  ): string | null {
    const version = this.determineVersion(request, params) ??
      this.defaultVersion;

    if (version == null) {
      return null;
    }

    if (
      this.allowedVersions != null && !this.allowedVersions.includes(version)
    ) {
      throw new VersionNotAllowedError(
        `Invalid version "${version}". Allowed versions: ${
          this.allowedVersions.join(", ")
        }`,
        this.allowedVersions,
      );
    }

    return version;
  }
}

// ============================================================================
// Built-in Versioning Schemes
// ============================================================================

/**
 * URL path versioning — version embedded in the URL path
 *
 * Reads the version from URL parameters. Typically used with a URL pattern
 * that captures the version (e.g., `path("api/:version/", include(router.urls))`).
 *
 * @example URL setup
 * ```ts
 * // urls.ts
 * import { path, include } from "@alexi/urls";
 *
 * export const urlpatterns = [
 *   path("api/:version/", include(router.urls)),
 * ];
 * ```
 *
 * @example ViewSet setup
 * ```ts
 * class UserViewSet extends ModelViewSet {
 *   versioning_class = URLPathVersioning;
 *   versioning_config = {
 *     defaultVersion: "v1",
 *     allowedVersions: ["v1", "v2"],
 *   };
 *
 *   override async list(context: ViewSetContext): Promise<Response> {
 *     if (context.version === "v2") {
 *       // return v2 format
 *     }
 *     return super.list(context);
 *   }
 * }
 * ```
 */
export class URLPathVersioning extends BaseVersioning {
  /**
   * The URL parameter name that holds the version
   */
  versionParam = "version";

  determineVersion(
    _request: Request,
    params: Record<string, string>,
  ): string | null {
    return params[this.versionParam] ?? null;
  }
}

/**
 * Query parameter versioning — version in query string
 *
 * Reads the version from a query parameter (default: `?version=`).
 *
 * @example
 * ```ts
 * // GET /api/users/?version=v2
 *
 * class UserViewSet extends ModelViewSet {
 *   versioning_class = QueryParameterVersioning;
 *   versioning_config = {
 *     defaultVersion: "v1",
 *     allowedVersions: ["v1", "v2"],
 *   };
 * }
 * ```
 */
export class QueryParameterVersioning extends BaseVersioning {
  /**
   * The query parameter name that holds the version
   */
  versionParam = "version";

  determineVersion(
    request: Request,
    _params: Record<string, string>,
  ): string | null {
    const url = new URL(request.url);
    return url.searchParams.get(this.versionParam);
  }
}

/**
 * Accept header versioning — version in the Accept header
 *
 * Reads the version from the `Accept` header using vendor media types,
 * e.g. `Accept: application/json; version=1.0`
 * or `Accept: application/vnd.mycompany.com+json; version=2.0`
 *
 * @example
 * ```ts
 * // Accept: application/json; version=2.0
 *
 * class UserViewSet extends ModelViewSet {
 *   versioning_class = AcceptHeaderVersioning;
 *   versioning_config = {
 *     defaultVersion: "1.0",
 *     allowedVersions: ["1.0", "2.0"],
 *   };
 * }
 * ```
 */
export class AcceptHeaderVersioning extends BaseVersioning {
  determineVersion(
    request: Request,
    _params: Record<string, string>,
  ): string | null {
    const acceptHeader = request.headers.get("Accept");
    if (!acceptHeader) {
      return null;
    }

    // Parse "application/json; version=2.0" or similar
    for (const part of acceptHeader.split(";")) {
      const trimmed = part.trim();
      if (trimmed.startsWith("version=")) {
        return trimmed.slice("version=".length).trim();
      }
    }

    return null;
  }
}

// ============================================================================
// Errors
// ============================================================================

/**
 * Thrown when the requested version is not in the allowedVersions list
 */
export class VersionNotAllowedError extends Error {
  /** HTTP status code — 400 Bad Request */
  readonly status = 400;
  /** The list of allowed versions */
  readonly allowedVersions: string[];

  constructor(message: string, allowedVersions: string[]) {
    super(message);
    this.name = "VersionNotAllowedError";
    this.allowedVersions = allowedVersions;
  }
}

// ============================================================================
// ViewSet integration helper
// ============================================================================

/**
 * Determine the API version for the given request context.
 *
 * Applies the versioning class (if any) and sets `context.version`.
 * Returns a 400 Response if the version is not allowed, or null to continue.
 *
 * @param versioning - The versioning instance, or null
 * @param context - The ViewSet context (mutated: context.version is set)
 * @returns null if OK, or a 400 Response if the version is invalid
 */
export function applyVersioning(
  versioning: BaseVersioning | null,
  context: ViewSetContext,
): Response | null {
  if (!versioning) {
    return null;
  }

  try {
    const version = versioning.getVersion(
      context.request,
      context.params,
    );
    context.version = version;
    return null;
  } catch (err) {
    if (err instanceof VersionNotAllowedError) {
      return new Response(
        JSON.stringify({
          error: err.message,
          allowedVersions: err.allowedVersions,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
    throw err;
  }
}
