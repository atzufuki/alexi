/**
 * Web models.ts template generator
 *
 * @module @alexi/create/templates/web/models_ts
 */

/**
 * Generate models.ts content for the web app
 */
export function generateWebModelsTs(name: string): string {
  return `/**
 * ${toPascalCase(name)} Web Models
 *
 * Database models for the Todo application.
 *
 * @module ${name}-web/models
 */

import {
  AutoField,
  BooleanField,
  CharField,
  DateTimeField,
  Manager,
  Model,
} from "@alexi/db";

/**
 * Todo model - represents a todo item
 */
export class TodoModel extends Model {
  id = new AutoField({ primaryKey: true });
  title = new CharField({ maxLength: 200 });
  completed = new BooleanField({ default: false });
  createdAt = new DateTimeField({ autoNowAdd: true });
  updatedAt = new DateTimeField({ autoNow: true });

  static objects = new Manager(TodoModel);

  static override meta = {
    dbTable: "todos",
    ordering: ["-createdAt"],
  };

  /**
   * Toggle the completed status
   */
  toggle(): void {
    this.completed.set(!this.completed.get());
  }
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
