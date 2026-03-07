/**
 * REST API Backend for Alexi ORM
 *
 * A generic, extensible REST backend that maps ORM operations to HTTP requests.
 * Supports JWT authentication, special query handlers, model actions, and
 * declarative endpoint configuration (DRF-style).
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
 * const tasks = await TaskModel.objects.using(backend).all().fetch();
 * ```
 *
 * @example Declarative endpoints (DRF-style)
 * ```ts
 * import {
 *   DetailAction,
 *   ModelEndpoint,
 *   RestBackend,
 *   SingletonQuery,
 * } from "@alexi/db/backends/rest";
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
 *
 * // Type-safe action call
 * await backend.action(ProjectEndpoint, "publish", 42);
 *
 * // ORM with auto-generated special query handler
 * const org = await OrganisationModel.objects
 *   .using(backend)
 *   .filter({ current: true })
 *   .first();
 * ```
 *
 * @example Subclassing for app-specific behavior (legacy)
 * ```ts
 * import { RestBackend } from "@alexi/db/backends/rest";
 * import type { SpecialQueryHandler } from "@alexi/db/backends/rest";
 *
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
 * }
 * ```
 */

export { clearAuthTokens, RestApiError, RestBackend } from "./backend.ts";

export type {
  AuthEndpoints,
  AuthResponse,
  AuthTokens,
  AuthUser,
  DatabaseConfig,
  LoginCredentials,
  RegisterData,
  RestApiErrorData,
  RestBackendConfig,
  SpecialQueryHandler,
} from "./backend.ts";

// Declarative endpoint configuration (DRF-style)
export {
  camelToKebab,
  DetailAction,
  introspectEndpoint,
  introspectEndpoints,
  isDetailAction,
  isEndpointDescriptor,
  isListAction,
  isSingletonQuery,
  ListAction,
  ModelEndpoint,
  SingletonQuery,
} from "./endpoints.ts";

export type {
  DetailActionOptions,
  EndpointDescriptor,
  EndpointIntrospection,
  ListActionOptions,
  RegisteredAction,
  RegisteredDetailAction,
  RegisteredListAction,
  SingletonQueryOptions,
} from "./endpoints.ts";

// Public dependency types referenced by this submodule's API surface.
export { DatabaseBackend } from "../backend.ts";
export type { SchemaEditor, Transaction } from "../backend.ts";

export { Model } from "../../models/model.ts";
export type { ModelOperationOptions } from "../../models/model.ts";

export type {
  AggregateFunction,
  Aggregation,
  Aggregations,
  Annotations,
  CompiledQuery,
  FilterConditions,
  LookupType,
  OrderByField,
  ParsedFilter,
  ParsedOrdering,
  QueryOperation,
  QueryState,
} from "../../query/types.ts";

export type { Field } from "../../fields/field.ts";
export type {
  FieldOptions,
  ValidationResult,
  Validator,
} from "../../fields/field.ts";
export { RelatedManager } from "../../fields/relations.ts";
export type { ModelClass } from "../../fields/relations.ts";
export { Q } from "../../query/q.ts";
export type { QConnector, ResolvedQ } from "../../query/q.ts";
export {
  QuerySet,
  ValuesListQuerySet,
  ValuesQuerySet,
} from "../../query/queryset.ts";
export type { SaveResult } from "../../query/queryset.ts";
