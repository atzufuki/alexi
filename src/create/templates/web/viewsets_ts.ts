/**
 * Web viewsets.ts template generator
 *
 * @module @alexi/create/templates/web/viewsets_ts
 */

/**
 * Generate viewsets.ts content for the web app
 */
export function generateWebViewsetsTs(name: string): string {
  return `/**
 * ${toPascalCase(name)} Web ViewSets
 *
 * ViewSets for REST API endpoints.
 *
 * @module ${name}-web/viewsets
 */

import { ModelViewSet, action } from "@alexi/restframework";
import type { ViewSetContext } from "@alexi/restframework";
import { TodoModel } from "@${name}-web/models.ts";
import { TodoSerializer } from "@${name}-web/serializers.ts";

/**
 * Todo ViewSet - provides CRUD operations for todos
 *
 * Endpoints:
 *   GET    /api/todos/           - List all todos
 *   POST   /api/todos/           - Create a new todo
 *   GET    /api/todos/:id/       - Get a single todo
 *   PUT    /api/todos/:id/       - Update a todo
 *   DELETE /api/todos/:id/       - Delete a todo
 *   POST   /api/todos/:id/toggle/ - Toggle completed status
 */
export class TodoViewSet extends ModelViewSet {
  model = TodoModel;
  serializer_class = TodoSerializer;

  /**
   * Toggle the completed status of a todo
   */
  @action({ detail: true, methods: ["POST"] })
  async toggle(context: ViewSetContext): Promise<Response> {
    const todo = await this.getObject(context);
    todo.toggle();
    await todo.save();
    return Response.json(await new TodoSerializer({ instance: todo }).data);
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
