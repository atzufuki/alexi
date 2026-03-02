/**
 * Worker endpoints.ts template generator
 *
 * @module @alexi/create/templates/unified/workers/endpoints_ts
 */

/**
 * Generate workers/<name>/endpoints.ts content
 */
export function generateWorkerEndpointsTs(name: string): string {
  return `/**
 * ${toPascalCase(name)} REST Endpoints
 *
 * Declarative REST API endpoint definitions used by the REST backend
 * to map ORM operations to server API calls.
 *
 * @module ${name}/workers/${name}/endpoints
 */

import { DetailAction, ModelEndpoint } from "@alexi/db/backends/rest";
import { PostModel } from "./models.ts";

export class PostEndpoint extends ModelEndpoint {
  model = PostModel;
  path = "/posts/";

  // POST /posts/:id/publish/
  publish = new DetailAction();
}
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
