/**
 * Alexi Views - Django-style view helpers
 *
 * Provides view helper functions for common response patterns like
 * template rendering, redirects, and JSON responses.
 *
 * Includes a full Django-style template engine with support for:
 * - `{{ variable }}` — dot-notation variable output
 * - `{% extends "base.html" %}` — template inheritance
 * - `{% block name %}...{% endblock %}` — block definitions
 * - `{% for item in items %}...{% endfor %}` — iteration
 * - `{% if condition %}...{% elif %}...{% else %}...{% endif %}` — conditionals
 * - `{% include "partial.html" %}` — sub-template inclusion
 *
 * @module @alexi/views
 *
 * @example New API — Django-style template engine
 * ```ts
 * import { templateView, templateRegistry } from "@alexi/views";
 *
 * // Register templates (done by Application on startup)
 * templateRegistry.register("my-app/note_list.html", `
 *   {% extends "my-app/base.html" %}
 *   {% block content %}
 *   <ul>
 *     {% for note in notes %}
 *     <li>{{ note.title }}</li>
 *     {% endfor %}
 *   </ul>
 *   {% endblock %}
 * `);
 *
 * export const noteListView = templateView({
 *   templateName: "my-app/note_list.html",
 *   context: async (request, params) => ({
 *     notes: await getNotes(),
 *   }),
 * });
 * ```
 *
 * @example Legacy API — static file with placeholder substitution
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
// Template Engine
// ============================================================================

export {
  // Loaders / Registry
  ChainTemplateLoader,
  FilesystemTemplateLoader,
  MemoryTemplateLoader,
  // Renderer
  render,
  // Errors
  TemplateNotFoundError,
  TemplateParseError,
  templateRegistry,
} from "./engine/mod.ts";

export type {
  ASTNode,
  TemplateContext,
  TemplateLoader,
  Token,
  TokenType,
} from "./engine/mod.ts";

// ============================================================================
// Template Views
// ============================================================================

export {
  clearTemplateCache,
  invalidateTemplate,
  templateView,
} from "./template.ts";

export type {
  ContextFunction,
  LegacyTemplateViewOptions,
  NewTemplateViewOptions,
  TemplateViewOptions,
} from "./template.ts";
