/**
 * Worker views.ts template generator
 *
 * @module @alexi/create/templates/unified/workers/views_ts
 */

/**
 * Generate workers/<name>/views.ts content
 */
export function generateWorkerViewsTs(name: string): string {
  return `/**
 * ${toPascalCase(name)} Worker Views
 *
 * Views rendered inside the Service Worker.
 *
 * @module ${name}/workers/${name}/views
 */

import { templateView } from "@alexi/views";
import { PostModel } from "./models.ts";

export const homeView = templateView({
  templateName: "${name}/index.html",
  context: async (_request, _params) => ({
    title: "${toPascalCase(name)}",
  }),
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
    return Response.redirect("/posts/", 303);
  }

  // GET — render the form
  const view = templateView({
    templateName: "${name}/post_form.html",
    context: async (_req, _params) => ({}),
  });
  return view(request, {});
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
