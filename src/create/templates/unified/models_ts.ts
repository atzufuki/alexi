/**
 * Unified models.ts template generator
 *
 * @module @alexi/create/templates/unified/models_ts
 */

/**
 * Generate models.ts content for the unified app
 */
export function generateModelsTs(name: string): string {
  return `/**
 * ${toPascalCase(name)} Models
 *
 * Database models for the Posts application.
 * Inspired by the Django tutorial.
 *
 * @module ${name}/models
 */

import {
  AutoField,
  BooleanField,
  CharField,
  DateTimeField,
  Manager,
  Model,
  TextField,
} from "@alexi/db";

/**
 * Post model - represents a blog post
 *
 * A simple blog post with title, content, published flag, and timestamps.
 */
export class PostModel extends Model {
  id = new AutoField({ primaryKey: true });
  title = new CharField({ maxLength: 200 });
  content = new TextField({ blank: true });
  published = new BooleanField({ default: false });
  createdAt = new DateTimeField({ autoNowAdd: true });
  updatedAt = new DateTimeField({ autoNow: true });

  static objects = new Manager(PostModel);

  static override meta = {
    dbTable: "posts",
    ordering: ["-createdAt"],
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
