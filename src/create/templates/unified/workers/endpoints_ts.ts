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
 * Declarative REST API endpoint definitions used by the REST backend.
 *
 * @module ${name}/workers/${name}/endpoints
 */

// import { DetailAction, ListAction, ModelEndpoint, SingletonQuery } from "@alexi/db/backends/rest";
// import { PostModel } from "./models.ts";

// Example endpoint:
// class PostEndpoint extends ModelEndpoint {
//   model = PostModel;
//   path = "/posts/";
//   publish = new DetailAction();
// }
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
