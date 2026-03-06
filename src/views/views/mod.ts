/**
 * Alexi Views - Class-Based Views
 *
 * Re-exports all class-based view classes and types.
 *
 * @module @alexi/views/views
 */

// Base infrastructure
export { ContextMixin, TemplateResponseMixin, View } from "./base.ts";
export type { ViewFunction } from "./base.ts";

// Concrete views
export { TemplateView } from "./template_view.ts";
export { RedirectView } from "./redirect_view.ts";
export { DetailView, SingleObjectMixin } from "./detail_view.ts";
export { ListView, MultipleObjectMixin } from "./list_view.ts";
export type { Page } from "./list_view.ts";
