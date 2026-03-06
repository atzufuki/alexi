/**
 * Alexi Views - Class-Based Views: Base
 *
 * Provides the base `View` class and core mixins that mirror Django's
 * `django.views.generic.base` module.
 *
 * - `View` — base class with `dispatch()` routing and `as_view()` factory
 * - `ContextMixin` — adds `getContextData()` for building template context
 * - `TemplateResponseMixin` — adds `templateName`, `getTemplateName()`,
 *   and `renderToResponse()`
 *
 * @module @alexi/views/views/base
 */

import { render, templateRegistry } from "../engine/mod.ts";
import type { TemplateContext, TemplateLoader } from "../engine/mod.ts";

// =============================================================================
// Types
// =============================================================================

/**
 * Standard Alexi view function signature.
 */
export type ViewFunction = (
  request: Request,
  params: Record<string, string>,
) => Promise<Response>;

// =============================================================================
// View
// =============================================================================

/**
 * Base class for all class-based views.
 *
 * Mirrors Django's `django.views.generic.base.View`.
 *
 * @example
 * ```ts
 * import { View } from "@alexi/views";
 *
 * class MyView extends View {
 *   async get(request: Request, params: Record<string, string>): Promise<Response> {
 *     return Response.json({ hello: "world" });
 *   }
 * }
 *
 * // In urls.ts:
 * path("my/", MyView.as_view());
 * ```
 */
export class View {
  /** HTTP methods handled by this view (lower-case). */
  protected httpMethodNames: string[] = [
    "get",
    "post",
    "put",
    "patch",
    "delete",
    "head",
    "options",
    "trace",
  ];

  /**
   * The current request (set per-call by `setup()`).
   * Do not store state between requests on the class instance —
   * `as_view()` creates a fresh instance for every request.
   */
  protected request!: Request;

  /**
   * The URL parameters for the current request (set per-call by `setup()`).
   */
  protected params!: Record<string, string>;

  /**
   * Constructor-time overrides passed via `as_view({ key: value })`.
   * Each key/value pair is applied to the instance before `setup()` is called.
   */
  [key: string]: unknown;

  /**
   * Per-request initialisation.
   * Called by `as_view()` before `dispatch()`.
   */
  protected setup(
    request: Request,
    params: Record<string, string>,
  ): void {
    this.request = request;
    this.params = params;
  }

  /**
   * Route the request to the appropriate HTTP method handler.
   * Returns `405 Method Not Allowed` if the method is not implemented.
   */
  async dispatch(
    request: Request,
    params: Record<string, string>,
  ): Promise<Response> {
    const method = request.method.toLowerCase();

    if (this.httpMethodNames.includes(method)) {
      const handler = (this as Record<string, unknown>)[method];
      if (typeof handler === "function") {
        return await (handler as (
          req: Request,
          params: Record<string, string>,
        ) => Promise<Response>).call(this, request, params);
      }
    }

    return this.httpMethodNotAllowed(request);
  }

  /**
   * Called when the request method is not implemented by this view.
   */
  protected httpMethodNotAllowed(_request: Request): Response {
    const allowed = this.httpMethodNames
      .filter((m) => typeof (this as Record<string, unknown>)[m] === "function")
      .map((m) => m.toUpperCase())
      .join(", ");

    return new Response("Method Not Allowed", {
      status: 405,
      headers: { Allow: allowed },
    });
  }

  /**
   * Handle `OPTIONS` requests by returning the `Allow` header.
   */
  options(_request: Request, _params: Record<string, string>): Response {
    const allowed = this.httpMethodNames
      .filter((m) => typeof (this as Record<string, unknown>)[m] === "function")
      .map((m) => m.toUpperCase())
      .join(", ");

    return new Response(null, {
      status: 200,
      headers: { Allow: allowed },
    });
  }

  /**
   * Factory method that returns a plain view function compatible with `path()`.
   *
   * Any kwargs passed here are set as instance attributes before each request,
   * mirroring Django's `as_view(**initkwargs)` pattern.
   *
   * @example
   * ```ts
   * path("about/", MyView.as_view({ title: "About Us" }));
   * ```
   */
  static as_view(
    initkwargs: Record<string, unknown> = {},
  ): ViewFunction {
    // Capture `this` (the class) for use inside the closure.
    // deno-lint-ignore no-this-alias
    const ViewClass = this;

    return async function view(
      request: Request,
      params: Record<string, string>,
    ): Promise<Response> {
      // Create a fresh instance per request (no shared state).
      const self = new ViewClass() as View;

      // Apply initkwargs to the instance.
      for (const [key, value] of Object.entries(initkwargs)) {
        (self as Record<string, unknown>)[key] = value;
      }

      self.setup(request, params);
      return self.dispatch(request, params);
    };
  }
}

// =============================================================================
// ContextMixin
// =============================================================================

/**
 * Mixin that provides a `getContextData()` method for building template context.
 *
 * Mirrors Django's `django.views.generic.base.ContextMixin`.
 *
 * @example
 * ```ts
 * class MyView extends ContextMixin(View) {
 *   override async getContextData(
 *     request: Request,
 *     params: Record<string, string>,
 *     extra: TemplateContext = {},
 *   ): Promise<TemplateContext> {
 *     return {
 *       ...(await super.getContextData(request, params, extra)),
 *       greeting: "Hello!",
 *     };
 *   }
 * }
 * ```
 */
export class ContextMixin extends View {
  /**
   * Build and return the context dict for the template.
   * Override in subclasses to add extra context variables.
   */
  async getContextData(
    _request: Request,
    _params: Record<string, string>,
    extra: TemplateContext = {},
  ): Promise<TemplateContext> {
    return { ...extra };
  }
}

// =============================================================================
// TemplateResponseMixin
// =============================================================================

/**
 * Mixin that provides template rendering capabilities.
 *
 * Mirrors Django's `django.views.generic.base.TemplateResponseMixin`.
 */
export class TemplateResponseMixin extends ContextMixin {
  /**
   * The name of the template to render, e.g. `"myapp/index.html"`.
   * Must be set either on the class or passed via `as_view()`.
   */
  templateName: string | null = null;

  /**
   * Custom template loader.
   * Defaults to the global `templateRegistry`.
   */
  templateLoader: TemplateLoader | null = null;

  /**
   * Content-Type header value for the rendered response.
   * @default "text/html; charset=utf-8"
   */
  contentType = "text/html; charset=utf-8";

  /**
   * Cache-Control header value.
   * @default "no-cache"
   */
  cacheControl = "no-cache";

  /**
   * Return the template name to use for rendering.
   * Override to generate the name dynamically.
   *
   * @throws {Error} if `templateName` is not set
   */
  getTemplateName(): string {
    if (!this.templateName) {
      const name = this.constructor.name;
      throw new Error(
        `${name} requires either a definition of 'templateName' or an ` +
          `implementation of 'getTemplateName()'`,
      );
    }
    return this.templateName;
  }

  /**
   * Render the template with the given context and return an HTTP Response.
   */
  async renderToResponse(context: TemplateContext): Promise<Response> {
    const templateName = this.getTemplateName();
    const loader = this.templateLoader ?? templateRegistry;

    try {
      const html = await render(templateName, context, loader);
      return new Response(html, {
        status: 200,
        headers: {
          "Content-Type": this.contentType,
          "Cache-Control": this.cacheControl,
        },
      });
    } catch (error) {
      console.error(
        `[${this.constructor.name}] Failed to render template: ${templateName}`,
        error,
      );
      return new Response(`Template error: ${templateName}\n${error}`, {
        status: 500,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
  }
}
