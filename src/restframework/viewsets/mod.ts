/**
 * ViewSets module for Alexi REST Framework
 *
 * ViewSets combine the logic for handling multiple related views into a single class.
 *
 * @module @alexi/restframework/viewsets
 *
 * @example Basic ViewSet
 * ```ts
 * import { ViewSet } from "@alexi/restframework/viewsets";
 *
 * class HealthViewSet extends ViewSet {
 *   async list(context: ViewSetContext): Promise<Response> {
 *     return Response.json({ status: "ok" });
 *   }
 * }
 * ```
 *
 * @example ModelViewSet
 * ```ts
 * import { ModelViewSet } from "@alexi/restframework/viewsets";
 * import { AssetModel } from "@comachine/models";
 * import { AssetSerializer } from "./serializers.ts";
 *
 * class AssetViewSet extends ModelViewSet {
 *   model = AssetModel;
 *   serializer_class = AssetSerializer;
 * }
 * ```
 */

// ============================================================================
// Base ViewSet
// ============================================================================

export { action, getActions, ViewSet } from "./viewset.ts";

export type {
  ActionMetadata,
  ActionOptions,
  ActionType,
  HttpMethod,
  ViewSetContext,
} from "./viewset.ts";

// ============================================================================
// Model ViewSet
// ============================================================================

export {
  // Mixins
  CreateModelMixin,
  DestroyModelMixin,
  ListModelMixin,
  // Main class
  ModelViewSet,
  // Errors
  NotFoundError,
  // Read-only variant
  ReadOnlyModelViewSet,
  RetrieveModelMixin,
  UpdateModelMixin,
} from "./model_viewset.ts";

export type { ModelWithManager, SerializerClass } from "./model_viewset.ts";
