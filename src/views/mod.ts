/**
 * Alexi's template engine and Django-style view layer.
 *
 * `@alexi/views` combines two related pieces of functionality: a server-side
 * HTML template engine with Django-inspired syntax, and a set of helpers and
 * class-based views for turning requests into rendered responses. Use it for
 * pages, dashboards, admin-style flows, and any route that benefits from
 * structured HTML rendering rather than raw JSON.
 *
 * The main entrypoints are `templateView()` for function-style template
 * rendering, `templateRegistry` and loader classes for template discovery, and
 * class-based views such as `TemplateView`, `ListView`, `DetailView`, and
 * `RedirectView`. Filesystem-based template loading is server-oriented, while
 * the in-memory registry works in Service Worker and other non-filesystem
 * runtimes.
 *
 * @module @alexi/views
 *
 * @example Render a template with `templateView()`
 * ```ts
 * import { templateView } from "@alexi/views";
 *
 * export const note_list_view = templateView({
 *   templateName: "notes/list.html",
 *   context: async () => ({
 *     notes: await getNotes(),
 *   }),
 * });
 * ```
 *
 * @example Use a class-based view
 * ```ts
 * import { TemplateView } from "@alexi/views";
 *
 * export const home_view = TemplateView.as_view({
 *   templateName: "site/home.html",
 * });
 * ```
 */

// ============================================================================
// Template Engine
// ============================================================================

export {
  // Loaders / Registry
  ChainTemplateLoader,
  FilesystemTemplateLoader,
  globalChainLoader,
  globalFilesystemLoader,
  MemoryTemplateLoader,
  // Registration helper
  registerTemplateDir,
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

// ============================================================================
// Class-Based Views
// ============================================================================

export {
  ContextMixin,
  DetailView,
  ListView,
  MultipleObjectMixin,
  RedirectView,
  SingleObjectMixin,
  TemplateResponseMixin,
  TemplateView,
  View,
} from "./views/mod.ts";

export type { Page, ViewFunction } from "./views/mod.ts";
