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
 * These mirror the backend models for use with IndexedDB and REST backends.
 *
 * @module ${name}-ui/models
 */

import {
  AutoField,
  BooleanField,
  CharField,
  DateTimeField,
  ForeignKey,
  Manager,
  Model,
  OnDelete,
  RelatedManager,
} from "@alexi/db";

/**
 * Board model - represents a shareable todo list
 *
 * Each board has a unique 5-character ID (e.g., "abc12").
 * Sharing the board URL shares the todo list.
 */
export class BoardModel extends Model {
  id = new CharField({ maxLength: 5, primaryKey: true });
  createdAt = new DateTimeField({ autoNowAdd: true });

  // Reverse relation - populated by ForeignKey relatedName
  declare todos: RelatedManager<TodoModel>;

  static objects = new Manager(BoardModel);

  static override meta = {
    dbTable: "boards",
  };
}

/**
 * Todo model - frontend representation of a todo item
 *
 * Each todo belongs to a board via ForeignKey.
 */
export class TodoModel extends Model {
  id = new AutoField({ primaryKey: true });
  board = new ForeignKey<BoardModel>("BoardModel", {
    onDelete: OnDelete.CASCADE,
    relatedName: "todos",
  });
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
  board: string;
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
    board: model.board.id as string,
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
