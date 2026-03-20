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
  AbstractUser,
} from "@alexi/auth";
import {
  AutoField,
  BooleanField,
  CharField,
  DateTimeField,
  ImageField,
  Manager,
  Model,
  TextField,
} from "@alexi/db";

/**
 * User model - extends AbstractUser with project-specific fields.
 *
 * Used for authentication and as AUTH_USER_MODEL in settings.
 */
export class UserModel extends AbstractUser {
  static objects = new Manager(UserModel);

  static override meta = {
    dbTable: "users",
  };
}

/**
 * Post model - represents a blog post
 *
 * A simple blog post with title, content, optional cover image,
 * published flag, and timestamps.
 */
export class PostModel extends Model {
  id = new AutoField({ primaryKey: true });
  title = new CharField({ maxLength: 200 });
  content = new TextField({ blank: true });
  cover = new ImageField({ uploadTo: "covers/", null: true, blank: true });
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
