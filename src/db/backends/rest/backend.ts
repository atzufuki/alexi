/**
 * REST API Backend for Alexi ORM
 *
 * A generic, extensible REST backend that maps ORM operations to HTTP requests.
 * Designed to work with any REST API that follows standard conventions.
 *
 * Features:
 * - Automatic ORM-to-REST mapping (QueryState → HTTP requests)
 * - JWT token management with auto-refresh
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
 * @example Subclassing for app-specific behavior
 * ```ts
 * class MyRestBackend extends RestBackend {
 *   constructor(apiUrl: string) {
 *     super({
 *       apiUrl,
 *       tokenStorageKey: "myapp_tokens",
 *     });
 *   }
 *
 *   protected override getSpecialQueryHandlers() {
 *     return {
 *       organisations: [{
 *         matches: (f) => f.length === 1 && f[0].field === "current",
 *         getEndpoint: () => "/organisations/current/",
 *         returnsSingle: true,
 *       }],
 *     };
 *   }
 *
 *   async updateProfile(data: Record<string, unknown>) {
 *     return this.request("/auth/me/", { method: "PATCH", body: JSON.stringify(data) });
 *   }
 * }
 * ```
 */

import { DatabaseBackend } from "../backend.ts";
import type { SchemaEditor, Transaction } from "../backend.ts";
import type { Model } from "../../models/model.ts";
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

// =============================================================================
// Auth Types
// =============================================================================

/**
 * Login credentials
 */
export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * Registration data
 */
export interface RegisterData {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  [key: string]: unknown;
}

/**
 * User data returned from auth endpoints.
 * Supports both camelCase and snake_case field names.
 */
export interface AuthUser {
  id: number | string;
  email: string;
  firstName?: string;
  lastName?: string;
  first_name?: string;
  last_name?: string;
  isActive?: boolean;
  is_active?: boolean;
  isAdmin?: boolean;
  is_admin?: boolean;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  lastLoginAt?: string | null;
  last_login_at?: string | null;
  [key: string]: unknown;
}

/**
 * Login/Register response from the API
 */
export interface AuthResponse {
  user: AuthUser;
  tokens: {
    accessToken: string;
    refreshToken: string;
    /** Token lifetime in seconds */
    expiresIn?: number;
    /** Absolute expiration timestamp (ISO 8601) */
    expiresAt?: string;
  };
}

/**
 * Authentication tokens stored by the backend
 */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

// =============================================================================
// Configuration
// =============================================================================

/**
 * Auth endpoint paths. All relative to `apiUrl`.
 */
export interface AuthEndpoints {
  /** Login endpoint. Default: `/auth/login/` */
  login?: string;
  /** Registration endpoint. Default: `/auth/register/` */
  register?: string;
  /** Token refresh endpoint. Default: `/auth/refresh/` */
  refresh?: string;
  /** Logout endpoint. Default: `/auth/logout/` */
  logout?: string;
  /** Current user profile endpoint. Default: `/auth/me/` */
  me?: string;
  /** Password change endpoint. Default: `/auth/change-password/` */
  changePassword?: string;
}

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
 *   tokenStorageKey: "myapp_auth_tokens",
 *   debug: true,
 *   authEndpoints: {
 *     login: "/auth/login/",
 *     register: "/auth/register/",
 *   },
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
   * localStorage key for token storage.
   * Default: `"alexi_auth_tokens"`
   */
  tokenStorageKey?: string;

  /**
   * Auth endpoint paths, relative to `apiUrl`.
   * Each endpoint has a sensible default — override only what you need.
   */
  authEndpoints?: AuthEndpoints;

  /**
   * Declarative endpoint configurations (DRF-style).
   *
   * Register {@link ModelEndpoint} subclasses to declaratively define
   * actions, singleton queries, and endpoint mappings using field-like
   * descriptors.
   *
   * @example
   * ```ts
   * import { ModelEndpoint, DetailAction, SingletonQuery } from "@alexi/db/backends/rest";
   *
   * class ProjectEndpoint extends ModelEndpoint {
   *   model = ProjectModel;
   *   publish = new DetailAction();       // POST /projects/:id/publish/
   *   unpublish = new DetailAction();     // POST /projects/:id/unpublish/
   * }
   *
   * class OrganisationEndpoint extends ModelEndpoint {
   *   model = OrganisationModel;
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
  status: number;
  message: string;
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
// Defaults
// =============================================================================

const DEFAULT_TOKEN_STORAGE_KEY = "alexi_auth_tokens";

const DEFAULT_AUTH_ENDPOINTS: Required<AuthEndpoints> = {
  login: "/auth/login/",
  register: "/auth/register/",
  refresh: "/auth/refresh/",
  logout: "/auth/logout/",
  me: "/auth/me/",
  changePassword: "/auth/change-password/",
};

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
 * ### Endpoint Resolution
 *
 * The endpoint for a model is resolved in this order:
 * 1. ModelEndpoint with explicit `endpoint` field
 * 2. `Model.meta.dbTable` (recommended)
 * 3. Auto-derived: strip "Model" suffix, lowercase, pluralize
 *
 * ### Extending
 *
 * Subclass `RestBackend` to add app-specific behavior:
 *
 * - Override `getSpecialQueryHandlers()` for custom query → endpoint mappings
 * - Override `getEndpointForModel()` for custom endpoint resolution
 * - Override `extractData()` to customize how model data is serialized
 * - Override `formatDateForApi()` to change date serialization
 * - Add app-specific methods (e.g., `updateProfile()`, `publishProject()`)
 * - Use the protected `request()` method for custom API calls
 */
