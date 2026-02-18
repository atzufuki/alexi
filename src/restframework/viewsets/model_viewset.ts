/**
 * ModelViewSet for Alexi REST Framework
 *
 * Provides CRUD operations for alexi/db Models.
 *
 * @module @alexi/restframework/viewsets/model_viewset
 */

import type { DatabaseBackend, Model, QuerySet } from "@alexi/db";
import { getBackend, isInitialized } from "@alexi/db";
import type {
  FilterableViewSet,
  FilterBackend,
} from "../filters/filter_backend.ts";
import type {
  BasePagination,
  PaginatedResponse,
  PaginationClass,
} from "../pagination/pagination.ts";
import type { ModelSerializer } from "../serializers/model_serializer.ts";
import {
  Serializer,
  SerializerValidationError,
} from "../serializers/serializer.ts";
import { type HttpMethod, ViewSet, type ViewSetContext } from "./viewset.ts";

// ============================================================================
// Types
// ============================================================================

/**
 * Model class with static objects manager
 */
export interface ModelWithManager<T extends Model = Model> {
  new (): T;
  objects: {
    all(): QuerySet<T>;
    using(backend: DatabaseBackend): {
      all(): QuerySet<T>;
      create(data: Record<string, unknown>): Promise<T>;
      get(conditions: Record<string, unknown>): Promise<T>;
    };
  };
}

/**
 * Serializer class constructor
 *
 * Accepts both ModelSerializer and base Serializer classes.
 * This allows ViewSets to use simpler Serializers that don't
 * need full ModelSerializer features (like SerializerMethodField-based serializers).
 */
export type SerializerClass = new (options?: {
  data?: Record<string, unknown>;
  instance?: unknown;
  partial?: boolean;
  context?: Record<string, unknown>;
  many?: boolean;
}) => Serializer | ModelSerializer;

// ============================================================================
// ModelViewSet Class
// ============================================================================

/**
 * ModelViewSet provides default CRUD operations for a Model
 *
 * @example
 * ```ts
 * import { AssetModel } from "@comachine/models";
 * import { AssetSerializer } from "./serializers.ts";
 *
 * class AssetViewSet extends ModelViewSet {
 *   model = AssetModel;
 *   serializer_class = AssetSerializer;
 *
 *   // Optional: customize queryset (async for user context filtering)
 *   override async getQueryset(context: ViewSetContext): Promise<QuerySet<AssetModel>> {
 *     const qs = await super.getQueryset(context);
 *     const unitId = new URL(context.request.url).searchParams.get("unit_id");
 *     if (unitId) {
 *       return qs.filter({ unitId });
 *     }
 *     return qs;
 *   }
 * }
 * ```
 */
