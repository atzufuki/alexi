/**
 * Unified viewsets.ts template generator
 *
 * @module @alexi/create/templates/unified/viewsets_ts
 */

/**
 * Generate viewsets.ts content for the unified app
 */
export function generateViewsetsTs(name: string): string {
  return `/**
 * ${toPascalCase(name)} ViewSets
 *
 * ViewSets for REST API endpoints.
 *
 * @module ${name}/viewsets
 */

import { ModelViewSet, action } from "@alexi/restframework";
import type { ViewSetContext } from "@alexi/restframework";
import { PostModel } from "@${name}/models.ts";
import { PostSerializer } from "@${name}/serializers.ts";

/**
 * Post ViewSet - provides CRUD operations for blog posts
 *
 * Endpoints:
 *   GET    /api/posts/              - List all posts
 *   POST   /api/posts/              - Create a new post
 *   GET    /api/posts/:id/          - Get a single post
 *   PUT    /api/posts/:id/          - Update a post
 *   DELETE /api/posts/:id/          - Delete a post
 *   POST   /api/posts/:id/publish/  - Publish a post
 */
export class PostViewSet extends ModelViewSet {
  model = PostModel;
  serializer_class = PostSerializer;

  /**
   * Optionally filter posts by published status
   */
  override async getQueryset(context: ViewSetContext) {
    const qs = await super.getQueryset(context);
    const url = new URL(context.request.url);
    const published = url.searchParams.get("published");
    if (published === "true") {
      return qs.filter({ published: true });
    }
    if (published === "false") {
      return qs.filter({ published: false });
    }
    return qs;
  }

  /**
   * Publish a post
   */
  @action({ detail: true, methods: ["POST"] })
  async publish(context: ViewSetContext): Promise<Response> {
    const post = await this.getObject(context);
    post.published.set(true);
    await post.save();
    return Response.json(await new PostSerializer({ instance: post }).data);
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
