/**
 * Base ViewSet class for Alexi REST Framework
 *
 * ViewSets combine the logic for handling multiple related views into a single class.
 *
 * @module @alexi/restframework/viewsets/viewset
 */

import type { View } from "@alexi/urls";
import type { BasePermission, PermissionClass } from "../permissions/mod.ts";
import type { BaseThrottle, ThrottleClass } from "../throttling/mod.ts";
import { ForbiddenError, UnauthorizedError } from "@alexi/middleware";

// ============================================================================
// Types
// ============================================================================

/**
 * HTTP methods supported by ViewSets
 */
export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "OPTIONS"
  | "HEAD";

/**
 * Action types for ViewSet
 */
export type ActionType =
  | "list"
  | "create"
  | "retrieve"
  | "update"
  | "partial_update"
  | "destroy"
  | string;

/**
 * Action decorator options
 */
export interface ActionOptions {
  /** Whether this action applies to a single object (detail) or collection */
  detail: boolean;

  /** HTTP methods this action responds to */
  methods?: HttpMethod[];

  /** URL path suffix (defaults to action name) */
  urlPath?: string;

  /** URL name suffix (defaults to action name) */
  urlName?: string;
}

/**
 * Registered action metadata
 */
export interface ActionMetadata extends ActionOptions {
  /** The action method name */
  name: string;
}

/**
 * ViewSet context passed to action methods
 */
export interface ViewSetContext {
  /** The current HTTP request */
  request: Request;

  /** URL parameters (e.g., { id: "123" }) */
  params: Record<string, string>;

  /** The current action being performed */
  action: ActionType;

  /** The authenticated user (if any) */
  user?: {
    id: number | string;
    email?: string;
    isAdmin?: boolean;
    [key: string]: unknown;
  };

  /** Additional context data */
  [key: string]: unknown;
}

// ============================================================================
// Action Registry (for @action decorator)
// ============================================================================

/**
 * Storage for custom action metadata
 */
const actionRegistry = new WeakMap<object, Map<string, ActionMetadata>>();

/**
 * Register a custom action on a ViewSet method
 *
 * @example
 * ```ts
 * class AssetViewSet extends ModelViewSet {
 *   @action({ detail: true, methods: ["POST"] })
 *   async duplicate(context: ViewSetContext): Promise<Response> {
 *     const asset = await this.getObject(context);
 *     // ... duplicate logic
 *     return Response.json(duplicatedAsset, { status: 201 });
 *   }
 * }
 * ```
 */
export function action(options: ActionOptions): (
  target: object,
  propertyKey: string,
  _descriptor: PropertyDescriptor,
) => void {
  return function (
    target: object,
    propertyKey: string,
    _descriptor: PropertyDescriptor,
  ): void {
    // Get or create the action map for this class
    let actions = actionRegistry.get(target);
    if (!actions) {
      actions = new Map();
      actionRegistry.set(target, actions);
    }

    // Register the action
    actions.set(propertyKey, {
      ...options,
      name: propertyKey,
      methods: options.methods ?? ["GET"],
    });
  };
}

/**
 * Get registered actions for a ViewSet instance
 */
export function getActions(instance: object): Map<string, ActionMetadata> {
  const prototype = Object.getPrototypeOf(instance);
  return actionRegistry.get(prototype) ?? new Map();
}

// ============================================================================
// Base ViewSet Class
// ============================================================================

/**
 * Base ViewSet class
 *
 * ViewSets don't provide any actions by default. Subclasses or mixins
 * should implement the desired actions (list, create, retrieve, update, destroy).
 *
 * @example
 * ```ts
 * class HealthViewSet extends ViewSet {
 *   async list(context: ViewSetContext): Promise<Response> {
 *     return Response.json({ status: "ok" });
 *   }
 * }
 * ```
 *
 * @example With permissions
 * ```ts
 * class ProtectedViewSet extends ViewSet {
 *   permission_classes = [IsAuthenticated];
 *
 *   async list(context: ViewSetContext): Promise<Response> {
 *     return Response.json({ data: "secret" });
 *   }
 * }
 * ```
 */
export class ViewSet {
  /**
   * Permission classes to check before each action
   *
   * All permissions must pass (AND logic). Override getPermissions()
   * for per-action control.
   */
  permission_classes?: PermissionClass[];

