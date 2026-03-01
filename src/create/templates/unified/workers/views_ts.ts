/**
 * Worker views.ts template generator
 *
 * @module @alexi/create/templates/unified/workers/views_ts
 */

/**
 * Generate workers/<name>/views.ts content
 */
export function generateWorkerViewsTs(name: string): string {
  return `/**
 * ${toPascalCase(name)} Worker Views
 *
 * Views rendered inside the Service Worker.
 *
 * @module ${name}/workers/${name}/views
 */

import { templateView } from "@alexi/views";

export const homeView = templateView({
  templateName: "${name}/index.html",
  context: async (_request, _params) => ({
    title: "${toPascalCase(name)}",
  }),
});
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
