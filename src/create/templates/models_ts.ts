/**
 * models.ts template generator
 *
 * @module @alexi/create/templates/models_ts
 */

/**
 * Generate models.ts content for a new app
 */
export function generateModelsTs(name: string): string {
  // Convert name to PascalCase for class name
  const className = name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");

  return `/**
 * ${className} Models
 *
 * Define your database models here.
 *
 * @module ${name}/models
 */

import {
  AutoField,
  CharField,
  DateTimeField,
  Manager,
  Model,
} from "@alexi/db";

// =============================================================================
// Example Model
// =============================================================================

/**
 * Example model - replace with your own models
 */
export class ExampleModel extends Model {
  id = new AutoField({ primaryKey: true });
  name = new CharField({ maxLength: 200 });
  createdAt = new DateTimeField({ autoNowAdd: true });
  updatedAt = new DateTimeField({ autoNow: true });

  static objects = new Manager(ExampleModel);
  static meta = {
    dbTable: "examples",
    ordering: ["-createdAt"],
  };
}
`;
}
