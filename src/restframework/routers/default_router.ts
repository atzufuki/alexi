/**
 * DefaultRouter for Alexi REST Framework
 *
 * Automatically generates URL patterns from ViewSets.
 *
 * @module @alexi/restframework/routers/default_router
 */

import { path, type URLPattern } from "@alexi/urls";
import { type ActionMetadata, getActions, type HttpMethod, ViewSet } from "../viewsets/viewset.ts";

// ============================================================================
// Types
// ============================================================================

/**
 * Options for registering a ViewSet
 */
export interface RegisterOptions {
  /** Base name for URL naming (defaults to ViewSet class name) */
  basename?: string;
}

/**
 * Registered ViewSet entry
 */
interface RegisteredViewSet {
  prefix: string;
  viewset: typeof ViewSet;
  basename: string;
}

// ============================================================================
// DefaultRouter Class
// ============================================================================

/**
 * DefaultRouter automatically generates URL patterns from ViewSets
 *
 * @example
 * ```ts
 * import { DefaultRouter } from "@alexi/restframework";
 * import { AssetViewSet, TaskViewSet } from "./viewsets.ts";
 *
 * const router = new DefaultRouter();
 * router.register("assets", AssetViewSet);
 * router.register("tasks", TaskViewSet);
 *
 * // Use with Application
 * const app = new Application({
 *   urls: router.urls,
 * });
 *
 * // Generated routes:
 * // GET    /assets/          -> AssetViewSet.list
 * // POST   /assets/          -> AssetViewSet.create
 * // GET    /assets/:id/      -> AssetViewSet.retrieve
 * // PUT    /assets/:id/      -> AssetViewSet.update
 * // PATCH  /assets/:id/      -> AssetViewSet.partial_update
 * // DELETE /assets/:id/      -> AssetViewSet.destroy
 * ```
 */
export class DefaultRouter {
  private _registry: RegisteredViewSet[] = [];
  private _trailingSlash = true;

  /**
   * Create a new router
   *
   * @param options - Router options
   */
  constructor(options: { trailingSlash?: boolean } = {}) {
    this._trailingSlash = options.trailingSlash ?? true;
  }

  /**
   * Register a ViewSet with the router
   *
   * @param prefix - URL prefix for the ViewSet (e.g., "assets")
   * @param viewset - ViewSet class
   * @param options - Registration options
   */
  register(
    prefix: string,
    viewset: typeof ViewSet,
    options: RegisterOptions = {},
  ): void {
    const basename = options.basename ?? viewset.getBasename();

    this._registry.push({
      prefix: this.normalizePrefix(prefix),
      viewset,
      basename,
    });
  }

  /**
   * Normalize a URL prefix
   */
  private normalizePrefix(prefix: string): string {
    // Remove leading/trailing slashes
    return prefix.replace(/^\/+|\/+$/g, "");
  }

  /**
   * Get the trailing slash suffix
   */
  private get slash(): string {
    return this._trailingSlash ? "/" : "";
  }

  /**
   * Get all generated URL patterns
   */
  get urls(): URLPattern[] {
    const patterns: URLPattern[] = [];

    for (const { prefix, viewset, basename } of this._registry) {
      // Generate standard CRUD routes
      patterns.push(...this.getRoutes(prefix, viewset, basename));
    }

    return patterns;
  }

  /**
   * Generate routes for a ViewSet
   */
  private getRoutes(
    prefix: string,
    viewset: typeof ViewSet,
    basename: string,
  ): URLPattern[] {
    const patterns: URLPattern[] = [];

    // Check which actions are implemented
    const instance = new viewset();
    const hasAction = (name: string): boolean => {
      return typeof (instance as Record<string, unknown>)[name] === "function";
    };

    // List route (GET /)
    // Create route (POST /)
    const listActions: Partial<Record<HttpMethod, string>> = {};
    if (hasAction("list")) {
      listActions.GET = "list";
    }
    if (hasAction("create")) {
      listActions.POST = "create";
    }

    if (Object.keys(listActions).length > 0) {
      patterns.push(
        path(
          `${prefix}${this.slash}`,
          viewset.asView(listActions as Record<HttpMethod, string>),
          { name: `${basename}-list` },
        ),
      );
    }

    // Detail routes (GET/PUT/PATCH/DELETE /:id/)
    const detailActions: Partial<Record<HttpMethod, string>> = {};
    if (hasAction("retrieve")) {
      detailActions.GET = "retrieve";
    }
    if (hasAction("update")) {
      detailActions.PUT = "update";
    }
    if (hasAction("partial_update")) {
      detailActions.PATCH = "partial_update";
    }
    if (hasAction("destroy")) {
      detailActions.DELETE = "destroy";
    }

    if (Object.keys(detailActions).length > 0) {
      patterns.push(
        path(
          `${prefix}/:id${this.slash}`,
          viewset.asView(detailActions as Record<HttpMethod, string>),
          { name: `${basename}-detail` },
        ),
      );
    }

    // Custom actions (from @action decorator)
    const customActions = getActions(instance);
    for (const [actionName, metadata] of customActions) {
      patterns.push(
        ...this.getCustomActionRoutes(
          prefix,
          viewset,
          basename,
          actionName,
          metadata,
        ),
      );
    }

    return patterns;
  }

  /**
   * Generate routes for a custom action
   */
  private getCustomActionRoutes(
    prefix: string,
    viewset: typeof ViewSet,
    basename: string,
    actionName: string,
    metadata: ActionMetadata,
  ): URLPattern[] {
    const patterns: URLPattern[] = [];

    const urlPath = metadata.urlPath ?? actionName;
    const urlName = metadata.urlName ?? actionName;

    // Build the action mapping
    const actionMapping: Partial<Record<HttpMethod, string>> = {};
    for (const method of metadata.methods ?? ["GET"]) {
      actionMapping[method] = actionName;
    }

    if (metadata.detail) {
      // Detail action: /:id/<action>/
      patterns.push(
        path(
          `${prefix}/:id/${urlPath}${this.slash}`,
          viewset.asView(actionMapping as Record<HttpMethod, string>),
          { name: `${basename}-${urlName}` },
        ),
      );
    } else {
      // List action: /<action>/
      patterns.push(
        path(
          `${prefix}/${urlPath}${this.slash}`,
          viewset.asView(actionMapping as Record<HttpMethod, string>),
          { name: `${basename}-${urlName}` },
        ),
      );
    }

    return patterns;
  }

  /**
   * Get the registered ViewSets
   */
  get registry(): readonly RegisteredViewSet[] {
    return this._registry;
  }
}

// ============================================================================
// SimpleRouter (alternative with less features)
// ============================================================================

/**
 * SimpleRouter is a minimal router without custom actions
 *
 * Use this for simple APIs that don't need custom actions.
 */
export class SimpleRouter extends DefaultRouter {
  // Same as DefaultRouter but could be extended with simpler behavior
}
