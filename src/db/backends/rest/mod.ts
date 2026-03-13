/**
 * REST API Backend for Alexi ORM
 *
 * A generic, extensible REST backend that maps ORM operations to HTTP requests.
 * Supports special query handlers, model actions, and declarative endpoint
 * configuration (DRF-style). Authentication is delegated to
 * {@link ModelEndpoint.getAuthHeaders} — override it on a shared base endpoint
 * class to inject `Authorization` headers for all requests.
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
 * @example Declarative endpoints with auth (DRF-style)
 * ```ts
 * import {
 *   DetailAction,
 *   ModelEndpoint,
 *   RestBackend,
 *   SingletonQuery,
 * } from "@alexi/db/backends/rest";
 *
 * // Shared base that injects auth headers for all endpoints
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
 */

export { RestApiError, RestBackend } from "./backend.ts";

export type {
  DatabaseConfig,
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
