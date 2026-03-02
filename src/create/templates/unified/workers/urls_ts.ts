/**
 * Worker urls.ts template generator
 *
 * @module @alexi/create/templates/unified/workers/urls_ts
 */

/**
 * Generate workers/<name>/urls.ts content
 */
export function generateWorkerUrlsTs(name: string): string {
  return `/**
 * ${toPascalCase(name)} Worker URL Configuration
 *
 * URL patterns for the Service Worker context.
 *
 * @module ${name}/workers/${name}/urls
 */

import { path } from "@alexi/urls";
import { homeView, postCreateView, postListView } from "./views.ts";

export const urlpatterns = [
  path("", homeView, { name: "home" }),
  path("posts/", postListView, { name: "post-list" }),
  path("posts/new/", postCreateView, { name: "post-create" }),
];
`;
}

/**
 * Convert kebab-case to PascalCase
 */
function toPascalCase(str: string): string {
  return str
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
}
