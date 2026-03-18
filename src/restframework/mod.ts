/**
 * Alexi's Django REST Framework-style toolkit for building APIs.
 *
 * `@alexi/restframework` layers serializers, viewsets, routers, permissions,
 * authentication, pagination, throttling, versioning, and renderers on top of
 * Alexi's URL system and ORM. It is the main package for turning models and
 * request handlers into discoverable REST APIs with minimal boilerplate.
 *
 * Most projects start with `ModelSerializer`, `ModelViewSet`, and
 * `DefaultRouter`. From there, add permission classes, JWT authentication,
 * pagination, or alternative renderers such as the browsable API as needed.
 * The package follows Django REST Framework concepts closely, so terms like
 * serializer, viewset, action, and router map directly to familiar DRF flows.
 *
 * This package is request/response oriented and works wherever standard Web API
 * primitives are available. Individual integrations may still be runtime-
 * specific, such as JWT secret handling or ORM backend selection.
 *
 * @module @alexi/restframework
 *
 * @example ModelViewSet with router registration
 * ```ts
 * import {
 *   DefaultRouter,
 *   ModelSerializer,
 *   ModelViewSet,
 * } from "@alexi/restframework";
 * import { AssetModel } from "./models.ts";
 *
 * class AssetSerializer extends ModelSerializer {
 *   static override Meta = {
 *     model: AssetModel,
 *     fields: ["id", "name", "createdAt"],
 *   };
 * }
 *
 * class AssetViewSet extends ModelViewSet {
 *   model = AssetModel;
 *   serializer_class = AssetSerializer;
 * }
 *
 * const router = new DefaultRouter();
 * router.register("assets", AssetViewSet);
 * ```
 */

// ============================================================================
// Serializers
// ============================================================================

// Field types
export {
  BooleanField,
  CharField,
  ChoiceField,
  DateField,
  DateTimeField,
  EmailField,
  FileField,
  FloatField,
  ImageField,
  IntegerField,
  JSONField,
  ListField,
  PrimaryKeyRelatedField,
  SerializerField,
  SerializerMethodField,
  TextField,
  URLField,
  UUIDField,
} from "./serializers/mod.ts";

// Serializer classes
export {
  createModelSerializer,
  FieldValidationError,
  ModelSerializer,
  Serializer,
  SerializerValidationError,
  ValidationError,
} from "./serializers/mod.ts";

// Serializer types
export type {
  BaseFieldOptions,
  CharFieldOptions,
  ChoiceFieldOptions,
  FieldValidationResult,
  FileFieldOptions,
  FloatFieldOptions,
  IntegerFieldOptions,
  ListFieldOptions,
  ModelClass,
  ModelSerializerMeta,
  PrimaryKeyRelatedFieldOptions,
  SerializerFieldOptions,
  SerializerMethodFieldOptions,
  SerializerOptions,
  ValidationErrors,
} from "./serializers/mod.ts";

// ============================================================================
// ViewSets
// ============================================================================

export {
  // Decorators
  action,
  // Mixins
  CreateModelMixin,
  DestroyModelMixin,
  getActions,
  ListModelMixin,
  // ViewSet classes
  ModelViewSet,
  NotFoundError,
  ReadOnlyModelViewSet,
  RetrieveModelMixin,
  UpdateModelMixin,
  ViewSet,
} from "./viewsets/mod.ts";

// ViewSet types
export type {
  ActionMetadata,
  ActionOptions,
  ActionType,
  CreateMixin,
  DestroyMixin,
  HttpMethod,
  ListMixin,
  ModelWithManager,
  RetrieveMixin,
  SerializerClass,
  UpdateMixin,
  ViewSetContext,
} from "./viewsets/mod.ts";

// ============================================================================
// Routers
// ============================================================================

export { DefaultRouter, SimpleRouter } from "./routers/mod.ts";

export type { RegisterOptions } from "./routers/mod.ts";

// ============================================================================
// Filters
// ============================================================================

export {
  OrderingFilter,
  QueryParamFilterBackend,
  SearchFilter,
} from "./filters/mod.ts";

export type { FilterableViewSet, FilterBackend } from "./filters/mod.ts";

// ============================================================================
// Permissions
// ============================================================================

export {
  AllowAny,
  And,
  BasePermission,
  DenyAll,
  IsAdminUser,
  IsAuthenticated,
  IsAuthenticatedOrReadOnly,
  Not,
  Or,
} from "./permissions/mod.ts";

export type { PermissionClass } from "./permissions/mod.ts";

// ============================================================================
// Pagination
// ============================================================================

export {
  BasePagination,
  CursorPagination,
  LimitOffsetPagination,
  PageNumberPagination,
} from "./pagination/mod.ts";

export type {
  PaginatedResponse,
  PaginationClass,
  PaginationContext,
} from "./pagination/mod.ts";

// ============================================================================
// Renderers / Content Negotiation
// ============================================================================

export {
  BaseRenderer,
  BrowsableAPIRenderer,
  CSVRenderer,
  JSONRenderer,
  parseAcceptHeader,
  selectRenderer,
  XMLRenderer,
} from "./renderers/mod.ts";

export type {
  AcceptEntry,
  BrowsableAPIRendererOptions,
  ContentNegotiationOptions,
  NegotiationResult,
  RenderContext,
  RendererClass,
} from "./renderers/mod.ts";

// ============================================================================
// Throttling
// ============================================================================

export {
  AnonRateThrottle,
  BaseThrottle,
  clearThrottleCache,
  parseRate,
  ScopedRateThrottle,
  UserRateThrottle,
} from "./throttling/mod.ts";

export type { ParsedRate, ThrottleClass } from "./throttling/mod.ts";

// ============================================================================
// Versioning
// ============================================================================

export {
  AcceptHeaderVersioning,
  BaseVersioning,
  QueryParameterVersioning,
  URLPathVersioning,
  VersionNotAllowedError,
} from "./versioning/mod.ts";

export type { VersioningClass, VersioningConfig } from "./versioning/mod.ts";

// ============================================================================
// Authentication
// ============================================================================

export { BaseAuthentication, JWTAuthentication } from "./authentication/mod.ts";

export type {
  AuthenticatedUser,
  AuthenticationClass,
} from "./authentication/mod.ts";
