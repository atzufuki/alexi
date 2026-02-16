# Views

Views are functions that handle requests and return responses. Alexi uses the
same view pattern for both backend APIs and frontend SPAs.

## Overview

A view function receives a context and URL parameters, then returns a response:

```typescript
// Backend view (Request → Response)
async function myView(
  request: Request,
  params: Record<string, string>,
): Promise<Response> {
  return Response.json({ message: "Hello" });
}

// Frontend view (ViewContext → Node)
async function myView(
  ctx: ViewContext,
  params: Record<string, string>,
): Promise<Node> {
  return new Div({ textContent: "Hello" });
}
```

## Backend Views

Backend views handle HTTP requests and return `Response` objects.

### Basic View

```typescript
async function healthCheck(
  request: Request,
  params: Record<string, string>,
): Promise<Response> {
  return Response.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}
```

### Reading Request Data

```typescript
// Query parameters
async function searchArticles(
  request: Request,
  params: Record<string, string>,
): Promise<Response> {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") || "";
  const page = parseInt(url.searchParams.get("page") || "1");

  const articles = await ArticleModel.objects
    .filter({ title__icontains: query })
    .offset((page - 1) * 20)
    .limit(20)
    .fetch();

  return Response.json(articles.array());
}

// Request body (JSON)
async function createArticle(
  request: Request,
  params: Record<string, string>,
): Promise<Response> {
  const data = await request.json();

  const article = await ArticleModel.objects.create({
    title: data.title,
    body: data.body,
  });

  return Response.json(article, { status: 201 });
}

// URL parameters
async function getArticle(
  request: Request,
  params: Record<string, string>,
): Promise<Response> {
  const { id } = params;

  const article = await ArticleModel.objects.get({ id: Number(id) });

  return Response.json(article);
}
```

### Response Types

```typescript
// JSON response
return Response.json({ data: "value" });

// JSON with status code
return Response.json({ error: "Not found" }, { status: 404 });

// Plain text
return new Response("Hello, World!", {
  headers: { "Content-Type": "text/plain" },
});

// HTML
return new Response("<h1>Hello</h1>", {
  headers: { "Content-Type": "text/html" },
});

// Redirect
return Response.redirect("/new-location/", 302);

// No content
return new Response(null, { status: 204 });
```

### Error Handling

```typescript
async function getArticle(
  request: Request,
  params: Record<string, string>,
): Promise<Response> {
  const { id } = params;

  try {
    const article = await ArticleModel.objects.get({ id: Number(id) });
    return Response.json(article);
  } catch (error) {
    if (error.name === "DoesNotExist") {
      return Response.json({ error: "Article not found" }, { status: 404 });
    }

    console.error("Error fetching article:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

### Using with URL Patterns

```typescript
// views.ts
export async function listArticles(
  request: Request,
  params: Record<string, string>,
): Promise<Response> {
  const articles = await ArticleModel.objects.all().fetch();
  return Response.json(articles.array());
}

export async function getArticle(
  request: Request,
  params: Record<string, string>,
): Promise<Response> {
  const article = await ArticleModel.objects.get({ id: Number(params.id) });
  return Response.json(article);
}

export async function createArticle(
  request: Request,
  params: Record<string, string>,
): Promise<Response> {
  const data = await request.json();
  const article = await ArticleModel.objects.create(data);
  return Response.json(article, { status: 201 });
}

// urls.ts
import { path } from "@alexi/urls";
import * as views from "./views.ts";

export const urlpatterns = [
  path("articles/", views.listArticles, { name: "article-list" }),
  path("articles/:id/", views.getArticle, { name: "article-detail" }),
];
```

## Frontend Views

Frontend views handle SPA navigation and return `Node` objects (HTML Props
components).

### View Context

Frontend views receive a `ViewContext` instead of `Request`:

```typescript
interface ViewContext {
  url: URL;
  params: Record<string, string>;
}
```

### Basic View

```typescript
import type { ViewContext } from "./utils.ts";