export class RestBackend extends DatabaseBackend {
  private _apiUrl: string;
  private _debug: boolean;
  private _tokens: AuthTokens | null = null;
  private _refreshPromise: Promise<AuthTokens | null> | null = null;
  private _tokenStorageKey: string;
  private _authEndpoints: Required<AuthEndpoints>;
  private _endpointMap: Record<string, string>;
  private _dbTableToEndpoint: Record<string, string>;
  private _registeredActions: Map<string, RegisteredAction[]> = new Map();
  private _endpointIntrospections: EndpointIntrospection[] = [];
  private _endpointSpecialHandlers: Record<string, SpecialQueryHandler[]> = {};

  constructor(config: RestBackendConfig) {
    super({
      engine: "rest",
      name: config.apiUrl,
      options: config as unknown as Record<string, unknown>,
    });

    this._apiUrl = config.apiUrl.replace(/\/$/, "");
    this._debug = config.debug ?? false;
    this._tokenStorageKey = config.tokenStorageKey ?? DEFAULT_TOKEN_STORAGE_KEY;
    this._authEndpoints = {
      ...DEFAULT_AUTH_ENDPOINTS,
      ...(config.authEndpoints ?? {}),
    };
    this._endpointMap = {};
    this._dbTableToEndpoint = {};

    // Register declarative endpoints (DRF-style)
    if (config.endpoints && config.endpoints.length > 0) {
      this._registerEndpoints(config.endpoints);
    }

    this._loadTokens();
  }

  // ===========================================================================
  // Public Accessors
  // ===========================================================================

  /** The API base URL (without trailing slash) */
  get apiUrl(): string {
    return this._apiUrl;
  }

  /** The token storage key used for localStorage */
  get tokenStorageKey(): string {
    return this._tokenStorageKey;
  }

  /**
   * Check if the user is authenticated (has non-expired tokens).
   *
   * Reloads tokens from storage if not in memory, so this is safe
   * to call after another tab/component has logged in.
   */
  isAuthenticated(): boolean {
    if (this._tokens === null) {
      this._loadTokens();
    }
    return this._tokens !== null;
  }

  /**
   * Force-reload tokens from localStorage.
   * Useful after login in another tab or component.
   */
  reloadTokens(): void {
    this._loadTokens();
  }

  // ===========================================================================
  // Token Management
  // ===========================================================================

  private _loadTokens(): void {
    if (typeof localStorage === "undefined") return;

    try {
      const stored = localStorage.getItem(this._tokenStorageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        this._tokens = {
          ...parsed,
          expiresAt: new Date(parsed.expiresAt),
        };
        this._log(`Tokens loaded, expires: ${this._tokens?.expiresAt}`);
      }
    } catch (error) {
      this._log("Failed to load tokens from storage:", error);
      this._tokens = null;
    }
  }

