/**
 * REST API Backend for Alexi ORM
 *
 * A generic, extensible REST backend that maps ORM operations to HTTP requests.
 * Designed to work with any REST API that follows standard conventions.
 *
 * Features:
 * - Automatic ORM-to-REST mapping (QueryState → HTTP requests)
 * - Auth header injection via {@link ModelEndpoint.getAuthHeaders} (per-endpoint)
 * - Special query handlers for custom endpoints
 * - Model actions (e.g., /projects/:id/publish/)
 * - Fully extensible via subclassing
 *
 * @module
 *
 * @example Basic usage
 * ```ts
 * import { RestBackend } from "@alexi/db/backends/rest";
 *
 * const backend = new RestBackend({
 *   apiUrl: "https://api.example.com",
 * });
 * await backend.connect();
 *
 * // Use with ORM
 * const tasks = await TaskModel.objects.using(backend).all().fetch();
 * ```
 *
 * @example Auth via ModelEndpoint.getAuthHeaders
 * ```ts
 * import { ModelEndpoint, DetailAction, RestBackend } from "@alexi/db/backends/rest";
 *
 * abstract class AuthEndpoint extends ModelEndpoint {
 *   abstract model: typeof Model;
 *   abstract path: string;
 *
 *   override async getAuthHeaders() {
 *     const token = localStorage.getItem("access_token");
 *     return token ? { Authorization: `Bearer ${token}` } : {};
 *   }
 * }
 *
 * class ProjectEndpoint extends AuthEndpoint {
 *   model = ProjectModel;
 *   path = "/projects/";
 *   publish = new DetailAction();
 * }
 *
 * const backend = new RestBackend({
 *   apiUrl: "https://api.example.com",
 *   endpoints: [ProjectEndpoint],
 * });
 * ```
 *
 * @example Subclassing for app-specific methods
 * ```ts
 * class MyRestBackend extends RestBackend {
 *   async updateProfile(data: Record<string, unknown>) {
 *     return this.request("/auth/me/", { method: "PATCH", body: JSON.stringify(data) });
 *   }
 * }
 * ```
 */

import { DatabaseBackend } from "../backend.ts";
import type { SchemaEditor, Transaction } from "../backend.ts";
import { Model } from "../../models/model.ts";
import type {
  Aggregations,
  CompiledQuery,
  ParsedFilter,
  QueryState,
} from "../../query/types.ts";
import { introspectEndpoints } from "./endpoints.ts";
import type {
  EndpointIntrospection,
  ModelEndpoint,
  RegisteredAction,
} from "./endpoints.ts";

export { DatabaseBackend } from "../backend.ts";
export type { DatabaseConfig, SchemaEditor, Transaction } from "../backend.ts";
export type { Model } from "../../models/model.ts";
export type {
  Aggregation,
  Aggregations,
  Annotations,
  CompiledQuery,
  LookupType,
  ParsedFilter,
  ParsedOrdering,
  QueryOperation,
  QueryState,
} from "../../query/types.ts";
export type {
  EndpointIntrospection,
  ModelEndpoint,
  RegisteredAction,
  RegisteredDetailAction,
  RegisteredListAction,
} from "./endpoints.ts";
export type { Field } from "../../fields/field.ts";
export { RelatedManager } from "../../fields/relations.ts";

// =============================================================================
// Configuration
// =============================================================================

/**
 * REST Backend configuration
 *
 * @example Minimal config
 * ```ts
 * { apiUrl: "https://api.example.com" }
 * ```
 *
 * @example Full config
 * ```ts
 * {
 *   apiUrl: "https://api.example.com",
 *   debug: true,
 *   endpoints: [ProjectEndpoint, OrganisationEndpoint],
 * }
 * ```
 */
export interface RestBackendConfig {
  /** API base URL (e.g., `https://api.example.com/api`) */
  apiUrl: string;

  /** Enable debug logging. Default: `false` */
  debug?: boolean;

  /**
   * Declarative endpoint configurations (DRF-style).
   *
   * Register {@link ModelEndpoint} subclasses to declaratively define
   * actions, singleton queries, and endpoint mappings using field-like
   * descriptors.
   *
   * Override {@link ModelEndpoint.getAuthHeaders} on a shared base class
   * to inject authentication headers (e.g., `Authorization: Bearer <token>`)
   * for all requests made through these endpoints.
   *
   * @example
   * ```ts
   * import { ModelEndpoint, DetailAction, SingletonQuery } from "@alexi/db/backends/rest";
   *
   * // Shared base that provides auth headers for all endpoints
   * abstract class AuthEndpoint extends ModelEndpoint {
   *   abstract model: typeof Model;
   *   abstract path: string;
   *
   *   override async getAuthHeaders() {
   *     const token = localStorage.getItem("access_token");
   *     return token ? { Authorization: `Bearer ${token}` } : {};
   *   }
   * }
   *
   * class ProjectEndpoint extends AuthEndpoint {
   *   model = ProjectModel;
   *   path = "/projects/";
   *   publish = new DetailAction();       // POST /projects/:id/publish/
   *   unpublish = new DetailAction();     // POST /projects/:id/unpublish/
   * }
   *
   * class OrganisationEndpoint extends AuthEndpoint {
   *   model = OrganisationModel;
   *   path = "/organisations/";
   *   current = new SingletonQuery();     // filter({current: true}) → GET /organisations/current/
   * }
   *
   * const backend = new RestBackend({
   *   apiUrl: "https://api.example.com/api",
   *   endpoints: [ProjectEndpoint, OrganisationEndpoint],
   * });
   * ```
   */
  endpoints?: (new () => ModelEndpoint)[];
}