export async function home(
  ctx: ViewContext,
  params: Record<string, string>,
): Promise<Node> {
  const { HomePage } = await import("./templates/home.ts");
  return new HomePage();
}
```

### MVT Pattern (Model-View-Template)

Alexi follows Django's MVT pattern for frontend views:

- **Model** — Data layer (ORM)
- **View** — Handles data fetching and business logic
- **Template** — Purely presentational components

```typescript
// views.ts - Handles data and callbacks
export async function articleList(
  ctx: ViewContext,
  params: Record<string, string>,
): Promise<Node> {
  const { ArticleListPage } = await import("./templates/article_list.ts");

  // Fetch data from REST API
  const articles = await ArticleModel.objects
    .using("api")
    .all()
    .fetch();

  // Create refresh callback
  const refresh = async () => {
    const fresh = await ArticleModel.objects.using("api").all().fetch();
    // Update template...
  };

  // Pass data and callbacks to template
  return new ArticleListPage({
    articles,
    onRefresh: refresh,
  });
}

// templates/article_list.ts - Purely presentational
export class ArticleListPage extends HTMLPropsMixin(HTMLElement, {
  articles: prop<QuerySet<ArticleModel> | null>(null),
  onRefresh: prop<(() => Promise<void>) | null>(null),
}) {
  render(): Node {
    // Render UI based on props
  }
}
```

### Data Fetching

```typescript
export async function articleDetail(
  ctx: ViewContext,
  params: Record<string, string>,
): Promise<Node> {
  const { ArticleDetailPage } = await import("./templates/article_detail.ts");
  const { id } = params;

  // Fetch from REST API backend
  const article = await ArticleModel.objects
    .using("api")
    .get({ id: Number(id) });

  return new ArticleDetailPage({ article });
}
```

### Caching with Multiple Backends

```typescript
export async function articleList(
  ctx: ViewContext,
  params: Record<string, string>,
): Promise<Node> {
  const { ArticleListPage } = await import("./templates/article_list.ts");
  const { ref } = await import("@html-props/core");

  const templateRef = ref<InstanceType<typeof ArticleListPage>>();

  // Load cached data immediately (fast, works offline)
  const cached = await ArticleModel.objects
    .using("indexeddb")
    .all()
    .fetch();

  // Fetch fresh data callback
  const refresh = async () => {
    const template = templateRef.current;
    if (!template) return;

    try {
      // Fetch from API
      const fresh = await ArticleModel.objects
        .using("api")
        .all()
        .fetch();

      // Sync to cache
      await fresh.using("indexeddb").save();

      // Update template
      template.articles = fresh;
    } catch (error) {
      console.error("Failed to refresh:", error);
    }
  };

  return new ArticleListPage({
    ref: templateRef,
    articles: cached,
    onRefresh: refresh,
  });
}
```

### CRUD Callbacks

Views provide callbacks to templates for user interactions:

```typescript
export async function todoList(
  ctx: ViewContext,
  params: Record<string, string>,
): Promise<Node> {
  const { TodoListPage } = await import("./templates/todo_list.ts");
  const { ref } = await import("@html-props/core");

  const templateRef = ref<InstanceType<typeof TodoListPage>>();

  // Initial data
  const todos = await TodoModel.objects.using("indexeddb").all().fetch();

  // Fetch callback
  const fetch = async () => {
    const template = templateRef.current;
    if (!template) return;

    const fresh = await TodoModel.objects.using("api").all().fetch();
    await fresh.using("indexeddb").save();
    template.todos = fresh;
  };

  // Create callback
  const createTodo = async (title: string) => {
    await TodoModel.objects.using("api").create({ title, completed: false });
    await fetch();
  };

  // Toggle callback
  const toggleTodo = async (todo: TodoModel) => {
    const id = todo.id.get();
    const fresh = await TodoModel.objects.using("api").get({ id });
    fresh.completed.set(!fresh.completed.get());
    await fresh.save();
    await fetch();
  };

  // Delete callback
  const deleteTodo = async (todo: TodoModel) => {
    await TodoModel.objects.using("api").filter({ id: todo.id.get() }).delete();
    await fetch();
  };

  return new TodoListPage({
    ref: templateRef,
    todos,
    fetch,
    createTodo,
    toggleTodo,
    deleteTodo,
  });
}
```

### Lazy Loading Templates

Use dynamic imports for code splitting:

```typescript
export async function home(
  ctx: ViewContext,
  params: Record<string, string>,
): Promise<Node> {
  // Template is loaded only when this view is accessed
  const { HomePage } = await import("./templates/home.ts");
  return new HomePage();
}

export async function settings(
  ctx: ViewContext,
  params: Record<string, string>,
): Promise<Node> {
  // Settings page code is not loaded until user navigates here
  const { SettingsPage } = await import("./templates/settings.ts");
  return new SettingsPage();
}
```

### Navigation

```typescript
import { navigate } from "./utils.ts";

