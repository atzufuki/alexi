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
 * Home view - displays the todo list for a session/board
 *
 * Implements the MVT pattern:
 * - Fetches data from REST API filtered by board/session
 * - Caches to IndexedDB for offline support
 * - Provides CRUD callbacks to the template
 * - Handles all backend interactions via ORM
 */
export async function home(
  _ctx: ViewContext,
  params: Record<string, string>,
): Promise<Node> {
  const { HomePage } = await import("@${name}-ui/templates/home.ts");

  // Get session ID from URL params
  const sessionId = params.sessionId;
  if (!sessionId) {
    throw new Error("Session ID is required");
  }

  const templateRef = ref<InstanceType<typeof HomePage>>();

  // Load cached data from IndexedDB filtered by board (instant, works offline)
  const cachedTodos = await TodoModel.objects
    .using("indexeddb")
    .filter({ board: sessionId })
    .fetch();

  return new HomePage({
    ref: templateRef,
    sessionId,
    loading: cachedTodos.length() === 0,
    todos: cachedTodos.array(),

    // Fetch: load fresh data from REST API and sync to cache
    async fetch() {
      const template = templateRef.current;
      if (!template) return;

      try {
        const freshQs = await TodoModel.objects
          .using("rest")
          .filter({ board: sessionId })
          .fetch();

        await freshQs.using("indexeddb").save();
        template.todos = freshQs.array();
      } catch (error) {
        console.error("Error fetching todos:", error);
      } finally {
        template.loading = false;
      }
    },

    // Create: add new todo via REST and sync to cache
    async createTodo(title: string) {
      const template = templateRef.current;
      if (!template) return;

      try {
        const newTodo = await TodoModel.objects.using("rest").create({
          title,
          completed: false,
          board: sessionId,
        });

        // Sync to IndexedDB
        const qs = await TodoModel.objects
          .using("rest")
          .filter({ id: newTodo.id.get() })
          .fetch();
        await qs.using("indexeddb").save();

        // Refresh from cache
        const todos = await TodoModel.objects
          .using("indexeddb")
          .filter({ board: sessionId })
          .fetch();
        template.todos = todos.array();
      } catch (error) {
        console.error("Error creating todo:", error);
      }
    },

    // Toggle: update completion status
    async toggleTodo(todo: TodoModel) {
      const template = templateRef.current;
      if (!template) return;

      try {
        const freshQs = await TodoModel.objects
          .using("rest")
          .filter({ id: todo.id.get() })
          .fetch();

        const freshTodo = await freshQs.first();
        if (!freshTodo) return;

        freshTodo.toggle();
        await freshQs.using("rest").save();
        await freshQs.using("indexeddb").save();

        // Refresh from cache
        const todos = await TodoModel.objects
          .using("indexeddb")
          .filter({ board: sessionId })
          .fetch();
        template.todos = todos.array();
      } catch (error) {
        console.error("Error toggling todo:", error);
      }
    },

    // Delete: remove todo from REST and cache
    async deleteTodo(todo: TodoModel) {
      const template = templateRef.current;
      if (!template) return;

      try {
        const restBackend = getBackendByName("rest");
        const indexeddbBackend = getBackendByName("indexeddb");
        if (!restBackend || !indexeddbBackend) return;

        // Delete from REST
        const freshTodo = await TodoModel.objects
          .using("rest")
          .filter({ id: todo.id.get() })
          .first();
        if (freshTodo) {
          await restBackend.delete(freshTodo);
        }

        // Delete from IndexedDB
        const cachedTodo = await TodoModel.objects
          .using("indexeddb")
          .filter({ id: todo.id.get() })
          .first();
        if (cachedTodo) {
          await indexeddbBackend.delete(cachedTodo);
        }

        // Refresh from cache
        const todos = await TodoModel.objects
          .using("indexeddb")
          .filter({ board: sessionId })
          .fetch();
        template.todos = todos.array();
      } catch (error) {
        console.error("Error deleting todo:", error);
      }
    },
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
