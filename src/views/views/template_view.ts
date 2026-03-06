/**
 * Alexi Views - Class-Based Views: TemplateView
 *
 * Mirrors Django's `django.views.generic.base.TemplateView`.
 *
 * @module @alexi/views/views/template_view
 */

import type { TemplateContext } from "../engine/mod.ts";
import { TemplateResponseMixin } from "./base.ts";

// =============================================================================
// TemplateView
// =============================================================================

/**
 * A view that renders a template.
 *
 * Mirrors Django's `django.views.generic.TemplateView`.
 *
 * @example
 * ```ts
 * import { TemplateView } from "@alexi/views";
 *
 * class HomeView extends TemplateView {
 *   templateName = "myapp/home.html";
 *
 *   override async getContextData(
 *     request: Request,
 *     params: Record<string, string>,
 *   ): Promise<Record<string, unknown>> {
 *     return {
 *       ...(await super.getContextData(request, params)),
 *       greeting: "Hello!",
 *     };
 *   }
 * }
 *
 * // In urls.ts:
 * path("", HomeView.as_view());
 *
 * // Or pass options directly to as_view():
 * path("about/", TemplateView.as_view({ templateName: "myapp/about.html" }));
 * ```
 */
export class TemplateView extends TemplateResponseMixin {
  /**
   * Handle GET requests by rendering the template with context data.
   */
  async get(
    request: Request,
    params: Record<string, string>,
  ): Promise<Response> {
    const context: TemplateContext = await this.getContextData(
      request,
      params,
    );
    return this.renderToResponse(context);
  }
}