// In a view or template
function handleClick(articleId: number) {
  navigate(`/articles/${articleId}/`);
}

// With replace (no history entry)
function handleSubmit() {
  navigate("/success/", { replace: true });
}
```

## ViewSets (Backend)

For CRUD operations, use ViewSets instead of individual views:

```typescript
import { ModelViewSet } from "@alexi/restframework";

class ArticleViewSet extends ModelViewSet {
  model = ArticleModel;
  serializerClass = ArticleSerializer;
}
```

See [ViewSets documentation](./restframework/viewsets.md) for details.

## Best Practices

### Backend Views

1. **Keep views thin** — Views should handle HTTP concerns; business logic
   belongs in models/services

2. **Validate input** — Always validate request data before using it

3. **Handle errors** — Return appropriate HTTP status codes for errors

4. **Use ViewSets for CRUD** — Don't write custom views for standard CRUD
   operations

### Frontend Views

1. **Follow MVT pattern** — Views handle data, templates handle presentation

2. **Use refs for updates** — Pass refs to templates for updating data after
   callbacks

3. **Cache data** — Use IndexedDB for offline support and fast initial loads

4. **Lazy load templates** — Use dynamic imports for code splitting

5. **Provide callbacks** — Pass all CRUD operations as callbacks to templates

## Full Example

### Backend

```typescript
// src/my-app-web/articles/views.ts
import { ArticleModel } from "./models.ts";

export async function listArticles(
  request: Request,
  params: Record<string, string>,
): Promise<Response> {
  const url = new URL(request.url);
  const status = url.searchParams.get("status");

  let qs = ArticleModel.objects.all();

  if (status) {
    qs = qs.filter({ status });
  }

  const articles = await qs.orderBy("-createdAt").fetch();
  return Response.json(articles.array());
}

export async function getArticle(
  request: Request,
  params: Record<string, string>,
): Promise<Response> {
  try {
    const article = await ArticleModel.objects.get({ id: Number(params.id) });
    return Response.json(article);
  } catch (error) {
    if (error.name === "DoesNotExist") {
      return Response.json({ error: "Article not found" }, { status: 404 });
    }
    throw error;
  }
}

// src/my-app-web/articles/urls.ts
import { path } from "@alexi/urls";
import * as views from "./views.ts";

export const urlpatterns = [
  path("", views.listArticles, { name: "article-list" }),
  path(":id/", views.getArticle, { name: "article-detail" }),
];
```

### Frontend

```typescript
// src/my-app-ui/views.ts
import type { ViewContext } from "./utils.ts";
import { ref } from "@html-props/core";
import { ArticleModel } from "./models.ts";

export async function articleList(
  ctx: ViewContext,
  params: Record<string, string>,
): Promise<Node> {
  const { ArticleListPage } = await import("./templates/article_list.ts");

  const templateRef = ref<InstanceType<typeof ArticleListPage>>();

  // Load cached data
  const articles = await ArticleModel.objects.using("indexeddb").all().fetch();

  // Refresh callback
  const refresh = async () => {
    const template = templateRef.current;
    if (!template) return;

    template.loading = true;

    try {
      const fresh = await ArticleModel.objects.using("api").all().fetch();
      await fresh.using("indexeddb").save();
      template.articles = fresh;
    } catch (error) {
      console.error("Failed to refresh:", error);
    } finally {
      template.loading = false;
    }
  };

  return new ArticleListPage({
    ref: templateRef,
    articles,
    refresh,
  });
}

export async function articleDetail(
  ctx: ViewContext,
  params: Record<string, string>,
): Promise<Node> {
  const { ArticleDetailPage } = await import("./templates/article_detail.ts");
  const { id } = params;

  const article = await ArticleModel.objects
    .using("api")
    .get({ id: Number(id) });

  return new ArticleDetailPage({ article });
}

// src/my-app-ui/urls.ts
import { path } from "@alexi/urls";
import type { URLPattern } from "@alexi/urls";
import * as views from "./views.ts";

export const urlpatterns: URLPattern[] = [
  path("", views.home, { name: "home" }),
  path("articles/", views.articleList, { name: "article-list" }),
  path("articles/:id/", views.articleDetail, { name: "article-detail" }),
];
```
