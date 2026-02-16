/**
 * UI endpoints.ts template generator
 *
 * @module @alexi/create/templates/ui/endpoints_ts
 */

/**
 * Generate endpoints.ts content for the UI app
 */
export function generateUiEndpointsTs(name: string): string {
  return `/**
 * ${toPascalCase(name)} UI Endpoints
 *
 * ModelEndpoint definitions for REST API communication.
 *
 * @module ${name}-ui/endpoints
 */

import { ModelEndpoint, DetailAction } from "@alexi/db/backends/rest";
import { TodoModel } from "@${name}-ui/models.ts";

/**
 * Todo endpoint - maps TodoModel to /api/todos/
 */
class TodoEndpoint extends ModelEndpoint {
  model = TodoModel;
  path = "/todos/";

  // POST /todos/:id/toggle/
  toggle = new DetailAction();
}

/**
 * All endpoints for RestBackend
 */
export const ENDPOINTS = [
  TodoEndpoint,
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