  /**
   * Throttle classes to apply to this ViewSet
   *
   * All throttles are checked (any denial stops the request).
   * Override getThrottles() for per-action control.
   *
   * @example
   * ```ts
   * class MyViewSet extends ModelViewSet {
   *   throttle_classes = [AnonRateThrottle, UserRateThrottle];
   *   throttle_rates = { anon: "100/day", user: "1000/day" };
   * }
   * ```
   */
  throttle_classes?: ThrottleClass[];

  /**
   * Rate limits for each throttle scope
   *
   * Keys correspond to the `scope` property of throttle classes.
   * Values are rate strings like "100/day", "10/minute", "5/second".
   *
   * @example
   * ```ts
   * throttle_rates = {
   *   anon: "100/day",
   *   user: "1000/hour",
   *   burst: "60/minute",
   * };
   * ```
   */
  throttle_rates?: Record<string, string>;

  /**
   * The current action being performed
   */
  action?: ActionType;

  /**
   * The current request
   */
  request?: Request;

  /**
   * URL parameters
   */
  params?: Record<string, string>;

  /**
   * Additional context
   */
  protected context: ViewSetContext = {} as ViewSetContext;

  /**
   * Set up the ViewSet for handling a request
   */
  initialize(context: ViewSetContext): void {
    this.action = context.action;
    this.request = context.request;
    this.params = context.params;
    this.context = context;
  }

  /**
   * Get permission instances for the current action
   *
   * Override this method to return different permissions per action.
   *
   * @example
   * ```ts
   * getPermissions(): BasePermission[] {
   *   if (this.action === "destroy") {
   *     return [new IsAdminUser()];
   *   }
   *   return [new IsAuthenticatedOrReadOnly()];
   * }
   * ```
   */
  getPermissions(): BasePermission[] {
    if (!this.permission_classes) {
      return [];
    }
    return this.permission_classes.map((cls) => new cls());
  }

  /**
   * Get throttle instances for the current action
   *
   * Override this method to return different throttles per action.
   * Rates from `throttle_rates` are automatically applied to throttles
   * that have a matching `scope` property.
   *
   * @example
   * ```ts
   * getThrottles(): BaseThrottle[] {
   *   if (this.action === "create") {
   *     return [new AnonRateThrottle()];
   *   }
   *   return [];
   * }
   * ```
   */
  getThrottles(): BaseThrottle[] {
    if (!this.throttle_classes) {
      return [];
    }
    return this.throttle_classes.map((cls) => {
      const throttle = new cls();
      // Apply rate from throttle_rates if the throttle has a scope
      const scopedThrottle = throttle as BaseThrottle & {
        scope?: string;
        setRate?: (rate: string) => void;
      };
      if (
        this.throttle_rates &&
        scopedThrottle.scope &&
        scopedThrottle.setRate
      ) {
        const rate = this.throttle_rates[scopedThrottle.scope];
        if (rate) {
          scopedThrottle.setRate(rate);
        }
      }
      return throttle;
    });
  }

  /**
   * Check all throttles for the current request
   *
   * Returns a Response with status 429 and Retry-After header if throttled,
   * or null if the request is allowed.
   *
   * @param context - The ViewSet context
   * @returns 429 Response if throttled, null if allowed
   */
  checkThrottles(context: ViewSetContext): Response | null {
    const throttles = this.getThrottles();

    for (const throttle of throttles) {
      if (!throttle.allowRequest(context)) {
        const retryAfter = throttle.waitTime(context);
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (retryAfter != null) {
          headers["Retry-After"] = String(retryAfter);
        }
        return new Response(
          JSON.stringify({ error: throttle.message }),
          { status: 429, headers },
        );
      }
    }

    return null;
  }

  /**
   * Check all permissions for the current request
   *
   * Throws UnauthorizedError (401) if user is not authenticated when required.
   * Throws ForbiddenError (403) if user doesn't have permission.
   */
  async checkPermissions(context: ViewSetContext): Promise<void> {
    const permissions = this.getPermissions();

    for (const permission of permissions) {
      const hasPermission = await permission.hasPermission(context);

      if (!hasPermission) {
        // Determine if it's an auth issue (401) or permission issue (403)
        if (context.user == null) {
          throw new UnauthorizedError(
            permission.message || "Authentication required.",
          );
        }
        throw new ForbiddenError(
          permission.message || "Permission denied.",
        );
      }
    }
  }