  private _saveTokens(tokens: AuthTokens): void {
    this._tokens = tokens;
    if (typeof localStorage === "undefined") return;

    try {
      localStorage.setItem(this._tokenStorageKey, JSON.stringify(tokens));
    } catch (error) {
      this._log("Failed to save tokens to storage:", error);
    }
  }

  private _clearTokens(): void {
    this._tokens = null;
    if (typeof localStorage === "undefined") return;

    try {
      localStorage.removeItem(this._tokenStorageKey);
    } catch (error) {
      this._log("Failed to clear tokens from storage:", error);
    }
  }

  private _isTokenExpired(): boolean {
    if (!this._tokens) return true;
    const bufferMs = 60 * 1000; // 60 seconds buffer
    return this._tokens.expiresAt.getTime() - Date.now() < bufferMs;
  }

  private async _refreshAccessToken(): Promise<AuthTokens | null> {
    if (!this._tokens?.refreshToken) return null;

    // Prevent concurrent refresh requests
    if (this._refreshPromise) {
      return this._refreshPromise;
    }

    this._refreshPromise = this._doRefreshToken();

    try {
      return await this._refreshPromise;
    } finally {
      this._refreshPromise = null;
    }
  }

  private async _doRefreshToken(): Promise<AuthTokens | null> {
    try {
      const response = await fetch(
        `${this._apiUrl}${this._authEndpoints.refresh}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            refreshToken: this._tokens!.refreshToken,
          }),
        },
      );

      if (!response.ok) {
        this._log("Token refresh failed:", response.status);
        this._clearTokens();
        return null;
      }

      const data = await response.json();
      const expiresAt = this._resolveExpiresAt(data.tokens ?? data);

      const newTokens: AuthTokens = {
        accessToken: data.tokens?.accessToken ?? data.accessToken,
        refreshToken: data.tokens?.refreshToken ?? data.refreshToken ??
          this._tokens!.refreshToken,
        expiresAt,
      };

      this._saveTokens(newTokens);
      return newTokens;
    } catch (error) {
      this._log("Token refresh error:", error);
      return null;
    }
  }

  /**
   * Get authorization headers for an authenticated request.
   * Automatically refreshes the token if expired.
   */
  private async _getAuthHeaders(): Promise<Record<string, string>> {
    if (!this._tokens) {
      this._loadTokens();
    }

    if (!this._tokens) return {};

    if (this._isTokenExpired()) {
      const refreshed = await this._refreshAccessToken();
      if (!refreshed) return {};
    }

    return {
      Authorization: `Bearer ${this._tokens!.accessToken}`,
    };
  }

  // ===========================================================================
  // HTTP Helpers (protected — available to subclasses)
  // ===========================================================================

  /**
   * Make an authenticated HTTP request to the API.
   *
   * This is the core HTTP method used by all ORM operations.
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
   * @param options - Standard `fetch` options. Auth headers are added automatically.
   * @returns Parsed JSON response
   * @throws {RestApiError} on non-2xx responses
   */
  protected async request<T = unknown>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const authHeaders = await this._getAuthHeaders();

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
  // Authentication Methods
  // ===========================================================================

  /**
   * Login with email and password.
   *
   * Stores the returned JWT tokens and returns the full auth response.
   *
   * @example
   * ```ts
   * const { user, tokens } = await backend.login({
   *   email: "user@example.com",
   *   password: "secret",
   * });
   * console.log("Logged in as", user.email);
   * ```
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    this._log("Logging in:", credentials.email);

    const response = await fetch(
      `${this._apiUrl}${this._authEndpoints.login}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      this._log("Login failed:", errorBody);
      throw new RestApiError({
        status: response.status,
        message: "Login failed",
        body: errorBody,
      });
    }

    const data: AuthResponse = await response.json();
    const expiresAt = this._resolveExpiresAt(data.tokens);

    this._saveTokens({
      accessToken: data.tokens.accessToken,
      refreshToken: data.tokens.refreshToken,
      expiresAt,
    });

    this._log("Login successful");
    return data;
  }

  /**
   * Register a new user account.
   *
   * Stores the returned JWT tokens and returns the full auth response.
   *
   * @example
   * ```ts
   * const { user } = await backend.register({
   *   email: "new@example.com",
   *   password: "secret",
   *   firstName: "Jane",
   *   lastName: "Doe",
   * });
   * ```
   */
  async register(data: RegisterData): Promise<AuthResponse> {
    this._log("Registering:", data.email);

    const response = await fetch(
      `${this._apiUrl}${this._authEndpoints.register}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      this._log("Registration failed:", errorBody);
      throw new RestApiError({
        status: response.status,
        message: "Registration failed",
        body: errorBody,
      });
    }

    const responseData: AuthResponse = await response.json();
    const expiresAt = this._resolveExpiresAt(responseData.tokens);

    this._saveTokens({
      accessToken: responseData.tokens.accessToken,
      refreshToken: responseData.tokens.refreshToken,
      expiresAt,
    });

    this._log("Registration successful");
    return responseData;
  }

  /**
   * Logout the current user.
   *
   * Sends a logout request to the server (best-effort) and clears local tokens.
   */
  async logout(): Promise<void> {
    this._log("Logging out");

    if (this._tokens) {
      try {
        await fetch(`${this._apiUrl}${this._authEndpoints.logout}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this._tokens.accessToken}`,
          },
        });
      } catch (error) {
        this._log("Logout request failed (ignored):", error);
      }
    }

    this._clearTokens();
    this._log("Logged out");
  }

  /**
   * Get the current user's profile.
   *
   * @example
   * ```ts
   * const user = await backend.getMe();
   * console.log(user.email, user.firstName);
   * ```
   */
  async getMe(): Promise<AuthUser> {
    return this.request<AuthUser>(this._authEndpoints.me);
  }

  /**
   * Update the current user's profile.
   *
   * @example
   * ```ts
   * const updated = await backend.updateMe({ firstName: "Jane" });
   * ```
   */
  async updateMe(data: Partial<AuthUser>): Promise<AuthUser> {
    return this.request<AuthUser>(this._authEndpoints.me, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  /**
   * Change the current user's password.
   *
   * @example
   * ```ts
   * await backend.changePassword("oldPassword", "newPassword");
   * ```
   */
  async changePassword(
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    await this.request(this._authEndpoints.changePassword, {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  // ===========================================================================
  // Generic HTTP Methods (for ad-hoc API calls)
  // ===========================================================================

  /** `GET {apiUrl}{path}` with authentication */
  async get<T = unknown>(path: string): Promise<T> {
    return this.request<T>(path, { method: "GET" });
  }

  /** `POST {apiUrl}{path}` with authentication */
  async post<T = unknown>(path: string, data?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: "POST",
      body: data !== undefined ? JSON.stringify(data) : undefined,
    });
  }

  /** `PUT {apiUrl}{path}` with authentication */
  async put<T = unknown>(path: string, data: unknown): Promise<T> {
    return this.request<T>(path, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  /** `PATCH {apiUrl}{path}` with authentication */
  async patch<T = unknown>(path: string, data: unknown): Promise<T> {
    return this.request<T>(path, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  /** `DELETE {apiUrl}{path}` with authentication */
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

    return this.request<T>(url, {
      method: "POST",
      body: JSON.stringify(data ?? {}),
    });
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

      return this.request<T>(url, {
        method: registered.method,
        body: JSON.stringify(data ?? {}),
      });
    } else {
      // List action: idOrData is the body (optional)
      const body = typeof idOrData === "object" ? idOrData : data;
      const url = `/${registered.endpoint}/${registered.urlSegment}/`;
      this._log(`${registered.method} ${url}`, body);

      const options: RequestInit = { method: registered.method };
      if (registered.method !== "GET" && body) {
        options.body = JSON.stringify(body);
      }

      return this.request<T>(url, options);
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
   * Resolution order:
   * 1. ModelEndpoint with explicit `endpoint` field (registered via `endpoints` config)
   * 2. `Model.meta.dbTable` (e.g., `"tasks"`)
   * 3. Auto-derived: `"TaskModel"` → `"tasks"`
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

    // Case 3: String (model name or table name)
    // First check endpointMap for the exact string
    if (this._endpointMap[modelOrName]) {
      return this._endpointMap[modelOrName];
    }

    // Fall back to auto-derive from string
    return modelOrName.toLowerCase().replace("model", "s");
  }

  /**
   * Resolve endpoint from a model class.
   * Checks endpointMap by class name, then dbTableToEndpoint by dbTable, then uses dbTable directly.
   */
  private _resolveEndpointFromModelClass(modelClass: typeof Model): string {
    const name = modelClass.name;

    // 1. Check endpointMap first (by class name)
    if (this._endpointMap[name]) {
      return this._endpointMap[name];
    }

    // 2. Check dbTableToEndpoint by dbTable (for bundled code where class name changes)
    const dbTable = modelClass.meta?.dbTable;
    if (dbTable) {
      // Check if there's an explicit endpoint registered for this dbTable
      if (this._dbTableToEndpoint[dbTable]) {
        return this._dbTableToEndpoint[dbTable];
      }
      // Use dbTable directly as endpoint (no custom mapping)
      return dbTable;
    }

    // 3. Auto-derive from class name (last resort)
    return name.toLowerCase().replace("model", "s");
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
   * - Endpoint mappings (model → URL segment)
   * - Detail and list actions
   * - Singleton queries (→ SpecialQueryHandlers)
   */
  private _registerEndpoints(
    endpointClasses: (new () => ModelEndpoint)[],
  ): void {
    this._endpointIntrospections = introspectEndpoints(endpointClasses);

    for (const info of this._endpointIntrospections) {
      // 1. Register endpoint mapping (model name → endpoint path)
      this._endpointMap[info.modelName] = info.endpoint;

      // 1b. Also register dbTable → endpoint mapping for bundled code
      // where class names get mangled (e.g., ProjectRoleModel → _ProjectRoleModel)
      if (info.dbTable && info.dbTable !== info.endpoint) {
        this._dbTableToEndpoint[info.dbTable] = info.endpoint;
      }

      // 2. Collect actions
      const actions: RegisteredAction[] = [
        ...info.detailActions,
        ...info.listActions,
      ];
      if (actions.length > 0) {
        // Key by endpoint class name (not model name) to support
        // looking up by EndpointClass in action()
        const endpointClassName =
          endpointClasses[this._endpointIntrospections.indexOf(info)]
            .name;
        this._registeredActions.set(endpointClassName, actions);
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
        `Registered endpoint: ${info.endpoint}`,
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
    const fields = instance as unknown as Record<string, { get(): unknown }>;

    for (const key of Object.keys(fields)) {
      const field = fields[key];
      if (
        field &&
        typeof field === "object" &&
        typeof field.get === "function"
      ) {
        if (key === "objects" || key === "meta") continue;

        try {
          const value = field.get();
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

  async connect(): Promise<void> {
    this._connected = true;
    this._log("Connected");
  }

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

    // Check for special query handlers
    const handler = this._findSpecialQueryHandler(endpoint, state.filters);
    if (handler) {
      this._log(`[execute] Using special handler for ${endpoint}`);
      const customUrl = handler.getEndpoint(state.filters);

      if (handler.returnsSingle) {
        const result = await this.request<Record<string, unknown>>(customUrl);
        return result ? [result] : [];
      } else {
        return await this.request<Record<string, unknown>[]>(customUrl);
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

    return await this.request<Record<string, unknown>[]>(url);
  }

  async executeRaw<R = unknown>(
    _query: string,
    _params?: unknown[],
  ): Promise<R[]> {
    throw new Error("executeRaw is not supported by RestBackend");
  }

  // ===========================================================================
  // CRUD Operations
  // ===========================================================================

  async insert<T extends Model>(
    instance: T,
  ): Promise<Record<string, unknown>> {
    const endpoint = this.getEndpointForModel(instance);
    const data = this.extractData(instance);

    this._log(`POST /${endpoint}/`, data);

    return await this.request<Record<string, unknown>>(
      `/${endpoint}/`,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    );
  }

  async update<T extends Model>(instance: T): Promise<void> {
    const endpoint = this.getEndpointForModel(instance);
    const id = this._getRecordId(instance);
    const data = this.extractData(instance);

    this._log(`PUT /${endpoint}/${id}/`, data);

    await this.request(`/${endpoint}/${id}/`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async delete<T extends Model>(instance: T): Promise<void> {
    const endpoint = this.getEndpointForModel(instance);
    const id = this._getRecordId(instance);

    this._log(`DELETE /${endpoint}/${id}/`);

    await this.request(`/${endpoint}/${id}/`, {
      method: "DELETE",
    });
  }

  async deleteById(tableName: string, id: unknown): Promise<void> {
    const endpoint = this._endpointMap[tableName] || tableName;

    this._log(`DELETE /${endpoint}/${id}/`);

    await this.request(`/${endpoint}/${id}/`, {
      method: "DELETE",
    });
  }

  async getById<T extends Model>(
    model: new () => T,
    id: unknown,
  ): Promise<Record<string, unknown> | null> {
    const modelClass = model as unknown as typeof Model;
    const endpoint = this.getEndpointForModel(modelClass);

    this._log(`GET /${endpoint}/${id}/`);

    try {
      return await this.request<Record<string, unknown>>(
        `/${endpoint}/${id}/`,
      );
    } catch (error) {
      if (error instanceof RestApiError && error.isNotFound()) {
        return null;
      }
      throw error;
    }
  }

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

  async bulkUpdate<T extends Model>(
    instances: T[],
    _fields: string[],
  ): Promise<number> {
    for (const instance of instances) {
      await this.update(instance);
    }
    return instances.length;
  }

  async updateMany<T extends Model>(
    _state: QueryState<T>,
    _values: Record<string, unknown>,
  ): Promise<number> {
    throw new Error("updateMany is not supported by RestBackend");
  }

  async deleteMany<T extends Model>(_state: QueryState<T>): Promise<number> {
    throw new Error("deleteMany is not supported by RestBackend");
  }

  // ===========================================================================
  // Aggregation
  // ===========================================================================

  async count<T extends Model>(state: QueryState<T>): Promise<number> {
    const modelClass = state.model as unknown as typeof Model;
    const endpoint = this.getEndpointForModel(modelClass);

    try {
      const result = await this.request<{ count: number }>(
        `/${endpoint}/count/`,
      );
      return result.count;
    } catch {
      // Fall back to fetching all and counting
      const results = await this.execute(state);
      return results.length;
    }
  }

  async aggregate<T extends Model>(
    _state: QueryState<T>,
    _aggregations: Aggregations,
  ): Promise<Record<string, number>> {
    throw new Error("aggregate is not supported by RestBackend");
  }

  // ===========================================================================
  // Transactions (not supported)
  // ===========================================================================

  async beginTransaction(): Promise<Transaction> {
    throw new Error("Transactions are not supported by RestBackend");
  }

  // ===========================================================================
  // Schema Operations (not applicable)
  // ===========================================================================

  getSchemaEditor(): SchemaEditor {
    throw new Error("Schema operations are not supported by RestBackend");
  }

  async tableExists(_tableName: string): Promise<boolean> {
    return true; // REST backend doesn't have tables
  }

  // ===========================================================================
  // Query Compilation
  // ===========================================================================

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
   * Resolve an `expiresAt` Date from a token response that may
   * contain `expiresAt` (ISO string), `expiresIn` (seconds), or neither.
   */
  private _resolveExpiresAt(
    tokens: Record<string, unknown>,
  ): Date {
    if (tokens.expiresAt) {
      return new Date(tokens.expiresAt as string);
    }
    if (tokens.expiresIn) {
      return new Date(Date.now() + (tokens.expiresIn as number) * 1000);
    }
    // Default: 1 hour
    return new Date(Date.now() + 3600 * 1000);
  }

  /** Log a debug message if debug mode is enabled */
  private _log(...args: unknown[]): void {
    if (this._debug) {
      console.log("[RestBackend]", ...args);
    }
  }
}

// =============================================================================
// Utility Function
// =============================================================================

/**
 * Clear auth tokens from localStorage without needing a RestBackend instance.
 *
 * Useful for forced logout from error handlers:
 *
 * ```ts
 * import { clearAuthTokens } from "@alexi/db/backends/rest";
 *
 * if (error.status === 401) {
 *   clearAuthTokens("myapp_auth_tokens");
 *   navigate("/login");
 * }
 * ```
 *
 * @param storageKey - The localStorage key. Default: `"alexi_auth_tokens"`
 */
export function clearAuthTokens(
  storageKey: string = DEFAULT_TOKEN_STORAGE_KEY,
): void {
  if (typeof localStorage === "undefined") return;

  try {
    localStorage.removeItem(storageKey);
  } catch (error) {
    console.warn("[RestBackend] Failed to clear tokens from storage:", error);
  }
}
