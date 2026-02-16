/**
 * UI models.ts template generator
 *
 * @module @alexi/create/templates/ui/models_ts
 */

/**
 * Generate models.ts content for the UI app
 */
export function generateUiModelsTs(name: string): string {
  return `/**
 * ${toPascalCase(name)} UI Models
 *
 * Frontend ORM models for the Todo application.
 * These mirror the backend models for use with SyncBackend.
 *
 * @module ${name}-ui/models
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
 * Todo model - frontend representation of a todo item
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

/**
 * Todo interface for UI consumption
 */
export interface Todo {
  id: number;
  title: string;
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Convert TodoModel to Todo interface
 */
export function modelToTodo(model: TodoModel): Todo {
  return {
    id: model.id.get() as number,
    title: model.title.get() as string,
    completed: model.completed.get() as boolean,
    createdAt: model.createdAt.get() as Date,
    updatedAt: model.updatedAt.get() as Date,
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