// =============================================================================
// Special Query Handler
// =============================================================================

/**
 * Maps specific ORM filter combinations to custom API endpoints.
 *
 * This is useful for non-standard REST endpoints like `/organisations/current/`
 * that should be reachable via ORM syntax:
 *
 * ```ts
 * const org = await OrganisationModel.objects
 *   .using(backend)
 *   .filter({ current: true })
 *   .first();
 * // → GET /organisations/current/
 * ```
 *
 * @example
 * ```ts
 * {
 *   matches: (filters) =>
 *     filters.length === 1 &&
 *     filters[0].field === "current" &&
 *     filters[0].value === true,
 *   getEndpoint: () => "/organisations/current/",
 *   returnsSingle: true,
 * }
 * ```
 */
export interface SpecialQueryHandler {
  /**
   * Check if this handler matches the given filters.
   * Return `true` to handle the query with `getEndpoint()`.
   */
  matches: (
    filters: Array<{ field: string; lookup: string; value: unknown }>,
  ) => boolean;

  /**
   * Return the custom endpoint URL (relative to `apiUrl`) for this query.
   */
  getEndpoint: (
    filters: Array<{ field: string; lookup: string; value: unknown }>,
  ) => string;

  /**
   * If `true`, the endpoint returns a single object instead of an array.
   * The result will be wrapped in `[result]` for ORM compatibility.
   * Default: `false`
   */
  returnsSingle?: boolean;
}

// =============================================================================
// Error Class
// =============================================================================

/**
 * Data for constructing a RestApiError
 */
export interface RestApiErrorData {
  /** HTTP status code returned by the API. */
  status: number;
  /** Human-readable error message. */
  message: string;
  /** Raw response body captured for debugging. */
  body?: string;
}

/**
 * Error thrown when a REST API request fails.
 *
 * Provides convenient methods to check the error category:
 *
 * ```ts
 * try {
 *   await backend.insert(instance);
 * } catch (error) {
 *   if (error instanceof RestApiError) {
 *     if (error.isAuthError()) navigate("/login");
 *     if (error.isNotFound()) showNotFound();
 *     if (error.isRetryable()) retryLater();
 *   }
 * }
 * ```
 */
export class RestApiError extends Error {
  /** HTTP status code */
  readonly status: number;
  /** Raw response body (may be JSON string) */
  readonly body?: string;

  /**
   * Create a REST API error.
   *
   * @param data HTTP status, message, and optional raw response body.
   */
  constructor(data: RestApiErrorData) {
    super(data.message);
    this.name = "RestApiError";
    this.status = data.status;
    this.body = data.body;
  }

  /** 401 or 403 — user needs to (re-)authenticate */
  isAuthError(): boolean {
    return this.status === 401 || this.status === 403;
  }

  /** 404 — resource not found */
  isNotFound(): boolean {
    return this.status === 404;
  }

  /** 5xx — server error */
  isServerError(): boolean {
    return this.status >= 500;
  }

  /** 5xx or 429 — safe to retry later */
  isRetryable(): boolean {
    return this.isServerError() || this.status === 429;
  }

  /**
   * Try to parse the response body as JSON.
   * Returns `null` if parsing fails.
   */
  parsedBody(): Record<string, unknown> | null {
    if (!this.body) return null;
    try {
      return JSON.parse(this.body);
    } catch {
      return null;
    }
  }
}

// =============================================================================
// RestBackend Class
// =============================================================================

/**
 * REST API Backend for Alexi ORM
 *
 * Maps ORM operations to standard REST HTTP requests:
 *
 * | ORM Operation | HTTP Method | URL Pattern |
 * |---------------|-------------|-------------|
 * | `objects.all().fetch()` | GET | `/{endpoint}/` |
 * | `objects.filter({…}).fetch()` | GET | `/{endpoint}/?field=value` |
 * | `objects.create({…})` | POST | `/{endpoint}/` |
 * | `instance.save()` (update) | PUT | `/{endpoint}/{id}/` |
 * | `instance.delete()` | DELETE | `/{endpoint}/{id}/` |
 * | `objects.get({id: 1})` | GET | `/{endpoint}/1/` |
 *
 * ### Authentication
 *
 * Authentication is handled by {@link ModelEndpoint.getAuthHeaders}.
 * Override `getAuthHeaders()` in a shared base endpoint class to inject
 * `Authorization` headers (or any other auth scheme) for all requests:
 *
 * ```ts
 * abstract class AuthEndpoint extends ModelEndpoint {
 *   abstract model: typeof Model;
 *   abstract path: string;
 *
 *   override async getAuthHeaders() {
 *     const token = localStorage.getItem("access_token");
 *     return token ? { Authorization: `Bearer ${token}` } : {};
 *   }
 * }
 * ```
 *
 * ### Endpoint Resolution
 *
 * The endpoint for a model is resolved from the registered {@link ModelEndpoint}
 * classes. Registration via the `endpoints` config option is required.
 *
 * ### Extending
 *
 * Subclass `RestBackend` to add app-specific behavior:
 *
 * - Override `getSpecialQueryHandlers()` for custom query → endpoint mappings
 * - Override `getEndpointForModel()` for custom endpoint resolution
 * - Override `extractData()` to customize how model data is serialized
 * - Override `formatDateForApi()` to change date serialization
 * - Add app-specific methods (e.g., `publishProject()`)
 * - Use the protected `request()` method for custom API calls
 */
