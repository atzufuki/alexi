/**
 * Unified serializers.ts template generator
 *
 * @module @alexi/create/templates/unified/serializers_ts
 */

/**
 * Generate serializers.ts content for the unified app
 */
export function generateSerializersTs(name: string): string {
  return `/**
 * ${toPascalCase(name)} Serializers
 *
 * Serializers for REST API request/response handling.
 *
 * @module ${name}/serializers
 */

import { ModelSerializer } from "@alexi/restframework";
import { PostModel } from "@${name}/models.ts";

/**
 * Post serializer - handles serialization/deserialization of Post objects
 */
export class PostSerializer extends ModelSerializer {
  static override Meta = {
    model: PostModel,
    fields: ["id", "title", "content", "cover", "published", "createdAt", "updatedAt"],
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
