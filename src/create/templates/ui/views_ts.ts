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
 *
 * @module ${name}-ui/views
 */

import { ref } from "@html-props/core";
import type { ViewContext } from "@${name}-ui/utils.ts";
import { TodoModel } from "@${name}-ui/models.ts";

/**
 * Home view - displays the todo list
 */
export async function home(
  _ctx: ViewContext,
  _params: Record<string, string>,
): Promise<Node> {
  const { HomePage } = await import("@${name}-ui/templates/home.ts");

  const templateRef = ref<InstanceType<typeof HomePage>>();

  // Load cached data from IndexedDB (instant, works offline)
  const todos = await TodoModel.objects.using("indexeddb").all().fetch();
  const count = await todos.count();

  return new HomePage({
    ref: templateRef,
    loading: count === 0,
    todos,
    fetch: async (): Promise<void> => {
      const template = templateRef.current!;
      try {
        // Fetch fresh data from REST API via sync backend
        const fresh = await TodoModel.objects.using("sync").all().fetch();
        template.todos = fresh;
      } catch (error) {
        console.error("Error fetching todos:", error);
      } finally {
        template.loading = false;
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