export class RestBackend extends DatabaseBackend {
  private _apiUrl: string;
  private _debug: boolean;
  private _endpointMap: Record<string, string>;
  private _pathMap: Record<string, string>;
  private _registeredActions: Map<string, RegisteredAction[]> = new Map();
  private _endpointIntrospections: EndpointIntrospection[] = [];
  private _endpointSpecialHandlers: Record<string, SpecialQueryHandler[]> = {};
  /** Retained endpoint instances keyed by model class name, for auth header resolution. */
  private _endpointInstances: Map<string, ModelEndpoint> = new Map();

  /**
   * Create a REST backend.
   *
   * @param config API base URL, debug flag, and declarative endpoint config.
   */
  constructor(config: RestBackendConfig) {
    super({
      engine: "rest",
      name: config.apiUrl,
      options: config as unknown as Record<string, unknown>,
    });

    this._apiUrl = config.apiUrl.replace(/\/$/, "");
    this._debug = config.debug ?? false;
    this._endpointMap = {};
    this._pathMap = {};

    // Register declarative endpoints (DRF-style)
    if (config.endpoints && config.endpoints.length > 0) {
      this._registerEndpoints(config.endpoints);
    }
  }

  // ===========================================================================
  // Public Accessors
  // ===========================================================================

  /** The API base URL (without trailing slash) */
  get apiUrl(): string {
    return this._apiUrl;
  }

  // ===========================================================================
  // HTTP Helpers (protected — available to subclasses)
  // ===========================================================================

