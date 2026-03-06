/**
 * Alexi Views - Class-Based Views: ListView
 *
 * Mirrors Django's `django.views.generic.list` module.
 *
 * - `MultipleObjectMixin` — fetches a queryset of model instances
 * - `ListView` — renders a list of objects in a template with optional pagination
 *
 * @module @alexi/views/views/list_view
 */

import type { Model, QuerySet } from "@alexi/db";
import { TemplateResponseMixin } from "./base.ts";

// Helper type for a Model class with a static `objects` Manager
type ModelClass<TModel extends Model> = (new () => TModel) & {
  objects: {
    all(): QuerySet<TModel>;
    filter(conditions: Record<string, unknown>): QuerySet<TModel>;
  };
};

// =============================================================================
// Paginator (lightweight)
// =============================================================================

/**
 * A simple paginator for use with ListView.
 */
export interface Page<TModel extends Model> {
  /** Objects on this page. */
  objectList: TModel[];
  /** Page number (1-indexed). */
  number: number;
  /** Total number of pages. */
  numPages: number;
  /** Total number of objects. */
  count: number;
  /** Whether there is a next page. */
  hasNext: boolean;
  /** Whether there is a previous page. */
  hasPrevious: boolean;
  /** Next page number, or null. */
  nextPageNumber: number | null;
  /** Previous page number, or null. */
  previousPageNumber: number | null;
}

function paginate<TModel extends Model>(
  objects: TModel[],
  pageNumber: number,
  pageSize: number,
): Page<TModel> {
  const count = objects.length;
  const numPages = Math.max(1, Math.ceil(count / pageSize));
  const safePage = Math.min(Math.max(1, pageNumber), numPages);
  const start = (safePage - 1) * pageSize;
  const end = start + pageSize;

  return {
    objectList: objects.slice(start, end),
    number: safePage,
    numPages,
    count,
    hasNext: safePage < numPages,
    hasPrevious: safePage > 1,
    nextPageNumber: safePage < numPages ? safePage + 1 : null,
    previousPageNumber: safePage > 1 ? safePage - 1 : null,
  };
}

// =============================================================================
// MultipleObjectMixin
// =============================================================================

/**
 * Mixin that provides `getQueryset()` and optional pagination for views that
 * operate on a list of model instances.
 *
 * Mirrors Django's `django.views.generic.list.MultipleObjectMixin`.
 */
export class MultipleObjectMixin<
  TModel extends Model,
> extends TemplateResponseMixin {
  /**
   * The model class to use. Required unless `getQueryset()` is overridden.
   */
  model: ModelClass<TModel> | null = null;

  /**
   * Number of objects per page.
   * Set to `null` to disable pagination.
   * @default null
   */
  paginateBy: number | null = null;

  /**
   * The name of the URL query parameter for the page number.
   * @default "page"
   */
  pageKwarg = "page";

  /**
   * The name of the context variable that holds the object list.
   * @default "object_list"
   */
  contextObjectName = "object_list";

  /**
   * Return the QuerySet for this view.
   * Override to customise (e.g., filter by user, add ordering, etc.).
   */
  getQueryset(): QuerySet<TModel> {
    if (!this.model) {
      throw new Error(
        `${this.constructor.name} requires either a definition of 'model' ` +
          `or an implementation of 'getQueryset()'`,
      );
    }
    return this.model.objects.all();
  }

  /**
   * Return the page number from the request's query string.
   */
  protected getPageNumber(request: Request): number {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get(this.pageKwarg) ?? "1", 10);
    return isNaN(page) ? 1 : page;
  }

  /**
   * Build context data including the object list and pagination info.
   *
   * Context variables:
   * - `object_list` (or `contextObjectName`) — array of model instances
   * - `page_obj` — `Page` object (if `paginateBy` is set)
   * - `is_paginated` — boolean
   */
  override async getContextData(
    request: Request,
    params: Record<string, string>,
    extra: Record<string, unknown> = {},
  ): Promise<Record<string, unknown>> {
    const qs = this.getQueryset();
    const allObjects = (await qs.fetch()).array();

    const base = await super.getContextData(request, params, extra);

    let objectList: TModel[];
    let isPaginated = false;
    let pageObj: Page<TModel> | null = null;

    if (this.paginateBy !== null) {
      const pageNumber = this.getPageNumber(request);
      pageObj = paginate(allObjects, pageNumber, this.paginateBy);
      objectList = pageObj.objectList;
      isPaginated = pageObj.numPages > 1;
    } else {
      objectList = allObjects;
    }

    // Convert model instances to plain objects so template variables like
    // {{ item.title }} work correctly (Field objects don't stringify as values).
    type WithToJSON = { toJSON(): Record<string, unknown> };
    const objectListData = objectList.map((obj) =>
      (obj as unknown as WithToJSON).toJSON()
    );

    // Also patch page_obj.objectList for consistency when pagination is active
    if (pageObj) {
      (pageObj as unknown as { objectList: unknown[] }).objectList =
        objectListData;
    }

    const context: Record<string, unknown> = {
      ...base,
      [this.contextObjectName]: objectListData,
      is_paginated: isPaginated,
      page_obj: pageObj,
    };

    // Add a convenience key using the model name in lower-case + "_list"
    if (this.model) {
      const modelName = this.model.name.replace(/Model$/, "").toLowerCase();
      context[`${modelName}_list`] = objectListData;
    }

    return context;
  }
}

// =============================================================================
// ListView
// =============================================================================

/**
 * A view that renders a list of model instances in a template.
 *
 * Mirrors Django's `django.views.generic.ListView`.
 *
 * @example
 * ```ts
 * import { ListView } from "@alexi/views";
 * import { ArticleModel } from "./models.ts";
 *
 * class ArticleListView extends ListView<typeof ArticleModel.prototype> {
 *   model = ArticleModel;
 *   templateName = "blog/article_list.html";
 *   paginateBy = 20;
 *
 *   override getQueryset() {
 *     return ArticleModel.objects
 *       .filter({ published: true })
 *       .orderBy("-createdAt");
 *   }
 * }
 *
 * // In urls.ts:
 * path("articles/", ArticleListView.as_view());
 * ```
 *
 * Template context:
 * - `object_list` — array of model instances
 * - `article_list` — same, using model name (convenience)
 * - `is_paginated` — boolean
 * - `page_obj` — Page object (if paginateBy is set)
 */
export class ListView<TModel extends Model>
  extends MultipleObjectMixin<TModel> {
  /**
   * Handle GET requests by fetching the queryset and rendering the template.
   */
  async get(
    request: Request,
    params: Record<string, string>,
  ): Promise<Response> {
    const context = await this.getContextData(request, params);
    return this.renderToResponse(context);
  }
}
