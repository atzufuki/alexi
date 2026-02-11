/**
 * Declarative REST Endpoint Configuration (DRF-style)
 *
 * Provides ModelEndpoint classes with field-like descriptors for declaring
 * REST API shape — mirroring Django REST Framework's ViewSet and @action patterns.
 *
 * Instead of imperative `endpointMap` and `getSpecialQueryHandlers()` overrides,
 * declare endpoints declaratively with an explicit `path`:
 *
 * ```ts
 * class ProjectEndpoint extends ModelEndpoint {
 *   model = ProjectModel;
 *   path = "/projects/";  // Explicit full path - required
 *
 *   publish = new DetailAction();      // POST /projects/:id/publish/
 *   unpublish = new DetailAction();    // POST /projects/:id/unpublish/
 *   published = new ListAction({ method: "GET" });  // GET /projects/published/
 * }
 *
 * class OrganisationEndpoint extends ModelEndpoint {
 *   model = OrganisationModel;
 *   path = "/organisations/";
 *
 *   current = new SingletonQuery();    // filter({current: true}) → GET /organisations/current/
 *   activate = new DetailAction();     // POST /organisations/:id/activate/
 * }
 * ```
 *
 * Register with RestBackend:
 *
 * ```ts
 * const backend = new RestBackend({
 *   apiUrl: "https://api.example.com/api",
 *   endpoints: [ProjectEndpoint, OrganisationEndpoint],
 * });
 * ```
 *
 * The `path` property is **required** and must be the full API path with
 * leading and trailing slashes (e.g., `/projects/`). No auto-derivation
 * from model names or dbTable — what you write is what you get.
 *
 * @module
 */

import type { Model } from "../../models/model.ts";
import type { SpecialQueryHandler } from "./backend.ts";

// =============================================================================
// Utility
// =============================================================================

/**
 * Convert a camelCase string to kebab-case.
 *
 * Used to derive URL segments from action property names,
 * following DRF's convention of snake_case → kebab-case URLs.
 *
 * @example
 * ```ts
 * camelToKebab("shareProject")    // → "share-project"
 * camelToKebab("shareEmployees")  // → "share-employees"
 * camelToKebab("publish")         // → "publish"
 * camelToKebab("getMe")           // → "get-me"
 * ```
 */
