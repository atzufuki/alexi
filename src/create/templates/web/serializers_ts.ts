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
 *
 * Note: board is read-only because:
 * 1. It shouldn't change after creation
 * 2. BoardModel uses CharField PK (session ID like "abc12"), but the
 *    serializer auto-generates IntegerField for ForeignKey. Making it
 *    read-only avoids validation issues on update.
 */
export class TodoSerializer extends ModelSerializer {
  static override Meta = {
    model: TodoModel,
    fields: ["id", "board", "title", "completed", "createdAt", "updatedAt"],
    readOnlyFields: ["id", "board", "createdAt", "updatedAt"],
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
