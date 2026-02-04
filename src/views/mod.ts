/**
 * Alexi Views - Django-style view helpers
 *
 * Provides view helper functions for common response patterns like
 * template rendering, redirects, and JSON responses.
 *
 * @module @alexi/views
 *
 * @example Template view
 * ```ts
 * import { templateView } from "@alexi/views";
 * import { path } from "@alexi/urls";
 *
 * const urlpatterns = [
 *   path("", templateView({
 *     templatePath: "./src/myapp/templates/index.html",
 *     context: {
 *       API_URL: "https://api.example.com",
 *     },
 *   }), { name: "home" }),
 * ];
 * ```
 */

// ============================================================================
// Template Views
// ============================================================================

export {
  clearTemplateCache,
  invalidateTemplate,
  templateView,
} from "./template.ts";

export type { TemplateViewOptions } from "./template.ts";