export abstract class ModelViewSet extends ViewSet
  implements FilterableViewSet {
  /**
   * The model class for this ViewSet
   */
  abstract model: ModelWithManager;

  /**
   * The serializer class for this ViewSet
   */
  abstract serializer_class: SerializerClass;

  /**
   * Database backend (optional, uses model's default if not set)
   */
  backend?: DatabaseBackend;

  /**
   * The field used as the lookup in URL (default: "id")
   */
  lookupField = "id";

  /**
   * The URL parameter name for the lookup (default: "id")
   */
  lookupUrlKwarg = "id";

  // ==========================================================================
  // Filtering Configuration (similar to DRF)
  // ==========================================================================

  /**
   * Filter backends to apply to the queryset
   *
   * @example
   * ```ts
   * import { QueryParamFilterBackend, OrderingFilter } from "@alexi/restframework";
   *
   * class TodoViewSet extends ModelViewSet {
   *   filterBackends = [new QueryParamFilterBackend(), new OrderingFilter()];
   *   filtersetFields = ['id', 'completed'];
   *   orderingFields = ['createdAt', 'title'];
   * }
   * ```
   */
  filterBackends?: FilterBackend[];

  /**
   * Fields that can be filtered via query parameters
   *
   * Used by QueryParamFilterBackend to determine which fields
   * are allowed in query parameter filters.
   *
   * @example
   * ```ts
   * filtersetFields = ['id', 'completed', 'title'];
   * // Allows: ?id=1, ?completed=true, ?title__contains=test
   * ```
   */
  filtersetFields?: string[];

  /**
   * Fields that can be used for text search
   *
   * Used by SearchFilter to determine which fields to search.
   */
  searchFields?: string[];

  /**
   * Fields that can be used for ordering
   *
   * Used by OrderingFilter to determine which fields are allowed
   * in the ordering query parameter.
   */
  orderingFields?: string[];

  /**
   * Default ordering to apply when no ordering is specified
   */
  ordering?: string[];

  // ==========================================================================
  // Pagination Configuration
  // ==========================================================================

  /**
   * Pagination class to use for list views
   *
   * Set to a pagination class to enable pagination, or null to disable.
   *
   * @example
   * ```ts
   * import { PageNumberPagination } from "@alexi/restframework";
   *
   * class StandardPagination extends PageNumberPagination {
   *   pageSize = 25;
   *   pageSizeQueryParam = "page_size";
   *   maxPageSize = 100;
   * }
   *
   * class ArticleViewSet extends ModelViewSet {
   *   pagination_class = StandardPagination;
   * }
   * ```
   */
  pagination_class?: PaginationClass | null;

  /**
   * Cached paginator instance for the current request
   */
  protected _paginator?: BasePagination | null;

  // ==========================================================================
  // Queryset Methods
  // ==========================================================================

  /**
   * Get the base queryset for this ViewSet
   *
   * Override this method to customize filtering.
   * This method is async to support common patterns like filtering
   * by authenticated user's organisation.
   *
   * @example
   * ```ts
   * override async getQueryset(context: ViewSetContext) {
   *   const user = await getUserFromRequest(context.request);
   *   if (!user) {
   *     return ProjectModel.objects.filter({ id: -1 }); // empty
   *   }
   *   const orgId = await getUserOrganisationId(user.id);
   *   return ProjectModel.objects.filter({ organisation_id: orgId });
   * }
   * ```
   */
  async getQueryset(_context: ViewSetContext): Promise<QuerySet<Model>> {
    if (this.backend) {
      return this.model.objects.using(this.backend).all();
    }
    return this.model.objects.all();
  }

  /**
   * Apply all configured filter backends to the queryset
   *
   * This method is called by list() to filter the queryset based on
   * the request query parameters and configured filter backends.
   *
   * @param queryset - The base queryset to filter
   * @param context - The ViewSet context containing the request
   * @returns The filtered queryset
   */
  filterQueryset<T extends Model>(
    queryset: QuerySet<T>,
    context: ViewSetContext,
  ): QuerySet<T> {
    if (!this.filterBackends || this.filterBackends.length === 0) {
      return queryset;
    }

    let filteredQs = queryset;
    for (const backend of this.filterBackends) {
      filteredQs = backend.filterQueryset(filteredQs, context, this);
    }

    return filteredQs;
  }

  /**
   * Get a single object by lookup field
   */
  async getObject(context: ViewSetContext): Promise<Model> {
    const lookupValue = context.params[this.lookupUrlKwarg];

    if (!lookupValue) {
      throw new Error(`Missing lookup parameter: ${this.lookupUrlKwarg}`);
    }

    const queryset = await this.getQueryset(context);
    const conditions: Record<string, unknown> = {
      [this.lookupField]: this.parseLookupValue(lookupValue),
    };

    try {
      const instance = await queryset.get(conditions);
      return instance;
    } catch (error) {
      // Check for DoesNotExist
      if (error instanceof Error && error.name === "DoesNotExist") {
        throw new NotFoundError(`${this.model.name} not found`);
      }
      throw error;
    }
  }

  /**
   * Parse the lookup value (e.g., convert string to number for ID)
   */
  protected parseLookupValue(value: string): unknown {
    // Try to parse as integer for ID fields
    if (this.lookupField === "id") {
      const parsed = parseInt(value, 10);
      if (!isNaN(parsed)) {
        return parsed;
      }
    }
    return value;
  }

  // ==========================================================================
  // Serializer Methods
  // ==========================================================================

  /**
   * Get the serializer class for the current action
   *
   * Override this to use different serializers for different actions.
   */
  getSerializerClass(): SerializerClass {
    return this.serializer_class;
  }

  /**
   * Create a serializer instance
   */
  getSerializer(options: {
    data?: Record<string, unknown>;
    instance?: unknown;
    partial?: boolean;
    many?: boolean;
  }): Serializer | ModelSerializer {
    const SerializerClass = this.getSerializerClass();
    return new SerializerClass({
      ...options,
      context: {
        request: this.request,
        viewset: this,
        action: this.action,
      },
    });
  }

  // ==========================================================================
  // Pagination Methods
  // ==========================================================================

  /**
   * Get the paginator instance for the current request
   *
   * Returns null if pagination is disabled.
   */
  getPaginator(): BasePagination | null {
    if (this._paginator !== undefined) {
      return this._paginator;
    }

    if (!this.pagination_class) {
      this._paginator = null;
      return null;
    }

    this._paginator = new this.pagination_class();
    return this._paginator;
  }

  /**
   * Paginate a queryset
   *
   * @param queryset - The queryset to paginate
   * @param context - The ViewSet context
   * @returns Paginated queryset, or original queryset if pagination is disabled
   */
  async paginateQueryset<T extends Model>(
    queryset: QuerySet<T>,
    context: ViewSetContext,
  ): Promise<QuerySet<T>> {
    const paginator = this.getPaginator();
    if (!paginator) {
      return queryset;
    }

    return paginator.paginateQueryset(queryset, {
      request: context.request,
      view: this,
    });
  }

  /**
   * Get the paginated response
   *
   * @param data - The serialized data array
   * @param context - The ViewSet context
   * @returns Paginated response object, or null if pagination is disabled
   */
  async getPaginatedResponse<T>(
    data: T[],
    context: ViewSetContext,
  ): Promise<PaginatedResponse<T> | null> {
    const paginator = this.getPaginator();
    if (!paginator) {
      return null;
    }

    return paginator.getResponseData(data, {
      request: context.request,
      view: this,
    });
  }

  // ==========================================================================
  // CRUD Actions
  // ==========================================================================

  /**
   * List all objects (GET /)
   *
   * Applies configured filter backends and pagination before fetching results.
   * Use `filter_backends` and `filterset_fields` to enable query parameter filtering.
   * Use `pagination_class` to enable pagination.
   *
   * @example
   * ```ts
   * import { PageNumberPagination, QueryParamFilterBackend } from "@alexi/restframework";
   *
   * class StandardPagination extends PageNumberPagination {
   *   pageSize = 25;
   * }
   *
   * class TodoViewSet extends ModelViewSet {
   *   model = TodoModel;
   *   serializer_class = TodoSerializer;
   *   filterBackends = [new QueryParamFilterBackend()];
   *   filtersetFields = ['id', 'completed'];
   *   pagination_class = StandardPagination;
   * }
   *
   * // GET /api/todos/?id=18 -> returns only todo with id=18
   * // GET /api/todos/?completed=true -> returns completed todos
   * // GET /api/todos/?page=2 -> returns page 2 with pagination
   * ```
   */
  override async list(context: ViewSetContext): Promise<Response> {
    // Reset paginator for each request
    this._paginator = undefined;

    const baseQueryset = await this.getQueryset(context);
    const filteredQueryset = this.filterQueryset(baseQueryset, context);

    // Apply pagination if configured
    const paginatedQueryset = await this.paginateQueryset(
      filteredQueryset,
      context,
    );

    const qs = await paginatedQueryset.fetch();
    const instances = qs.array();

    const serializer = this.getSerializer({
      instance: instances,
      many: true,
    });

    // Use toRepresentation for async SerializerMethodField support
    const data = await Promise.all(
      instances.map((inst) => serializer.toRepresentation(inst)),
    );

    // Return paginated response if pagination is enabled
    const paginatedResponse = await this.getPaginatedResponse(data, context);
    if (paginatedResponse) {
      return Response.json(paginatedResponse);
    }

    return Response.json(data);
  }

  /**
   * Create a new object (POST /)
   */
  override async create(context: ViewSetContext): Promise<Response> {
    let data: Record<string, unknown>;

    try {
      data = await context.request.json();
    } catch {
      return Response.json(
        { error: "Invalid JSON in request body" },
        { status: 400 },
      );
    }

    const serializer = this.getSerializer({ data });

    if (!serializer.isValid()) {
      return Response.json(
        { errors: serializer.errors },
        { status: 400 },
      );
    }

    try {
      const instance = await this.performCreate(serializer);

      // Serialize the created instance for response (use toRepresentation for async support)
      const responseSerializer = this.getSerializer({ instance });
      const data = await responseSerializer.toRepresentation(instance);
      return Response.json(data, { status: 201 });
    } catch (error) {
      if (error instanceof SerializerValidationError) {
        return Response.json({ errors: error.errors }, { status: 400 });
      }
      throw error;
    }
  }

  /**
   * Perform the create operation
   *
   * Override this to customize creation logic.
   */
  protected async performCreate(
    serializer: Serializer | ModelSerializer,
  ): Promise<Model> {
    // Use explicit backend or fall back to global backend
    const backend = this.backend ?? (isInitialized() ? getBackend() : null);
    if (backend) {
      // Use backend for creation
      const manager = this.model.objects.using(backend);
      return await manager.create(serializer.validatedData);
    }
    return await serializer.save() as Model;
  }

  /**
   * Retrieve a single object (GET /:id/)
   */
  override async retrieve(context: ViewSetContext): Promise<Response> {
    try {
      const instance = await this.getObject(context);
      const serializer = this.getSerializer({ instance });
      // Use toRepresentation for async SerializerMethodField support
      const data = await serializer.toRepresentation(instance);
      return Response.json(data);
    } catch (error) {
      if (error instanceof NotFoundError) {
        return Response.json({ error: error.message }, { status: 404 });
      }
      throw error;
    }
  }

  /**
   * Update an object completely (PUT /:id/)
   */
  override async update(context: ViewSetContext): Promise<Response> {
    return this.performUpdateAction(context, false);
  }

  /**
   * Partially update an object (PATCH /:id/)
   */
  override async partial_update(context: ViewSetContext): Promise<Response> {
    return this.performUpdateAction(context, true);
  }

  /**
   * Common update logic for PUT and PATCH
   */
  private async performUpdateAction(
    context: ViewSetContext,
    partial: boolean,
  ): Promise<Response> {
    let instance: Model;
    try {
      instance = await this.getObject(context);
    } catch (error) {
      if (error instanceof NotFoundError) {
        return Response.json({ error: error.message }, { status: 404 });
      }
      throw error;
    }

    let data: Record<string, unknown>;
    try {
      data = await context.request.json();
    } catch {
      return Response.json(
        { error: "Invalid JSON in request body" },
        { status: 400 },
      );
    }

    const serializer = this.getSerializer({
      instance,
      data,
      partial,
    });

    if (!serializer.isValid()) {
      return Response.json(
        { errors: serializer.errors },
        { status: 400 },
      );
    }

    try {
      const updatedInstance = await this.performUpdate(serializer, instance);

      // Serialize the updated instance for response (use toRepresentation for async support)
      const responseSerializer = this.getSerializer({
        instance: updatedInstance,
      });
      const data = await responseSerializer.toRepresentation(updatedInstance);
      return Response.json(data);
    } catch (error) {
      if (error instanceof SerializerValidationError) {
        return Response.json({ errors: error.errors }, { status: 400 });
      }
      throw error;
    }
  }

  /**
   * Perform the update operation
   *
   * Override this to customize update logic.
   */
  protected async performUpdate(
    serializer: Serializer | ModelSerializer,
    instance: Model,
  ): Promise<Model> {
    // Update the instance fields
    const updatedInstance = await serializer.update(
      instance,
      serializer.validatedData,
    ) as Model;

    // Save to database if backend is available
    const backend = this.backend ?? (isInitialized() ? getBackend() : null);
    if (backend) {
      await backend.update(updatedInstance);
    }

    return updatedInstance;
  }

  /**
   * Delete an object (DELETE /:id/)
   */
  override async destroy(context: ViewSetContext): Promise<Response> {
    let instance: Model;
    try {
      instance = await this.getObject(context);
    } catch (error) {
      if (error instanceof NotFoundError) {
        return Response.json({ error: error.message }, { status: 404 });
      }
      throw error;
    }

    await this.performDestroy(instance);

    return new Response(null, { status: 204 });
  }

  /**
   * Perform the delete operation
   *
   * Override this to customize deletion logic.
   */
  protected async performDestroy(instance: Model): Promise<void> {
    // Use explicit backend or fall back to global backend
    const backend = this.backend ?? (isInitialized() ? getBackend() : null);
    if (backend) {
      await backend.delete(instance);
    } else {
      throw new Error("Cannot delete without a database backend");
    }
  }
}