  /**
   * Make an HTTP request to the API.
   *
   * This is the core HTTP method used by all ORM operations.
   * Auth headers are resolved from the endpoint instance's `getAuthHeaders()`
   * and passed in via the `authHeaders` parameter.
   * Subclasses can also use it for app-specific endpoints:
   *
   * ```ts
   * class MyBackend extends RestBackend {
   *   async getStats() {
   *     return this.request<Stats>("/stats/");
   *   }
   *
   *   async publishProject(id: number) {
   *     return this.request("/projects/" + id + "/publish/", { method: "POST" });
   *   }
   * }
   * ```
   *
   * @param endpoint - URL path relative to `apiUrl` (e.g., `/users/`)
   * @param options - Standard `fetch` options.
   * @param authHeaders - Auth headers from the endpoint's `getAuthHeaders()`. Defaults to `{}`.
   * @returns Parsed JSON response
   * @throws {RestApiError} on non-2xx responses
   */
  protected async request<T = unknown>(
    endpoint: string,
    options: RequestInit = {},
    authHeaders: Record<string, string> = {},
  ): Promise<T> {
    const response = await fetch(`${this._apiUrl}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
        ...(options.headers as Record<string, string> ?? {}),
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      this._log(`API error ${response.status}:`, errorBody);

      throw new RestApiError({
        status: response.status,
        message:
          `API request failed: ${response.status} ${response.statusText}`,
        body: errorBody,
      });
    }

    const text = await response.text();
    if (!text) return {} as T;

    return JSON.parse(text);
  }

  // ===========================================================================
  // Generic HTTP Methods (for ad-hoc API calls)
  // ===========================================================================

  /** `GET {apiUrl}{path}` */
  async get<T = unknown>(path: string): Promise<T> {
    return this.request<T>(path, { method: "GET" });
  }

  /** `POST {apiUrl}{path}` */
  async post<T = unknown>(path: string, data?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: "POST",
      body: data !== undefined ? JSON.stringify(data) : undefined,
    });
  }

  /** `PUT {apiUrl}{path}` */
  async put<T = unknown>(path: string, data: unknown): Promise<T> {
    return this.request<T>(path, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  /** `PATCH {apiUrl}{path}` */
  async patch<T = unknown>(path: string, data: unknown): Promise<T> {
    return this.request<T>(path, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  /** `DELETE {apiUrl}{path}` */
  async deleteRequest<T = unknown>(path: string): Promise<T> {
    return this.request<T>(path, { method: "DELETE" });
  }

  // ===========================================================================
  // Model Actions
  // ===========================================================================

  /**
   * Call a custom action on a model instance.
   *
   * Maps to `POST /{endpoint}/{id}/{action}/`
   *
   * @example
   * ```ts
   * // POST /projects/42/publish/
   * await backend.callModelAction("projects", 42, "publish");
   *
   * // POST /connections/5/accept/ with body
   * await backend.callModelAction("connections", 5, "accept", { note: "OK" });
   * ```
   *
   * @param modelNameOrTable - Model's `dbTable` name or constructor name
   * @param id - Instance primary key
   * @param action - Action name (becomes the URL segment)
   * @param data - Optional request body
   */
  async callModelAction<T = Record<string, unknown>>(
    modelNameOrTable: string,
    id: number | string,
    action: string,
    data?: Record<string, unknown>,
  ): Promise<T> {
    const endpoint = this._endpointMap[modelNameOrTable] || modelNameOrTable;
    const url = `/${endpoint}/${id}/${action}/`;

    this._log(`POST ${url}`, data);

    const authHeaders = await this._getAuthHeadersForKey(modelNameOrTable);

    return this.request<T>(url, {
      method: "POST",
      body: JSON.stringify(data ?? {}),
    }, authHeaders);
  }

  // ===========================================================================
  // Declarative Endpoint Actions (DRF-style)
  // ===========================================================================

  /**
   * Call a registered action from a ModelEndpoint declaration.
   *
   * Type-safe alternative to {@link callModelAction}. Actions are declared
   * as field-like descriptors on ModelEndpoint subclasses.
   *
   * @example Detail action (like DRF `@action(detail=True)`)
   * ```ts
   * class ProjectEndpoint extends ModelEndpoint {
   *   model = ProjectModel;
   *   publish = new DetailAction();
   * }
   *
   * // POST /projects/42/publish/
   * await backend.action(ProjectEndpoint, "publish", 42);
   *
   * // With request body:
   * await backend.action(ProjectEndpoint, "publish", 42, { notify: true });
   * ```
   *
   * @example List action (like DRF `@action(detail=False)`)
   * ```ts
   * class ProjectEndpoint extends ModelEndpoint {
   *   model = ProjectModel;
   *   published = new ListAction({ method: "GET" });
   * }
   *
   * // GET /projects/published/
   * const projects = await backend.action(ProjectEndpoint, "published");
   * ```
   *
   * @param EndpointClass - The ModelEndpoint subclass containing the action
   * @param actionName - Property name of the action on the endpoint class
   * @param idOrData - Instance ID (for detail actions) or request body (for list actions)
   * @param data - Request body (for detail actions)
   * @returns Parsed JSON response
   * @throws {Error} if the action is not registered
   */
  async action<T = Record<string, unknown>>(
    EndpointClass: new () => ModelEndpoint,
    actionName: string,
    idOrData?: number | string | Record<string, unknown>,
    data?: Record<string, unknown>,
  ): Promise<T> {
    const endpointClassName = EndpointClass.name;
    const actions = this._registeredActions.get(endpointClassName);

    if (!actions) {
      throw new Error(
        `No actions registered for endpoint "${endpointClassName}". ` +
          `Did you include it in the "endpoints" config?`,
      );
    }

    const registered = actions.find((a) => a.propertyName === actionName);
    if (!registered) {
      const available = actions.map((a) => a.propertyName).join(", ");
      throw new Error(
        `Action "${actionName}" not found on "${endpointClassName}". ` +
          `Available actions: ${available}`,
      );
    }

    if (registered.type === "detail") {
      // Detail action: idOrData is the ID, data is the body
      if (idOrData === undefined || idOrData === null) {
        throw new Error(
          `Detail action "${actionName}" requires an instance ID`,
        );
      }
      const id = idOrData;
      const url = `/${registered.endpoint}/${id}/${registered.urlSegment}/`;
      this._log(`${registered.method} ${url}`, data);

      const authHeaders = await this._getAuthHeadersForKey(endpointClassName);

      return this.request<T>(url, {
        method: registered.method,
        body: JSON.stringify(data ?? {}),
      }, authHeaders);
    } else {
      // List action: idOrData is the body (optional)
      const body = typeof idOrData === "object" ? idOrData : data;
      const url = `/${registered.endpoint}/${registered.urlSegment}/`;
      this._log(`${registered.method} ${url}`, body);

      const options: RequestInit = { method: registered.method };
      if (registered.method !== "GET" && body) {
        options.body = JSON.stringify(body);
      }

      const authHeaders = await this._getAuthHeadersForKey(endpointClassName);

      return this.request<T>(url, options, authHeaders);
    }
  }

  /**
   * Get all registered actions for a ModelEndpoint class.
   *
   * Useful for debugging or building dynamic UIs.
   *
   * @example
   * ```ts
   * const actions = backend.getRegisteredActions(ProjectEndpoint);
   * // [
   * //   { type: "detail", propertyName: "publish", urlSegment: "publish", ... },
   * //   { type: "list", propertyName: "published", urlSegment: "published", ... },
   * // ]
   * ```
   */
  getRegisteredActions(
    EndpointClass: new () => ModelEndpoint,
  ): readonly RegisteredAction[] {
    return this._registeredActions.get(EndpointClass.name) ?? [];
  }

  /**
   * Get introspection results for all registered endpoints.
   *
   * Useful for debugging or building admin UIs.
   */
  getEndpointIntrospections(): readonly EndpointIntrospection[] {
    return this._endpointIntrospections;
  }

  // ===========================================================================
  // Extensibility Points (protected — override in subclasses)
  // ===========================================================================

  /**
   * Resolve the REST API endpoint for a model class or instance.
   *
   * Looks up the endpoint segment from registered ModelEndpoint classes.
   * If no endpoint is registered, throws an error — explicit registration
   * via `endpoints` config is required.
   *
   * Override this to implement custom endpoint resolution:
   *
   * ```ts
   * protected override getEndpointForModel(modelOrName: Model | string): string {
   *   // Custom logic
   *   return super.getEndpointForModel(modelOrName);
   * }
   * ```
   */
  protected getEndpointForModel(
    modelOrName: Model | (typeof Model) | string,
  ): string {
    // Case 1: Model instance
    if (typeof modelOrName !== "string" && typeof modelOrName !== "function") {
      const modelClass = modelOrName.constructor as typeof Model;
      return this._resolveEndpointFromModelClass(modelClass);
    }

    // Case 2: Model class (typeof Model)
    if (typeof modelOrName === "function") {
      return this._resolveEndpointFromModelClass(modelOrName as typeof Model);
    }

    // Case 3: String (model name or endpoint segment)
    // Check endpointMap for the exact string
    if (this._endpointMap[modelOrName]) {
      return this._endpointMap[modelOrName];
    }

    // No registration found - return as-is (caller may have passed endpoint directly)
    return modelOrName;
  }

  /**
   * Resolve endpoint from a model class.
   * Looks up endpointMap by class name. No auto-derivation.
   */
  private _resolveEndpointFromModelClass(modelClass: typeof Model): string {
    const name = modelClass.name;

    // Check endpointMap by class name
    if (this._endpointMap[name]) {
      return this._endpointMap[name];
    }

    // No registration found - throw error to require explicit registration
    throw new Error(
      `No endpoint registered for model "${name}". ` +
        `Register a ModelEndpoint class with explicit \`path\` in RestBackend config.`,
    );
  }

