/**
 * UI mod.ts template generator
 *
 * @module @alexi/create/templates/ui/mod_ts
 */

/**
 * Generate mod.ts content for the UI app
 */
export function generateUiModTs(name: string): string {
  return `/**
 * ${toPascalCase(name)} UI App Module
 *
 * Frontend SPA with Todo management UI.
 *
 * @module ${name}-ui
 */

export { default } from "@${name}-ui/app.ts";
export { TodoModel } from "@${name}-ui/models.ts";
export { urlpatterns } from "@${name}-ui/urls.ts";
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
