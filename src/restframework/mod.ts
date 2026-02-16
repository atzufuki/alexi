/**
 * Alexi REST Framework - Django REST Framework inspired API toolkit for Deno
 *
 * A powerful and flexible toolkit for building Web APIs with Deno,
 * inspired by Django REST Framework.
 *
 * @module @alexi/restframework
 *
 * @example Basic API setup
 * ```ts
 * import { Application } from "@alexi/http";
 * import { DefaultRouter, ModelViewSet, ModelSerializer } from "@alexi/restframework";
 * import { AssetModel } from "./models.ts";
 *
 * // Define a serializer
 * class AssetSerializer extends ModelSerializer {
 *   static Meta = {
 *     model: AssetModel,
 *     fields: ["id", "name", "description", "createdAt"],
 *     readOnlyFields: ["id", "createdAt"],
 *   };
 * }
 *
 * // Define a viewset
 * class AssetViewSet extends ModelViewSet {
 *   model = AssetModel;
 *   serializer_class = AssetSerializer;
 * }
 *
 * // Create router and register viewsets
 * const router = new DefaultRouter();
 * router.register("assets", AssetViewSet);
 *
 * // Create application
 * const app = new Application({
 *   urls: router.urls,
 * });
 *
 * // Start server
 * Deno.serve({ port: 8000 }, app.handler);
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
  FloatField,
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
  FloatFieldOptions,
  IntegerFieldOptions,
  ListFieldOptions,
  ModelClass,
  ModelSerializerMeta,
  PrimaryKeyRelatedFieldOptions,
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
  HttpMethod,
  ModelWithManager,
  SerializerClass,
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
