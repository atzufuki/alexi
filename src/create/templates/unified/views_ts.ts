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

import { DetailView, ListView, TemplateView, View } from "@alexi/views";
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

/** Displays the full list of posts with stats. */
export class PostListView extends ListView<typeof PostModel.prototype> {
  override model = PostModel;
  override templateName = "${name}/post_list.html";

  override async getContextData(
    request: Request,
    params: Record<string, string>,
  ): Promise<Record<string, unknown>> {
    const base = await super.getContextData(request, params);
    const posts = (base["post_list"] ?? []) as Record<string, unknown>[];
    const total = posts.length;
    const published_count = posts.filter((p) => p["published"]).length;
    const draft_count = total - published_count;
    return { ...base, posts, total, published_count, draft_count };
  }
}

/** Displays a single post. */
export class PostDetailView extends DetailView<typeof PostModel.prototype> {
  override model = PostModel;
  override templateName = "${name}/post_detail.html";
  override pkUrlKwarg = "id";

  override async getContextData(
    request: Request,
    params: Record<string, string>,
  ): Promise<Record<string, unknown>> {
    const base = await super.getContextData(request, params);
    return { ...base, post: base["object"] };
  }
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
    const cover = (formData.get("cover") as File | null) ?? null;
    const published = formData.get("published") === "true";
    await PostModel.objects.create({ title, content, cover, published });
    return Response.redirect(new URL("/posts/", request.url), 303);
  }
}

/** Publishes a draft post. */
export class PostPublishView extends View {
  async post(request: Request, params: Record<string, string>): Promise<Response> {
    const post = await PostModel.objects.get({ id: Number(params["id"]) });
    post.published.set(true);
    await post.save({ updateFields: ["published"] });
    return Response.redirect(new URL("/posts/", request.url), 303);
  }
}

/** Deletes a post. */
export class PostDeleteView extends View {
  async post(request: Request, params: Record<string, string>): Promise<Response> {
    const post = await PostModel.objects.get({ id: Number(params["id"]) });
    await post.delete();
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

/** Serves uploaded media files from the ./uploads directory. */
export async function uploadsView(
  _request: Request,
  params: Record<string, string>,
): Promise<Response> {
  const filePath = \`./uploads/\${params["path"]}\`;
  try {
    const file = await Deno.readFile(filePath);
    const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
    const contentTypes: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      svg: "image/svg+xml",
    };
    const contentType = contentTypes[ext] ?? "application/octet-stream";
    return new Response(file, { headers: { "content-type": contentType } });
  } catch {
    return new Response("Not found", { status: 404 });
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
