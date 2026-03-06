/**
 * Alexi Views - Class-Based Views: DetailView
 *
 * Mirrors Django's `django.views.generic.detail` module.
 *
 * - `SingleObjectMixin` — fetches a single model instance by PK or slug
 * - `DetailView` — renders a single object in a template
 *
 * @module @alexi/views/views/detail_view
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
// SingleObjectMixin
// =============================================================================

/**
 * Mixin that provides `getObject()` and `getQueryset()` for views that
 * operate on a single model instance.
 *
 * Mirrors Django's `django.views.generic.detail.SingleObjectMixin`.
 */
export class SingleObjectMixin<
  TModel extends Model,
> extends TemplateResponseMixin {
  /**
   * The model class to use. Required unless `getQueryset()` is overridden.
   */
  model: ModelClass<TModel> | null = null;

  /**
   * The URL parameter name used to look up the object.
   * @default "id"
   */
  pkUrlKwarg = "id";

  /**
   * The URL parameter name used to look up the object by slug.
   * Used only if `pkUrlKwarg` is not present in `params`.
   * @default null
   */
  slugUrlKwarg: string | null = null;

  /**
   * The model field name for slug lookups.
   * @default "slug"
   */
  slugField = "slug";

  /**
   * Return the base QuerySet for fetching the object.
   * Override to customise the queryset (e.g., add `select_related`).
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
   * Fetch and return the single object that this view operates on.
   *
   * Looks up the object using the URL params (by `pkUrlKwarg` or
   * `slugUrlKwarg`).
   *
   * @throws {Response} 404 response if the object is not found
   */
  async getObject(): Promise<TModel> {
    const params = this.params;
    const qs = this.getQueryset();

    const pk = params[this.pkUrlKwarg];
    if (pk !== undefined) {
      // Coerce to number if it looks like an integer (ORM PKs are typically numbers)
      const pkValue: string | number = /^\d+$/.test(pk) ? parseInt(pk, 10) : pk;
      const obj = await qs.filter({ id: pkValue }).first();
      if (!obj) {
        return Promise.reject(
          new Response(`No object found with id=${pk}`, { status: 404 }),
        );
      }
      return obj;
    }

    if (this.slugUrlKwarg) {
      const slug = params[this.slugUrlKwarg];
      if (slug !== undefined) {
        const obj = await qs
          .filter({ [this.slugField]: slug })
          .first();
        if (!obj) {
          return Promise.reject(
            new Response(
              `No object found with ${this.slugField}=${slug}`,
              { status: 404 },
            ),
          );
        }
        return obj;
      }
    }

    throw new Error(
      `${this.constructor.name}: URL params must include '${this.pkUrlKwarg}'` +
        (this.slugUrlKwarg ? ` or '${this.slugUrlKwarg}'` : ""),
    );
  }

  /**
   * Build context data including the retrieved object.
   * Adds `object` (plain data from `toJSON()`) and an optional model-named key
   * (`article`, `user`, etc.) for convenience.
   * The raw model instance is available as `object_instance`.
   */
  override async getContextData(
    request: Request,
    params: Record<string, string>,
    extra: Record<string, unknown> = {},
  ): Promise<Record<string, unknown>> {
    const obj = await this.getObject();
    const base = await super.getContextData(request, params, extra);

    // Use toJSON() so template variables like {{ object.title }} work
    const objData = (obj as unknown as { toJSON(): Record<string, unknown> })
      .toJSON();

    const context: Record<string, unknown> = {
      ...base,
      object: objData,
      object_instance: obj,
    };

    // Add a convenience key using the model name in lower-case
    if (this.model) {
      const modelName = this.model.name.replace(/Model$/, "").toLowerCase();
      context[modelName] = objData;
    }

    return context;
  }
}

// =============================================================================
// DetailView
// =============================================================================

/**
 * A view that renders a single model instance in a template.
 *
 * Mirrors Django's `django.views.generic.DetailView`.
 *
 * @example
 * ```ts
 * import { DetailView } from "@alexi/views";
 * import { ArticleModel } from "./models.ts";
 *
 * class ArticleDetailView extends DetailView<typeof ArticleModel.prototype> {
 *   model = ArticleModel;
 *   templateName = "blog/article_detail.html";
 *   // Template context: `object` (the article) and `article` (same object)
 * }
 *
 * // In urls.ts:
 * path("articles/:id/", ArticleDetailView.as_view());
 * ```
 */
export class DetailView<TModel extends Model>
  extends SingleObjectMixin<TModel> {
  /**
   * Handle GET requests by fetching the object and rendering the template.
   */
  async get(
    request: Request,
    params: Record<string, string>,
  ): Promise<Response> {
    let context: Record<string, unknown>;
    try {
      context = await this.getContextData(request, params);
    } catch (e) {
      // Re-raise 404/other Response objects directly
      if (e instanceof Response) return e;
      throw e;
    }
    return this.renderToResponse(context);
  }
}
