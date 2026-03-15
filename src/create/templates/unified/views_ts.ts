/**
 * Unified views.ts template generator
 *
 * @module @alexi/create/templates/unified/views_ts
 */

/**
 * Generate views.ts content for the unified app (server-side views)
 */
export function generateViewsTs(name: string): string {
  return `/**
 * ${toPascalCase(name)} Views
 *
 * Server-side views for the app. Templates are shared between the server
 * and the Service Worker — both render from src/${name}/templates/.
 *
 * @module ${name}/views
 */

import { ListView, TemplateView, View } from "@alexi/views";
import { PostModel } from "@${name}/models.ts";

/** Home page view. */
export class HomeView extends TemplateView {
  override templateName = "${name}/index.html";

  override async getContextData(
    request: Request,
    params: Record<string, string>,
  ): Promise<Record<string, unknown>> {
    const base = await super.getContextData(request, params);
    return { ...base, title: "${toPascalCase(name)}" };
  }
}

/** Displays the full list of posts. */
export class PostListView extends ListView<typeof PostModel.prototype> {
  override model = PostModel;
  override templateName = "${name}/post_list.html";
}

/** Handles creating a new post via a GET form and a POST submission. */
export class PostCreateView extends View {
  async get(request: Request, params: Record<string, string>): Promise<Response> {
    const view = TemplateView.as_view({ templateName: "${name}/post_form.html" });
    return view(request, params);
  }

  async post(request: Request): Promise<Response> {
    const formData = await request.formData();
    const title = (formData.get("title") as string | null) ?? "";
    const content = (formData.get("content") as string | null) ?? "";
    await PostModel.objects.create({ title, content, published: false });
    return Response.redirect(new URL("/posts/", request.url), 303);
  }
}

/** Health check endpoint — returns JSON status. */
export function healthView(_request: Request): Response {
  return Response.json({
    status: "ok",
    timestamp: new Date().toISOString(),
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