  /**
   * Check object-level permissions
   *
   * Call this in retrieve, update, partial_update, destroy actions
   * after fetching the object.
   *
   * @param context - The ViewSet context
   * @param obj - The object being accessed
   */
  async checkObjectPermissions(
    context: ViewSetContext,
    obj: unknown,
  ): Promise<void> {
    const permissions = this.getPermissions();

    for (const permission of permissions) {
      const hasPermission = await permission.hasObjectPermission(context, obj);

      if (!hasPermission) {
        if (context.user == null) {
          throw new UnauthorizedError(
            permission.message || "Authentication required.",
          );
        }
        throw new ForbiddenError(
          permission.message || "Permission denied.",
        );
      }
    }
  }

  /**
   * Create a view function for a specific action
   *
   * This is used by the router to create URL patterns.
   */
  static asView(actions: Record<HttpMethod, ActionType>): View {
    const ViewSetClass = this;

    return async (request: Request, params: Record<string, string>) => {
      const method = request.method.toUpperCase() as HttpMethod;
      const actionName = actions[method];

      if (!actionName) {
        return new Response(
          JSON.stringify({ error: "Method not allowed" }),
          {
            status: 405,
            headers: {
              "Content-Type": "application/json",
              "Allow": Object.keys(actions).join(", "),
            },
          },
        );
      }

      // Create a new instance for each request
      const viewset = new ViewSetClass();

      // Build context with user info (if available from request)
      const context: ViewSetContext = {
        request,
        params,
        action: actionName,
      };

      // Initialize with context
      viewset.initialize(context);

      // Check throttles before permissions
      const throttleResponse = viewset.checkThrottles(context);
      if (throttleResponse) {
        return throttleResponse;
      }

      // Check permissions before executing the action
      try {
        await viewset.checkPermissions(context);
      } catch (error) {
        if (error instanceof UnauthorizedError) {
          return Response.json(
            { error: error.message },
            { status: 401 },
          );
        }
        if (error instanceof ForbiddenError) {
          return Response.json(
            { error: error.message },
            { status: 403 },
          );
        }
        throw error;
      }

      // Get the action method
      const actionMethod =
        (viewset as unknown as Record<string, unknown>)[actionName];
      if (typeof actionMethod !== "function") {
        return Response.json(
          { error: `Action '${actionName}' not implemented` },
          { status: 501 },
        );
      }

      // Call the action
      try {
        return await actionMethod.call(viewset, context);
      } catch (error) {
        // Re-throw permission errors to return proper status codes
        if (
          error instanceof UnauthorizedError ||
          error instanceof ForbiddenError
        ) {
          const status = error instanceof UnauthorizedError ? 401 : 403;
          return Response.json(
            { error: error.message },
            { status },
          );
        }
        console.error(`Error in ${actionName}:`, error);
        return Response.json(
          { error: "Internal server error" },
          { status: 500 },
        );
      }
    };
  }

  /**
   * Get the basename for this ViewSet (used for URL naming)
   */
  static getBasename(): string {
    // Remove "ViewSet" suffix and convert to lowercase
    return this.name.replace(/ViewSet$/i, "").toLowerCase();
  }

  // ==========================================================================
  // Optional action stubs (override in subclasses)
  // ==========================================================================

  /**
   * List all objects (GET /)
   */
  async list?(context: ViewSetContext): Promise<Response>;

  /**
   * Create a new object (POST /)
   */
  async create?(context: ViewSetContext): Promise<Response>;

  /**
   * Retrieve a single object (GET /:id/)
   */
  async retrieve?(context: ViewSetContext): Promise<Response>;

  /**
   * Update an object completely (PUT /:id/)
   */
  async update?(context: ViewSetContext): Promise<Response>;

  /**
   * Partially update an object (PATCH /:id/)
   */
  async partial_update?(context: ViewSetContext): Promise<Response>;

  /**
   * Delete an object (DELETE /:id/)
   */
  async destroy?(context: ViewSetContext): Promise<Response>;
}
