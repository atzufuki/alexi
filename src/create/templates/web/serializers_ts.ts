/**
 * Web serializers.ts template generator
 *
 * @module @alexi/create/templates/web/serializers_ts
 */

/**
 * Generate serializers.ts content for the web app
 */
export function generateWebSerializersTs(name: string): string {
  return `/**
 * ${toPascalCase(name)} Web Serializers
 *
 * Serializers for REST API request/response handling.
 *
 * @module ${name}-web/serializers
 */

import { ModelSerializer } from "@alexi/restframework";
import { TodoModel } from "@${name}-web/models.ts";

/**
 * Todo serializer - handles serialization/deserialization of Todo objects
 */
export class TodoSerializer extends ModelSerializer {
  static override Meta = {
    model: TodoModel,
    fields: ["id", "title", "completed", "createdAt", "updatedAt"],
    readOnlyFields: ["id", "createdAt", "updatedAt"],
  };
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