// ============================================================================
// Errors
// ============================================================================

/**
 * Error thrown when an object is not found
 */
export class NotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

// ============================================================================
// Mixins
// ============================================================================

/**
 * Mixin type for list functionality
 */
export interface ListMixin {
  list(this: ModelViewSet, context: ViewSetContext): Promise<Response>;
}

/**
 * Mixin that provides list functionality
 */
export const ListModelMixin: ListMixin = {
  async list(this: ModelViewSet, context: ViewSetContext): Promise<Response> {
    return ModelViewSet.prototype.list.call(this, context);
  },
};

/**
 * Mixin type for create functionality
 */
export interface CreateMixin {
  create(this: ModelViewSet, context: ViewSetContext): Promise<Response>;
}

/**
 * Mixin that provides create functionality
 */
export const CreateModelMixin: CreateMixin = {
  async create(this: ModelViewSet, context: ViewSetContext): Promise<Response> {
    return ModelViewSet.prototype.create.call(this, context);
  },
};

/**
 * Mixin type for retrieve functionality
 */
export interface RetrieveMixin {
  retrieve(this: ModelViewSet, context: ViewSetContext): Promise<Response>;
}

/**
 * Mixin that provides retrieve functionality
 */
export const RetrieveModelMixin: RetrieveMixin = {
  async retrieve(
    this: ModelViewSet,
    context: ViewSetContext,
  ): Promise<Response> {
    return ModelViewSet.prototype.retrieve.call(this, context);
  },
};

