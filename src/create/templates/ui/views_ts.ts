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
 * Uses ORM .using("backendName") pattern for all database operations.
 * Backend names are defined in DATABASES setting.
 *
 * @module ${name}-ui/views
 */

import { ref } from "@html-props/core";
import { getBackendByName } from "@alexi/db";
import type { ViewContext } from "@${name}-ui/utils.ts";
import { TodoModel } from "@${name}-ui/models.ts";

/**
 * Home view - displays the todo list
 *
 * Implements the MVT pattern:
 * - Fetches data from REST API and caches to IndexedDB
 * - Provides CRUD callbacks to the template
 * - Handles all backend interactions via ORM
 */
export async function home(
  _ctx: ViewContext,
  _params: Record<string, string>,
): Promise<Node> {
  const { HomePage } = await import("@${name}-ui/templates/home.ts");

  const templateRef = ref<InstanceType<typeof HomePage>>();

  // Load cached data from IndexedDB (instant, works offline)
  const cachedTodos = await TodoModel.objects.using("indexeddb").all().fetch();
  const count = await cachedTodos.count();

  /**
   * Fetch callback - loads fresh data from REST API and syncs to cache
   */
  const fetch = async (): Promise<void> => {
    const template = templateRef.current;
    if (!template) return;

    try {
      // Fetch fresh data from REST API
      const freshQs = await TodoModel.objects.using("rest").all().fetch();

      // Sync to IndexedDB using QuerySet.save()
      await freshQs.using("indexeddb").save();

      // Update template with fresh data
      template.todos = freshQs;
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
      // Create via REST API using ORM
      const newTodo = await TodoModel.objects.using("rest").create({
        title,
        completed: false,
      });

      // Fetch the new todo and save to cache
      const cacheQs = await TodoModel.objects.using("rest").filter({
        id: newTodo.id.get(),
      }).fetch();
      await cacheQs.using("indexeddb").save();

      // Refresh the list
      await fetch();
    } catch (error) {
      console.error("Error creating todo:", error);
    }
  };

  /**
   * Toggle callback - toggles todo completion status
   *
   * Uses ORM pattern: fetch from REST, modify, save back to REST, sync to cache
   */
  const toggleTodo = async (todo: TodoModel): Promise<void> => {
    const template = templateRef.current;
    if (!template) return;

    try {
      const todoId = todo.id.get();

      // Fetch fresh instance from REST to ensure proper backend binding
      const freshQs = await TodoModel.objects
        .using("rest")
        .filter({ id: todoId })
        .fetch();

      const freshTodo = await freshQs.first();
      if (!freshTodo) {
        console.error("Todo not found on server:", todoId);
        return;
      }

      // Toggle the completed status
      freshTodo.toggle();

      // Save back to REST API
      await freshQs.using("rest").save();

      // Sync to IndexedDB cache
      await freshQs.using("indexeddb").save();

      // Refresh the list
      await fetch();
    } catch (error) {
      console.error("Error toggling todo:", error);
    }
  };

  /**
   * Delete callback - deletes a todo
   *
   * Uses backend.delete() for single instance deletion.
   * Note: RestBackend doesn't support QuerySet.delete() (deleteMany),
   * so we use the backend directly for delete operations.
   */
  const deleteTodo = async (todo: TodoModel): Promise<void> => {
    const template = templateRef.current;
    if (!template) return;

    try {
      const todoId = todo.id.get();

      // Get backends for direct delete operations
      const restBackend = getBackendByName("rest");
      const indexeddbBackend = getBackendByName("indexeddb");

      if (!restBackend || !indexeddbBackend) {
        console.error("Backends not configured");
        return;
      }

      // Fetch fresh instance from REST to ensure proper backend binding
      const freshTodo = await TodoModel.objects
        .using("rest")
        .filter({ id: todoId })
        .first();

      if (freshTodo) {
        // Delete from REST API using backend.delete()
        await restBackend.delete(freshTodo);
      }

      // Delete from IndexedDB cache
      const cachedTodo = await TodoModel.objects
        .using("indexeddb")
        .filter({ id: todoId })
        .first();

      if (cachedTodo) {
        await indexeddbBackend.delete(cachedTodo);
      }

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