  /**
   * Return special query handlers for custom endpoint mappings.
   *
   * Override this to map specific ORM filters to custom API endpoints:
   *
   * ```ts
   * protected override getSpecialQueryHandlers() {
   *   return {
   *     organisations: [{
   *       matches: (filters) =>
   *         filters.length === 1 &&
   *         filters[0].field === "current" &&
   *         filters[0].value === true,
   *       getEndpoint: () => "/organisations/current/",
   *       returnsSingle: true,
   *     }],
   *     users: [{
   *       matches: (filters) =>
   *         filters.length === 1 &&
   *         filters[0].field === "current" &&
   *         filters[0].value === true,
   *       getEndpoint: () => "/users/current/",
   *       returnsSingle: true,
   *     }],
   *   };
   * }
   * ```
   *
   * Then in your components:
   * ```ts
   * const org = await OrganisationModel.objects
   *   .using(backend)
   *   .filter({ current: true })
   *   .first();
   * // → GET /organisations/current/
   * ```
   */
  protected getSpecialQueryHandlers(): Record<string, SpecialQueryHandler[]> {
    return {};
  }

  // ===========================================================================
  // Endpoint Registration (private)
  // ===========================================================================

  /**
   * Register declarative ModelEndpoint classes.
   *
   * Introspects each endpoint class and extracts:
   * - Endpoint mappings (model → URL path)
   * - Detail and list actions
   * - Singleton queries (→ SpecialQueryHandlers)
   *
   * Endpoint instances are retained in `_endpointInstances` so that
   * `getAuthHeaders()` can be called at request time.
   */
  private _registerEndpoints(
    endpointClasses: (new () => ModelEndpoint)[],
  ): void {
    this._endpointIntrospections = introspectEndpoints(endpointClasses);

    for (let i = 0; i < this._endpointIntrospections.length; i++) {
      const info = this._endpointIntrospections[i];
      const EndpointClass = endpointClasses[i];

      // Retain instance for auth header resolution at request time
      const instance = new EndpointClass();
      this._endpointInstances.set(info.modelName, instance);

      // 1. Register endpoint mapping (model name → endpoint segment)
      this._endpointMap[info.modelName] = info.endpoint;

      // 1b. Register path mapping (model name → full path)
      this._pathMap[info.modelName] = info.path;

      // 2. Collect actions
      const actions: RegisteredAction[] = [
        ...info.detailActions,
        ...info.listActions,
      ];
      if (actions.length > 0) {
        // Key by endpoint class name (not model name) to support
        // looking up by EndpointClass in action()
        this._registeredActions.set(EndpointClass.name, actions);
        // Also retain instance keyed by endpoint class name for action() auth
        this._endpointInstances.set(EndpointClass.name, instance);
      }

      // 3. Register singleton queries as SpecialQueryHandlers
      if (info.singletonQueries.length > 0) {
        if (!this._endpointSpecialHandlers[info.endpoint]) {
          this._endpointSpecialHandlers[info.endpoint] = [];
        }
        this._endpointSpecialHandlers[info.endpoint].push(
          ...info.singletonQueries,
        );
      }

      this._log(
        `Registered endpoint: ${info.path}`,
        `(${info.detailActions.length} detail, ` +
          `${info.listActions.length} list, ` +
          `${info.singletonQueries.length} singleton)`,
      );
    }
  }

  /**
   * Extract serializable data from a model instance for API requests.
   *
   * By default, iterates over all fields with a `.get()` method,
   * skips `null` values, and formats `Date` objects.
   *
   * Override to customize serialization:
   *
   * ```ts
   * protected override extractData(instance: Model): Record<string, unknown> {
   *   const data = super.extractData(instance);
   *   // Add computed field
   *   data.fullName = `${data.firstName} ${data.lastName}`;
   *   return data;
   * }
   * ```
   */
  protected extractData<T extends Model>(
    instance: T,
  ): Record<string, unknown> {
    const data: Record<string, unknown> = {};
    const fields = instance as unknown as Record<string, unknown>;

    for (const key of Object.keys(fields)) {
      const field = fields[key];
      if (
        key === "objects" || key === "meta" || key === "_backend" ||
        key === "_relatedManagers"
      ) continue;

      if (field && typeof field === "object") {
        // Check if this is a ForeignKey field (has .id property and .isLoaded method)
        // deno-lint-ignore no-explicit-any
        const fkField = field as any;
        if (
          "id" in fkField &&
          typeof fkField.isLoaded === "function"
        ) {
          // ForeignKey: use .id (the raw FK ID) instead of .get() which throws
          const fkId = fkField.id;
          if (fkId !== null && fkId !== undefined) {
            data[key] = fkId;
          }
          continue;
        }

        // Regular field with .get() method
        if (typeof (field as { get?: () => unknown }).get === "function") {
          try {
            const value = (field as { get: () => unknown }).get();
            if (value !== null) {
              if (value instanceof Date) {
                data[key] = this.formatDateForApi(value);
              } else {
                data[key] = value;
              }
            }
          } catch {
            // Field might not have a valid get method
          }
        }
      }
    }

    return data;
  }