/**
 * Mixin type for update functionality
 */
export interface UpdateMixin {
  update(this: ModelViewSet, context: ViewSetContext): Promise<Response>;
  partial_update(
    this: ModelViewSet,
    context: ViewSetContext,
  ): Promise<Response>;
}

/**
 * Mixin that provides update functionality
 */
export const UpdateModelMixin: UpdateMixin = {
  async update(this: ModelViewSet, context: ViewSetContext): Promise<Response> {
    return ModelViewSet.prototype.update.call(this, context);
  },
  async partial_update(
    this: ModelViewSet,
    context: ViewSetContext,
  ): Promise<Response> {
    return ModelViewSet.prototype.partial_update.call(this, context);
  },
};

/**
 * Mixin type for destroy functionality
 */
export interface DestroyMixin {
  destroy(this: ModelViewSet, context: ViewSetContext): Promise<Response>;
}

/**
 * Mixin that provides destroy functionality
 */
export const DestroyModelMixin: DestroyMixin = {
  async destroy(
    this: ModelViewSet,
    context: ViewSetContext,
  ): Promise<Response> {
    return ModelViewSet.prototype.destroy.call(this, context);
  },
};

/**
 * Read-only ViewSet (list + retrieve)
 */
export abstract class ReadOnlyModelViewSet extends ModelViewSet {
  // Only list and retrieve are enabled
  override async list(context: ViewSetContext): Promise<Response> {
    return super.list(context);
  }

  override async retrieve(context: ViewSetContext): Promise<Response> {
    return super.retrieve(context);
  }
}
