/**
 * Base ViewSet class for Alexi REST Framework
 *
 * ViewSets combine the logic for handling multiple related views into a single class.
 *
 * @module @alexi/restframework/viewsets/viewset
 */

import type { View } from "@alexi/urls";

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
 */
export class ViewSet {
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
  protected context: Record<string, unknown> = {};

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

      // Initialize with context
      viewset.initialize({
        request,
        params,
        action: actionName,
      });

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
        return await actionMethod.call(viewset, {
          request,
          params,
          action: actionName,
        });
      } catch (error) {
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