  /**
   * Format a `Date` for inclusion in API request bodies.
   *
   * Default format: `YYYY-MM-DD`
   *
   * Override to use ISO 8601 or another format:
   *
   * ```ts
   * protected override formatDateForApi(date: Date): string {
   *   return date.toISOString();
   * }
   * ```
   */
  protected formatDateForApi(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  // ===========================================================================
  // Connection Management
  // ===========================================================================

  /**
   * Mark the backend as connected.
   *
   * The REST backend does not open a socket or session, so connection is a
   * lightweight readiness flag used by the shared backend interface.
   */
  async connect(): Promise<void> {
    this._connected = true;
    this._log("Connected");
  }

  /**
   * Mark the backend as disconnected.
   *
   * No remote teardown is required; this only updates backend state.
   */
  async disconnect(): Promise<void> {
    this._connected = false;
    this._log("Disconnected");
  }

  // ===========================================================================
  // Query Execution (DatabaseBackend interface)
  // ===========================================================================

  /**
   * Execute a query against the REST API.
   *
   * Translates ORM `QueryState` into a GET request with query parameters:
   * - Filters → `?field=value` or `?field__lookup=value`
   * - Ordering → `?ordering=field,-other_field`
   * - Pagination → `?limit=10&offset=20`
   *
   * Special query handlers are checked first — if one matches, it takes priority.
   */
  async execute<T extends Model>(
    state: QueryState<T>,
  ): Promise<Record<string, unknown>[]> {
    const modelClass = state.model as unknown as typeof Model;
    const endpoint = this.getEndpointForModel(modelClass);

    this._log(
      `[execute] endpoint=${endpoint}, filters=`,
      JSON.stringify(state.filters),
    );

    const authHeaders = await this._getAuthHeadersForKey(modelClass.name);

    // Check for special query handlers
    const handler = this._findSpecialQueryHandler(endpoint, state.filters);
    if (handler) {
      this._log(`[execute] Using special handler for ${endpoint}`);
      const customUrl = handler.getEndpoint(state.filters);

      if (handler.returnsSingle) {
        const result = await this.request<Record<string, unknown>>(
          customUrl,
          {},
          authHeaders,
        );
        return result ? [result] : [];
      } else {
        return await this.request<Record<string, unknown>[]>(
          customUrl,
          {},
          authHeaders,
        );
      }
    }

    // Optimization: if filtering only by PK with exact match, use detail endpoint
    // This is DRF-compatible: GET /endpoint/:id/ instead of GET /endpoint/?id=X
    const pkFilter = this._detectPkFilter(state);
    if (pkFilter !== null) {
      this._log(`[execute] Using detail endpoint for PK lookup: ${pkFilter}`);
      try {
        const result = await this.request<Record<string, unknown>>(
          `/${endpoint}/${pkFilter}/`,
          {},
          authHeaders,
        );
        return result ? [result] : [];
      } catch (error) {
        if (error instanceof RestApiError && error.isNotFound()) {
          return [];
        }
        throw error;
      }
    }

    // Standard query: build query parameters
    const params = new URLSearchParams();

    for (const filter of state.filters) {
      const paramName = filter.lookup === "exact"
        ? filter.field
        : `${filter.field}__${filter.lookup}`;
      params.set(paramName, String(filter.value));
    }

    if (state.ordering.length > 0) {
      const orderingStr = state.ordering
        .map((o) => (o.direction === "DESC" ? `-${o.field}` : o.field))
        .join(",");
      params.set("ordering", orderingStr);
    }

    if (state.limit !== null) {
      params.set("limit", String(state.limit));
    }
    if (state.offset !== null) {
      params.set("offset", String(state.offset));
    }

    const queryString = params.toString();
    const url = `/${endpoint}/${queryString ? `?${queryString}` : ""}`;

    this._log(`[execute] GET ${url}`);

    const results = await this.request<Record<string, unknown>[]>(
      url,
      {},
      authHeaders,
    );
    return results;
  }

  /**
   * Execute a raw backend-specific query.
   *
   * Raw query execution is intentionally unsupported because the REST backend
   * exposes HTTP resources rather than a query language.
   *
   * @throws {Error} Always.
   */
  async executeRaw<R = unknown>(
    _query: string,
    _params?: unknown[],
  ): Promise<R[]> {
    throw new Error("executeRaw is not supported by RestBackend");
  }

  // ===========================================================================
  // CRUD Operations
  // ===========================================================================

  /**
   * Create a remote record with `POST /{endpoint}/`.
   *
   * @param instance Model instance to serialize and send.
   * @returns The created record payload returned by the API.
   */
  async insert<T extends Model>(
    instance: T,
  ): Promise<Record<string, unknown>> {
    const endpoint = this.getEndpointForModel(instance);
    const data = this.extractData(instance);

    this._log(`POST /${endpoint}/`, data);

    const modelClass = instance.constructor as typeof Model;
    const authHeaders = await this._getAuthHeadersForKey(modelClass.name);

    return await this.request<Record<string, unknown>>(
      `/${endpoint}/`,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
      authHeaders,
    );
  }

  /**
   * Replace a remote record with `PUT /{endpoint}/{id}/`.
   *
   * @param instance Persisted model instance containing the new state.
   */
  async update<T extends Model>(instance: T): Promise<void> {
    const endpoint = this.getEndpointForModel(instance);
    const id = this._getRecordId(instance);
    const data = this.extractData(instance);

    this._log(`PUT /${endpoint}/${id}/`, data);

    const modelClass = instance.constructor as typeof Model;
    const authHeaders = await this._getAuthHeadersForKey(modelClass.name);

    await this.request(`/${endpoint}/${id}/`, {
      method: "PUT",
      body: JSON.stringify(data),
    }, authHeaders);
  }

  /**
   * Partially update a remote record with `PATCH /{endpoint}/{id}/`.
   *
   * Only the fields listed in `fields` are included in the request body.
   * All other fields on the server-side record are left unchanged.
   *
   * @param instance Persisted model instance containing the updated values.
   * @param fields Names of the model fields to include in the PATCH body.
   */
  async partialUpdate<T extends Model>(
    instance: T,
    fields: string[],
  ): Promise<void> {
    const endpoint = this.getEndpointForModel(instance);
    const id = this._getRecordId(instance);
    const allData = this.extractData(instance);

    // Keep only the requested fields
    const data: Record<string, unknown> = {};
    for (const field of fields) {
      if (Object.prototype.hasOwnProperty.call(allData, field)) {
        data[field] = allData[field];
      }
    }

    this._log(`PATCH /${endpoint}/${id}/`, data);

    const modelClass = instance.constructor as typeof Model;
    const authHeaders = await this._getAuthHeadersForKey(modelClass.name);

    await this.request(`/${endpoint}/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }, authHeaders);
  }

  /**
   * Delete a remote record with `DELETE /{endpoint}/{id}/`.
   *
   * @param instance Persisted model instance to delete.
   */
  async delete<T extends Model>(instance: T): Promise<void> {
    const endpoint = this.getEndpointForModel(instance);
    const id = this._getRecordId(instance);

    this._log(`DELETE /${endpoint}/${id}/`);

    const modelClass = instance.constructor as typeof Model;
    const authHeaders = await this._getAuthHeadersForKey(modelClass.name);

    await this.request(`/${endpoint}/${id}/`, {
      method: "DELETE",
    }, authHeaders);
  }

  /**
   * Delete a remote record by endpoint name and primary key.
   *
   * @param tableName Registered model name or endpoint segment.
   * @param id Primary key value.
   */
  async deleteById(tableName: string, id: unknown): Promise<void> {
    const endpoint = this._endpointMap[tableName] || tableName;

    this._log(`DELETE /${endpoint}/${id}/`);

    const authHeaders = await this._getAuthHeadersForKey(tableName);

    await this.request(`/${endpoint}/${id}/`, {
      method: "DELETE",
    }, authHeaders);
  }

  /**
   * Fetch a single record with `GET /{endpoint}/{id}/`.
   *
   * @param model Model constructor used to resolve the endpoint.
   * @param id Primary key value.
   * @returns The record payload, or `null` when the API returns 404.
   */
  async getById<T extends Model>(
    model: new () => T,
    id: unknown,
  ): Promise<Record<string, unknown> | null> {
    const modelClass = model as unknown as typeof Model;
    const endpoint = this.getEndpointForModel(modelClass);

    this._log(`GET /${endpoint}/${id}/`);

    const authHeaders = await this._getAuthHeadersForKey(modelClass.name);

    try {
      return await this.request<Record<string, unknown>>(
        `/${endpoint}/${id}/`,
        {},
        authHeaders,
      );
    } catch (error) {
      if (error instanceof RestApiError && error.isNotFound()) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Check whether a record exists by attempting a detail fetch.
   *
   * @returns `true` when the API returns a record, otherwise `false`.
   */
  async existsById<T extends Model>(
    model: new () => T,
    id: unknown,
  ): Promise<boolean> {
    const result = await this.getById(model, id);
    return result !== null;
  }

  // ===========================================================================
  // Bulk Operations
  // ===========================================================================

  /**
   * Insert multiple records sequentially.
   *
   * The REST backend does not assume a bulk-create endpoint, so this is
   * implemented as repeated `insert()` calls.
   */
  async bulkInsert<T extends Model>(
    instances: T[],
  ): Promise<Record<string, unknown>[]> {
    const results: Record<string, unknown>[] = [];
    for (const instance of instances) {
      const result = await this.insert(instance);
      results.push(result);
    }
    return results;
  }

  /**
   * Update multiple records sequentially.
   *
   * The REST backend does not assume a bulk-update endpoint, so this is
   * implemented as repeated `update()` calls.
   *
   * @returns Number of updated instances.
   */
  async bulkUpdate<T extends Model>(
    instances: T[],
    _fields: string[],
  ): Promise<number> {
    for (const instance of instances) {
      await this.update(instance);
    }
    return instances.length;
  }

  /**
   * Update multiple records selected by a queryset.
   *
   * @throws {Error} Always, unless a subclass adds dedicated support.
   */
  async updateMany<T extends Model>(
    _state: QueryState<T>,
    _values: Record<string, unknown>,
  ): Promise<number> {
    throw new Error("updateMany is not supported by RestBackend");
  }

  /**
   * Delete multiple records selected by a queryset.
   *
   * @throws {Error} Always, unless a subclass adds dedicated support.
   */
  async deleteMany<T extends Model>(_state: QueryState<T>): Promise<number> {
    throw new Error("deleteMany is not supported by RestBackend");
  }

  // ===========================================================================
  // Aggregation
  // ===========================================================================

  /**
   * Count records matching the queryset.
   *
   * Tries `/{endpoint}/count/` first, then falls back to fetching results and
   * counting them locally when the API does not expose a count endpoint.
   */
  async count<T extends Model>(state: QueryState<T>): Promise<number> {
    const modelClass = state.model as unknown as typeof Model;
    const endpoint = this.getEndpointForModel(modelClass);

    const authHeaders = await this._getAuthHeadersForKey(modelClass.name);

    try {
      const params = new URLSearchParams();
      for (const filter of state.filters) {
        const paramName = filter.lookup === "exact"
          ? filter.field
          : `${filter.field}__${filter.lookup}`;
        params.set(paramName, String(filter.value));
      }
      const queryString = params.toString();
      const url = `/${endpoint}/count/${queryString ? `?${queryString}` : ""}`;

      const result = await this.request<{ count: number }>(
        url,
        {},
        authHeaders,
      );
      return result.count;
    } catch {
      // Fall back to fetching all and counting
      const results = await this.execute(state);
      return results.length;
    }
  }

  /**
   * Run aggregate functions for a queryset.
   *
   * @throws {Error} Always, unless a subclass adds dedicated support.
   */
  async aggregate<T extends Model>(
    _state: QueryState<T>,
    _aggregations: Aggregations,
  ): Promise<Record<string, number>> {
    throw new Error("aggregate is not supported by RestBackend");
  }

  // ===========================================================================
  // Transactions (not supported)
  // ===========================================================================

  /**
   * Begin a transaction.
   *
   * Transactions are not meaningful for stateless HTTP requests.
   *
   * @throws {Error} Always.
   */
  async beginTransaction(): Promise<Transaction> {
    throw new Error("Transactions are not supported by RestBackend");
  }

  // ===========================================================================
  // Schema Operations (not applicable)
  // ===========================================================================

  /**
   * Return a schema editor implementation.
   *
   * Schema migration operations are not supported by the REST backend.
   *
   * @throws {Error} Always.
   */
  getSchemaEditor(): SchemaEditor {
    throw new Error("Schema operations are not supported by RestBackend");
  }

  /**
   * Report whether a logical table exists.
   *
   * Always returns `true` because REST resources are not introspected as tables.
   */
  async tableExists(_tableName: string): Promise<boolean> {
    return true; // REST backend doesn't have tables
  }

  // ===========================================================================
  // Query Compilation
  // ===========================================================================

  /**
   * Compile a queryset into a transport-neutral query description.
   *
   * This is primarily useful for debugging, logging, or adapters that want a
   * normalized representation of the pending ORM operation.
   */
  compile<T extends Model>(state: QueryState<T>): CompiledQuery {
    const modelClass = state.model as unknown as typeof Model;
    const endpoint = this.getEndpointForModel(modelClass);

    return {
      operation: {
        type: "select",
        table: endpoint,
        filters: state.filters,
        ordering: state.ordering,
        fields: state.selectFields,
        limit: state.limit,
        offset: state.offset,
      },
      params: [],
    };
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  /** Get the primary key value from a model instance */
  private _getRecordId<T extends Model>(instance: T): unknown {
    const fields = instance as unknown as Record<string, { get(): unknown }>;

    if (fields.id && typeof fields.id.get === "function") {
      return fields.id.get();
    }

    if (fields.pk && typeof fields.pk.get === "function") {
      return fields.pk.get();
    }

    throw new Error("Unable to determine record ID");
  }

  /** Find a matching special query handler for the given endpoint and filters */
  private _findSpecialQueryHandler(
    endpoint: string,
    filters: ParsedFilter[],
  ): SpecialQueryHandler | null {
    // 1. Check handlers from declarative endpoints first
    const endpointHandlers = this._endpointSpecialHandlers[endpoint];
    if (endpointHandlers) {
      for (const handler of endpointHandlers) {
        if (handler.matches(filters)) {
          return handler;
        }
      }
    }

    // 2. Fall back to override-based handlers (backwards compat)
    const allHandlers = this.getSpecialQueryHandlers();
    const handlers = allHandlers[endpoint];
    if (!handlers) return null;

    for (const handler of handlers) {
      if (handler.matches(filters)) {
        return handler;
      }
    }
    return null;
  }

  /**
   * Detect if the query is filtering only by primary key with exact match.
   *
   * Returns the PK value if so, null otherwise.
   * This enables using the REST detail endpoint (GET /endpoint/:id/) instead of
   * query params (GET /endpoint/?id=X), which is more DRF-compatible.
   */
  private _detectPkFilter<T extends Model>(
    state: QueryState<T>,
  ): unknown | null {
    // Only optimize for single exact filter on PK
    if (state.filters.length !== 1) return null;

    const filter = state.filters[0];
    if (filter.lookup !== "exact") return null;

    // Get the PK field name from the model
    const modelClass = state.model;
    const instance = new modelClass();
    const pkField = instance.getPrimaryKeyField();
    if (!pkField) return null;

    // Check if the filter is on the PK field
    if (filter.field === pkField.name) {
      return filter.value;
    }

    return null;
  }

  /**
   * Resolve auth headers for a given model class name or endpoint class name.
   *
   * Looks up the retained endpoint instance from `_endpointInstances` and
   * calls `getAuthHeaders()` on it. Falls back to `{}` when no instance is
   * found (e.g., for generic helpers with no model context).
   */
  private async _getAuthHeadersForKey(key: string): Promise<
    Record<string, string>
  > {
    const instance = this._endpointInstances.get(key);
    if (!instance) return {};
    return await instance.getAuthHeaders();
  }

  /** Log a debug message if debug mode is enabled */
  private _log(...args: unknown[]): void {
    if (this._debug) {
      console.log("[RestBackend]", ...args);
    }
  }

  // ============================================================================
  // Nested Lookup Support (not needed for REST - server handles it)
  // ============================================================================

  /**
   * Execute a simple filter query on a table
   *
   * Not used by REST backend because nested lookups are passed directly
   * to the server as query parameters (e.g., ?projectRole__project=123).
   *
   * @throws Error - REST backend delegates nested lookups to the server
   */
  protected executeSimpleFilter(
    _tableName: string,
    _filters: ParsedFilter[],
  ): Promise<Record<string, unknown>[]> {
    throw new Error(
      "REST backend does not use executeSimpleFilter - nested lookups are handled by the server",
    );
  }
}
