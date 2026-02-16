/**
 * Web mod.ts template generator
 *
 * @module @alexi/create/templates/web/mod_ts
 */

/**
 * Generate mod.ts content for the web app
 */
export function generateWebModTs(name: string): string {
  return `/**
 * ${toPascalCase(name)} Web App Module
 *
 * Backend API with REST endpoints for Todo management.
 *
 * @module ${name}-web
 */

export { default } from "@${name}-web/app.ts";
export { TodoModel } from "@${name}-web/models.ts";
export { TodoSerializer } from "@${name}-web/serializers.ts";
export { TodoViewSet } from "@${name}-web/viewsets.ts";
export { urlpatterns } from "@${name}-web/urls.ts";
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