export function camelToKebab(str: string): string {
  return str
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

// =============================================================================
// Descriptor Options
// =============================================================================

/**
 * Options for {@link DetailAction}.
 */
export interface DetailActionOptions {
  /**
   * HTTP method for the action.
   * Default: `"POST"`
   */
  method?: "POST" | "PUT" | "PATCH" | "DELETE";

  /**
   * Custom URL segment override.
   * By default, the property name is converted to kebab-case.
   *
   * @example
   * ```ts
   * // Property "foo" but URL is /endpoint/:id/custom-name/
   * foo = new DetailAction({ urlSegment: "custom-name" });
   * ```
   */
  urlSegment?: string;
}

/**
 * Options for {@link ListAction}.
 */
export interface ListActionOptions {
  /**
   * HTTP method for the action.
   * Default: `"POST"`
   */
  method?: "POST" | "GET";

  /**
   * Whether the endpoint returns a single object instead of an array.
   * If `true`, the result is wrapped in `[result]` for ORM compatibility.
   * Default: `false`
   */
  single?: boolean;

  /**
   * Custom URL segment override.
   * By default, the property name is converted to kebab-case.
   */
  urlSegment?: string;
}

/**
 * Options for {@link SingletonQuery}.
 */
export interface SingletonQueryOptions {
  /**
   * Custom URL segment override.
   * By default, the property name is used as the URL segment.
   *
   * @example
   * ```ts
   * // filter({current: true}) → GET /endpoint/me/ (instead of /endpoint/current/)
   * current = new SingletonQuery({ urlSegment: "me" });
   * ```
   */
  urlSegment?: string;

  /**
   * The filter value that triggers this query.
   * Default: `true`
   *
   * @example
   * ```ts
   * // filter({status: "active"}) → GET /endpoint/active/
   * status = new SingletonQuery({ matchValue: "active" });
   * ```
   */
  matchValue?: unknown;
}

// =============================================================================
// Descriptor Classes (Field-like declarations)
// =============================================================================

/**
 * Detail action descriptor — maps to `{METHOD} /endpoint/:id/action_name/`.
 *
 * Analogous to DRF's `@action(detail=True)`.
 *
 * @example
 * ```ts
 * class ProjectEndpoint extends ModelEndpoint {
 *   model = ProjectModel;
 *
 *   // POST /projects/:id/publish/
 *   publish = new DetailAction();
 *
 *   // DELETE /projects/:id/archive/
 *   archive = new DetailAction({ method: "DELETE" });
 *
 *   // POST /connections/:id/share-project/ (camelCase → kebab-case)
 *   shareProject = new DetailAction();
 * }
 * ```
 */
export class DetailAction<TResponse = Record<string, unknown>> {
  readonly _type = "detail" as const;
  readonly method: "POST" | "PUT" | "PATCH" | "DELETE";
  readonly urlSegment?: string;

  constructor(options: DetailActionOptions = {}) {
    this.method = options.method ?? "POST";
    this.urlSegment = options.urlSegment;
  }
}

/**
 * List action descriptor — maps to `{METHOD} /endpoint/action_name/`.
 *
 * Analogous to DRF's `@action(detail=False)`.
 *
 * @example
 * ```ts
 * class ProjectEndpoint extends ModelEndpoint {
 *   model = ProjectModel;
 *
 *   // GET /projects/published/ → returns array
 *   published = new ListAction({ method: "GET" });
 *
 *   // POST /projects/bulk-create/
 *   bulkCreate = new ListAction();
 *
 *   // GET /projects/statistics/ → returns single object
 *   statistics = new ListAction({ method: "GET", single: true });
 * }
 * ```
 */
export class ListAction<TResponse = Record<string, unknown>> {
  readonly _type = "list" as const;
  readonly method: "POST" | "GET";
  readonly single: boolean;
  readonly urlSegment?: string;

  constructor(options: ListActionOptions = {}) {
    this.method = options.method ?? "POST";
    this.single = options.single ?? false;
    this.urlSegment = options.urlSegment;
  }
}

/**
 * Singleton query descriptor — maps ORM filter to a custom endpoint.
 *
 * `filter({fieldName: true})` → `GET /endpoint/field_name/`
 *
 * Replaces verbose {@link SpecialQueryHandler} declarations with a single field.
 *
 * @example
 * ```ts
 * class OrganisationEndpoint extends ModelEndpoint {
 *   model = OrganisationModel;
 *
 *   // filter({current: true}) → GET /organisations/current/
 *   current = new SingletonQuery();
 *
 *   // filter({status: "active"}) → GET /organisations/active/
 *   status = new SingletonQuery({ matchValue: "active", urlSegment: "active" });
 * }
 *
 * // Usage:
 * const org = await OrganisationModel.objects
 *   .using(backend)
 *   .filter({ current: true })
 *   .first();
 * // → GET /organisations/current/
 * ```
 */
export class SingletonQuery {
  readonly _type = "singleton" as const;
  readonly urlSegment?: string;
  readonly matchValue: unknown;

  constructor(options: SingletonQueryOptions = {}) {
    this.urlSegment = options.urlSegment;
    this.matchValue = options.matchValue ?? true;
  }
}

// =============================================================================
// ModelEndpoint Base Class
// =============================================================================

/**
 * Base class for declarative REST endpoint configuration.
 *
 * Analogous to DRF's ViewSet, but on the client side. Subclass this
 * and declare fields to describe your API shape.
 *
 * The `path` property is **required** and must be the full API path with
 * leading and trailing slashes (e.g., `/projects/`). No auto-derivation
 * from model names or dbTable — what you write is what you get.
 *
 * @example
 * ```ts
 * class ProjectEndpoint extends ModelEndpoint {
 *   model = ProjectModel;
 *   path = "/projects/";  // Required - explicit full path
 *
 *   publish = new DetailAction();           // POST /projects/:id/publish/
 *   unpublish = new DetailAction();         // POST /projects/:id/unpublish/
 *   published = new ListAction({ method: "GET" });  // GET /projects/published/
 * }
 *
 * class ConnectionEndpoint extends ModelEndpoint {
 *   model = ConnectionModel;
 *   path = "/connections/";
 *
 *   accept = new DetailAction();            // POST /connections/:id/accept/
 *   decline = new DetailAction();           // POST /connections/:id/decline/
 *   shareProject = new DetailAction();      // POST /connections/:id/share-project/
 * }
 * ```
 */
export abstract class ModelEndpoint {
  /** The ORM model this endpoint is for */
  abstract model: typeof Model;

  /**
   * The full API path for this endpoint.
   *
   * Must include leading and trailing slashes.
   * Example: `/projects/`, `/organisations/`, `/employee-competences/`
   *
   * This is **required** — no auto-derivation from model name or dbTable.
   */
  abstract path: string;
}

// =============================================================================
// Descriptor Type Guards
// =============================================================================

/** Type guard for field-like endpoint descriptors */
type EndpointDescriptor = DetailAction | ListAction | SingletonQuery;

/** Check if a value is a DetailAction descriptor */
export function isDetailAction(value: unknown): value is DetailAction {
  return value instanceof DetailAction;
}

/** Check if a value is a ListAction descriptor */
export function isListAction(value: unknown): value is ListAction {
  return value instanceof ListAction;
}

/** Check if a value is a SingletonQuery descriptor */
export function isSingletonQuery(value: unknown): value is SingletonQuery {
  return value instanceof SingletonQuery;
}

/** Check if a value is any endpoint descriptor */
export function isEndpointDescriptor(
  value: unknown,
): value is EndpointDescriptor {
  return isDetailAction(value) || isListAction(value) ||
    isSingletonQuery(value);
}

// =============================================================================
// Registered Action Info (internal, used by RestBackend)
// =============================================================================

/**
 * Internal representation of a registered detail action.
 * Created by RestBackend during endpoint introspection.
 */
export interface RegisteredDetailAction {
  type: "detail";
  /** Endpoint base path (e.g., "projects") */
  endpoint: string;
  /** Action URL segment (e.g., "publish", "share-project") */
  urlSegment: string;
  /** HTTP method */
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  /** Original property name on the ModelEndpoint class */
  propertyName: string;
}

/**
 * Internal representation of a registered list action.
 * Created by RestBackend during endpoint introspection.
 */
export interface RegisteredListAction {
  type: "list";
  /** Endpoint base path (e.g., "projects") */
  endpoint: string;
  /** Action URL segment (e.g., "published", "bulk-create") */
  urlSegment: string;
  /** HTTP method */
  method: "POST" | "GET";
  /** Whether the endpoint returns a single object */
  single: boolean;
  /** Original property name on the ModelEndpoint class */
  propertyName: string;
}

/** Union of registered action types */
export type RegisteredAction = RegisteredDetailAction | RegisteredListAction;

// =============================================================================
// Endpoint Introspection
// =============================================================================

/**
 * Result of introspecting a ModelEndpoint class.
 * Contains all the information RestBackend needs to configure itself.
 */
export interface EndpointIntrospection {
  /** Model constructor */
  modelClass: typeof Model;
  /** Model constructor name (e.g., "ProjectModel") */
  modelName: string;
  /**
   * The full API path from the endpoint (e.g., "/projects/").
   * This is the explicit `path` property from ModelEndpoint.
   */
  path: string;
  /**
   * The endpoint path segment without slashes (e.g., "projects").
   * Derived from `path` by trimming slashes.
   */
  endpoint: string;
  /** Detail actions (POST /endpoint/:id/action/) */
  detailActions: RegisteredDetailAction[];
  /** List actions (GET|POST /endpoint/action/) */
  listActions: RegisteredListAction[];
  /** Singleton queries (filter → custom endpoint) */
  singletonQueries: SpecialQueryHandler[];
}

/**
 * Extract the endpoint segment from a full path.
 *
 * Trims leading and trailing slashes.
 * E.g., "/projects/" → "projects", "/employee-competences/" → "employee-competences"
 */
function pathToEndpoint(path: string): string {
  return path.replace(/^\/+|\/+$/g, "");
}

/**
 * Introspect a ModelEndpoint class to extract all descriptor declarations.
 *
 * Scans the instance properties for DetailAction, ListAction, and
 * SingletonQuery descriptors and returns structured registration info.
 *
 * @param EndpointClass - The ModelEndpoint subclass to introspect
 * @returns Structured endpoint configuration for RestBackend
 *
 * @example
 * ```ts
 * class ProjectEndpoint extends ModelEndpoint {
 *   model = ProjectModel;
 *   path = "/projects/";
 *   publish = new DetailAction();
 *   current = new SingletonQuery();
 * }
 *
 * const info = introspectEndpoint(ProjectEndpoint);
 * // info.path → "/projects/"
 * // info.endpoint → "projects"
 * // info.detailActions → [{ urlSegment: "publish", method: "POST", ... }]
 * // info.singletonQueries → [SpecialQueryHandler for "current"]
 * ```
 */
export function introspectEndpoint(
  EndpointClass: new () => ModelEndpoint,
): EndpointIntrospection {
  const instance = new EndpointClass();
  const modelClass = instance.model;
  const modelName = modelClass.name;

  // Use explicit path - no auto-derivation
  const path = instance.path;
  const endpoint = pathToEndpoint(path);

  const detailActions: RegisteredDetailAction[] = [];
  const listActions: RegisteredListAction[] = [];
  const singletonQueries: SpecialQueryHandler[] = [];

  // Scan all own properties for descriptors
  for (const key of Object.keys(instance)) {
    if (key === "model" || key === "path") continue;

    const value = (instance as unknown as Record<string, unknown>)[key];

    if (isDetailAction(value)) {
      const urlSegment = value.urlSegment ?? camelToKebab(key);
      detailActions.push({
        type: "detail",
        endpoint,
        urlSegment,
        method: value.method,
        propertyName: key,
      });
    } else if (isListAction(value)) {
      const urlSegment = value.urlSegment ?? camelToKebab(key);
      listActions.push({
        type: "list",
        endpoint,
        urlSegment,
        method: value.method,
        single: value.single,
        propertyName: key,
      });
    } else if (isSingletonQuery(value)) {
      const urlSegment = value.urlSegment ?? key;
      const matchValue = value.matchValue;

      singletonQueries.push({
        matches: (
          filters: Array<{ field: string; lookup: string; value: unknown }>,
        ) =>
          filters.length === 1 &&
          filters[0].field === key &&
          filters[0].lookup === "exact" &&
          filters[0].value === matchValue,
        getEndpoint: () => `${path}${urlSegment}/`,
        returnsSingle: true,
      });
    }
  }

  return {
    modelClass,
    modelName,
    path,
    endpoint,
    detailActions,
    listActions,
    singletonQueries,
  };
}

/**
 * Introspect multiple ModelEndpoint classes at once.
 *
 * @param endpointClasses - Array of ModelEndpoint subclasses
 * @returns Array of endpoint introspection results
 */
export function introspectEndpoints(
  endpointClasses: (new () => ModelEndpoint)[],
): EndpointIntrospection[] {
  return endpointClasses.map(introspectEndpoint);
}
