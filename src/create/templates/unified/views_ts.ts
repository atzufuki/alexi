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

import { templateView } from "@alexi/views";
import { PostModel } from "@${name}/models.ts";

export const homeView = templateView({
  templateName: "${name}/index.html",
  context: async (_request, _params) => ({ title: "${toPascalCase(name)}" }),
});

export const postListView = templateView({
  templateName: "${name}/post_list.html",
  context: async (_request, _params) => {
    const posts = await PostModel.objects.all().fetch();
    return {
      posts: posts.array().map((p) => ({
        id: p.id.get(),
        title: p.title.get(),
        published: p.published.get(),
      })),
    };
  },
});

export async function postCreateView(request: Request): Promise<Response> {
  if (request.method === "POST") {
    const formData = await request.formData();
    const title = (formData.get("title") as string | null) ?? "";
    const content = (formData.get("content") as string | null) ?? "";
    await PostModel.objects.create({ title, content, published: false });
    return Response.redirect(new URL("/posts/", request.url), 303);
  }
  return templateView({
    templateName: "${name}/post_form.html",
    context: async () => ({}),
  })(request, {});
}

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
