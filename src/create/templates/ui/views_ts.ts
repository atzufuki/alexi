/**
 * UI views.ts template generator
 *
 * @module @alexi/create/templates/ui/views_ts
 */

/**
 * Generate views.ts content for the UI app
 */
export function generateUiViewsTs(name: string): string {
  return `/**
 * ${toPascalCase(name)} UI Views
 *
 * View functions that lazy-load templates and provide data.
 * Following the MVT (Model-View-Template) pattern:
 * - Views handle all data fetching and CRUD operations
 * - Templates are purely presentational
 * - Views pass callbacks to templates for user interactions
 *
 * @module ${name}-ui/views
 */

import { ref } from "@html-props/core";
import type { ViewContext } from "@${name}-ui/utils.ts";
import { TodoModel } from "@${name}-ui/models.ts";
import { indexeddb, rest } from "@${name}-ui/settings.ts";

/**
 * Home view - displays the todo list
 *
 * Implements the MVT pattern:
 * - Fetches data from REST API and caches to IndexedDB
 * - Provides CRUD callbacks to the template
 * - Handles all backend interactions
 */
export async function home(
  _ctx: ViewContext,
  _params: Record<string, string>,
): Promise<Node> {
  const { HomePage } = await import("@${name}-ui/templates/home.ts");

  const templateRef = ref<InstanceType<typeof HomePage>>();

  // Load cached data from IndexedDB (instant, works offline)
  const cachedTodos = await TodoModel.objects.using(indexeddb).all().fetch();
  const count = await cachedTodos.count();

  /**
   * Fetch callback - loads fresh data from REST API
   */
  const fetch = async (): Promise<void> => {
    const template = templateRef.current;
    if (!template) return;

    try {
      // Fetch fresh data from REST API
      const fresh = await TodoModel.objects.using(rest).all().fetch();
      // Save to IndexedDB for offline access
      await fresh.using(indexeddb).save();
      template.todos = fresh;
    } catch (error) {
      console.error("Error fetching todos:", error);
    } finally {
      template.loading = false;
    }
  };

  /**
   * Create callback - creates a new todo via REST API
   */
  const createTodo = async (title: string): Promise<void> => {
    const template = templateRef.current;
    if (!template) return;

    try {
      // Create via REST API
      const newTodo = await TodoModel.objects.using(rest).create({
        title,
        completed: false,
      });

      // Cache to IndexedDB using instance insert
      await indexeddb.insert(newTodo);

      // Refresh the list
      await fetch();
    } catch (error) {
      console.error("Error creating todo:", error);
    }
  };

  /**
   * Toggle callback - toggles todo completion status
   *
   * Uses backend instance methods (rest.update) instead of QuerySet.update()
   * because RestBackend doesn't support updateMany.
   */
  const toggleTodo = async (todo: TodoModel): Promise<void> => {
    const template = templateRef.current;
    if (!template) return;

    try {
      // Toggle the completed status on the instance
      todo.toggle();

      // Update via REST API using instance method
      await rest.update(todo);

      // Update local cache
      await indexeddb.update(todo);

      // Refresh the list
      await fetch();
    } catch (error) {
      console.error("Error toggling todo:", error);
    }
  };

  /**
   * Delete callback - deletes a todo
   *
   * Uses backend instance methods (rest.delete) instead of QuerySet.delete()
   * because RestBackend doesn't support deleteMany.
   */
  const deleteTodo = async (todo: TodoModel): Promise<void> => {
    const template = templateRef.current;
    if (!template) return;

    try {
      const todoId = todo.id.get();

      // Delete from REST API using instance method
      await rest.delete(todo);

      // Delete from local cache
      await indexeddb.deleteById(TodoModel.meta.dbTable, todoId);

      // Refresh the list
      await fetch();
    } catch (error) {
      console.error("Error deleting todo:", error);
    }
  };

  return new HomePage({
    ref: templateRef,
    loading: count === 0,
    todos: cachedTodos,
    fetch,
    createTodo,
    toggleTodo,
    deleteTodo,
  });
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
