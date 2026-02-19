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
import { BoardModel, TodoModel } from "@${name}-web/models.ts";
import { TodoSerializer } from "@${name}-web/serializers.ts";

/**
 * Get or create a board by ID
 *
 * If the board doesn't exist, creates it automatically.
 * This enables the "share by URL" feature.
 */
async function getOrCreateBoard(boardId: string): Promise<BoardModel> {
  let board = await BoardModel.objects.filter({ id: boardId }).first();
  if (!board) {
    board = await BoardModel.objects.create({ id: boardId });
  }
  return board;
}

/**
 * Extract board from context
 *
 * Supports both URL param (/api/todos/:board/) and query string (?board=abc12)
 * RestBackend sends ForeignKey fields as field_id (e.g., board_id), so we check both.
 */
function getBoardId(context: ViewSetContext): string | null {
  // Check URL params first (nested route)
  const board = context.params?.board;
  if (board) return board;

  // Check query string - RestBackend sends ForeignKey as board_id
  const url = new URL(context.request.url);
  return url.searchParams.get("board_id") || url.searchParams.get("board");
}

/**
 * Todo ViewSet - provides CRUD operations for todos
 *
 * Endpoints:
 *   GET    /api/todos/?board=abc12     - List todos for a board
 *   POST   /api/todos/?board=abc12     - Create a new todo
 *   GET    /api/todos/:id/             - Get a single todo
 *   PUT    /api/todos/:id/             - Update a todo
 *   DELETE /api/todos/:id/             - Delete a todo
 *   POST   /api/todos/:id/toggle/      - Toggle completed status
 */
export class TodoViewSet extends ModelViewSet {
  model = TodoModel;
  serializer_class = TodoSerializer;

  /**
   * Filter todos by board
   */
  override async getQueryset(context: ViewSetContext) {
    const qs = await super.getQueryset(context);
    const boardId = getBoardId(context);
    if (boardId) {
      return qs.filter({ board: boardId });
    }
    return qs;
  }

  /**
   * Create a todo with board automatically assigned
   */
  override async create(context: ViewSetContext): Promise<Response> {
    // Parse the request body
    const data = await context.request.json();

    // Get board from body or query string
    // RestBackend sends ForeignKey as board_id, so check both
    const boardId = data.board_id || data.board || getBoardId(context);
    if (!boardId) {
      return Response.json(
        { error: "board is required" },
        { status: 400 },
      );
    }

    // Ensure board exists (auto-create for shareable URLs)
    await getOrCreateBoard(boardId);

    // Create the todo with board reference
    const todo = await TodoModel.objects.create({
      ...data,
      board: boardId,
    });

    const serializer = new TodoSerializer({ instance: todo });
    return Response.json(await serializer.data, { status: 201 });
  }

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
