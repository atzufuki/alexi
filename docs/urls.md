# URL Routing

Alexi provides Django-style URL routing with `path()` and `include()` functions
that work for both backend APIs and frontend SPAs.

## Overview

URL patterns map URL paths to view functions. The same routing system works for:

- **Backend** — REST API endpoints (Request → Response)
- **Frontend** — SPA page views (ViewContext → Node)

```typescript
import { include, path } from "@alexi/urls";

const urlpatterns = [
  path("", homeView, { name: "home" }),
  path("about/", aboutView, { name: "about" }),
  path("api/", include(apiPatterns)),
];
```

## path()

Creates a URL pattern that maps a route to a view function.

### Basic Usage

```typescript
import { path } from "@alexi/urls";
import { aboutView, contactView, homeView } from "./views.ts";

export const urlpatterns = [
  path("", homeView, { name: "home" }),
  path("about/", aboutView, { name: "about" }),
  path("contact/", contactView, { name: "contact" }),
];
```

### URL Parameters

Use `:paramName` syntax for dynamic URL segments:

```typescript
const urlpatterns = [
  path("users/", listUsers),
  path("users/:id/", getUser),
  path("users/:userId/posts/", listUserPosts),
  path("users/:userId/posts/:postId/", getUserPost),
];
```

Parameters are passed to the view function:

```typescript
// Backend view
async function getUser(
  request: Request,
  params: Record<string, string>,
): Promise<Response> {
  const { id } = params;
  const user = await UserModel.objects.get({ id: Number(id) });
  return Response.json(user);
}

// Frontend view
async function getUser(
  ctx: ViewContext,
  params: Record<string, string>,
): Promise<Node> {
  const { id } = params;
  const user = await UserModel.objects.using("api").get({ id: Number(id) });
  return new UserDetailPage({ user });
}
```

### Named Routes

Use the `name` option for reverse URL lookup:

```typescript
const urlpatterns = [
  path("articles/", listArticles, { name: "article-list" }),
  path("articles/:id/", getArticle, { name: "article-detail" }),
  path("articles/:id/edit/", editArticle, { name: "article-edit" }),
];
```

## include()

Includes nested URL patterns under a common prefix. This allows modular
organization of routes.

### Basic Usage

```typescript
import { include, path } from "@alexi/urls";
import { urlpatterns as articleUrls } from "./articles/urls.ts";
import { urlpatterns as userUrls } from "./users/urls.ts";

export const urlpatterns = [
  path("api/articles/", include(articleUrls)),
  path("api/users/", include(userUrls)),
];
```

### Nested Module Example

```typescript
// src/articles/urls.ts
import { path } from "@alexi/urls";
import * as views from "./views.ts";

export const urlpatterns = [
  path("", views.list, { name: "article-list" }),
  path(":id/", views.detail, { name: "article-detail" }),
  path(":id/comments/", views.comments, { name: "article-comments" }),
];

// src/urls.ts
import { include, path } from "@alexi/urls";
import { urlpatterns as articleUrls } from "./articles/urls.ts";

export const urlpatterns = [
  path("api/articles/", include(articleUrls)),
  // Results in:
  // /api/articles/           -> article-list
  // /api/articles/:id/       -> article-detail
  // /api/articles/:id/comments/ -> article-comments
];
```

### Alternative Syntax

`include()` can also be used directly with a prefix:

```typescript
import { include } from "@alexi/urls";
import { urlpatterns as articleUrls } from "./articles/urls.ts";

export const urlpatterns = [
  include("api/articles/", articleUrls),
  include("api/users/", userUrls),
];
```

## pathInclude()

Convenience function that combines `path()` and `include()`:

```typescript
import { pathInclude } from "@alexi/urls";
import { urlpatterns as articleUrls } from "./articles/urls.ts";

export const urlpatterns = [
  pathInclude("api/articles/", articleUrls),
];

// Equivalent to:
// path("api/articles/", include(articleUrls))
```

## Backend Routing

For backend APIs, URL patterns map to view functions that return `Response`
objects.

### With ViewSets (Recommended)

Use `DefaultRouter` with ViewSets for automatic CRUD endpoints:

```typescript
// urls.ts
import { include, path } from "@alexi/urls";
import { DefaultRouter } from "@alexi/restframework";
import { ArticleViewSet, UserViewSet } from "./viewsets.ts";

const router = new DefaultRouter();
router.register("articles", ArticleViewSet);
router.register("users", UserViewSet);

const apiPatterns = [
  path("health/", async () => Response.json({ status: "ok" })),
  ...router.urls,
];

export const urlpatterns = [
  path("api/", include(apiPatterns)),
];
```

This generates:

```
GET    /api/articles/           # List
POST   /api/articles/           # Create
GET    /api/articles/:id/       # Retrieve
PUT    /api/articles/:id/       # Update
PATCH  /api/articles/:id/       # Partial update
DELETE /api/articles/:id/       # Delete
```

### With Custom Views

For custom endpoints, use view functions directly:

```typescript
import { path } from "@alexi/urls";

async function healthCheck(request: Request): Promise<Response> {
  return Response.json({ status: "ok", timestamp: new Date() });
}

async function searchArticles(
  request: Request,
  params: Record<string, string>,
): Promise<Response> {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") || "";

  const articles = await ArticleModel.objects
    .filter({ title__icontains: query })
    .fetch();

  return Response.json(articles.array());
}

export const urlpatterns = [
  path("health/", healthCheck),
  path("search/", searchArticles),
];
```

### Using with Application

```typescript
// app.ts
import { Application } from "@alexi/http";
import { urlpatterns } from "./urls.ts";

const app = new Application({
  urls: urlpatterns,
});

Deno.serve({ port: 8000 }, app.handler);
```

## Frontend Routing

For frontend SPAs, URL patterns map to view functions that return `Node` objects
(HTML Props components).

### View Context

Frontend views receive a `ViewContext` instead of `Request`:

```typescript
export interface ViewContext {
  url: URL;
  params: Record<string, string>;
}
```

### Basic SPA Routes

```typescript
// urls.ts
import { path } from "@alexi/urls";
import type { URLPattern } from "@alexi/urls";
import * as views from "./views.ts";

export const urlpatterns: URLPattern[] = [
  path("", views.home, { name: "home" }),
  path("about/", views.about, { name: "about" }),
  path("articles/", views.articleList, { name: "article-list" }),
  path("articles/:id/", views.articleDetail, { name: "article-detail" }),
];
```

### Frontend View Functions

```typescript
// views.ts
import type { ViewContext } from "./utils.ts";

export async function home(
  ctx: ViewContext,
  params: Record<string, string>,
): Promise<Node> {
  const { HomePage } = await import("./templates/home.ts");
  return new HomePage();
}

export async function articleDetail(
  ctx: ViewContext,
  params: Record<string, string>,
): Promise<Node> {
  const { ArticleDetailPage } = await import("./templates/article_detail.ts");
  const { id } = params;

  // Fetch from REST API
  const article = await ArticleModel.objects
    .using("api")
    .get({ id: Number(id) });

  return new ArticleDetailPage({ article });
}
```

### Using with SPA Application

```typescript
// main.ts
import { SPAApplication } from "@alexi/urls";
import { urlpatterns } from "./urls.ts";

const app = new SPAApplication({
  urls: urlpatterns,
  rootElement: document.getElementById("app")!,
});

app.start();
```

## URL Resolution

### resolve()

Resolve a URL path to a view:

```typescript
import { resolve } from "@alexi/urls";

const result = resolve("/articles/123/", urlpatterns);

if (result) {
  console.log(result.view); // The matched view function
  console.log(result.params); // { id: "123" }
  console.log(result.name); // "article-detail"
}
```

### reverse()

Generate a URL from a named route:

```typescript
import { reverse } from "@alexi/urls";

const url = reverse("article-detail", { id: "123" });
// Returns: "/articles/123/"

const listUrl = reverse("article-list");
// Returns: "/articles/"
```

## Full Example

### Backend (REST API)

```typescript
// src/my-app-web/articles/views.ts
export async function listArticles(request: Request): Promise<Response> {
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

export async function createArticle(request: Request): Promise<Response> {
  const data = await request.json();
  const article = await ArticleModel.objects.create(data);
  return Response.json(article, { status: 201 });
}

// src/my-app-web/articles/urls.ts
import { path } from "@alexi/urls";
import * as views from "./views.ts";

export const urlpatterns = [
  path("", views.listArticles, { name: "article-list" }),
  path(":id/", views.getArticle, { name: "article-detail" }),
];

// src/my-app-web/urls.ts
import { include, path } from "@alexi/urls";
import { urlpatterns as articleUrls } from "./articles/urls.ts";

export const urlpatterns = [
  path("api/articles/", include(articleUrls)),
];
```

### Frontend (SPA)

```typescript
// src/my-app-ui/views.ts
import type { ViewContext } from "./utils.ts";

export async function articleList(
  ctx: ViewContext,
  params: Record<string, string>,
): Promise<Node> {
  const { ArticleListPage } = await import("./templates/article_list.ts");

  const articles = await ArticleModel.objects
    .using("api")
    .all()
    .fetch();

  return new ArticleListPage({ articles });
}

export async function articleDetail(
  ctx: ViewContext,
  params: Record<string, string>,
): Promise<Node> {
  const { ArticleDetailPage } = await import("./templates/article_detail.ts");

  const article = await ArticleModel.objects
    .using("api")
    .get({ id: Number(params.id) });

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

## Best Practices

1. **Use trailing slashes** — Follow Django convention: `path("articles/", ...)`
   not `path("articles", ...)`

2. **Name your routes** — Use meaningful names for reverse URL lookup:
   `{ name: "article-detail" }`

3. **Organize by feature** — Group related URLs in separate modules:
   ```
   src/
   ├── articles/
   │   ├── urls.ts
   │   └── views.ts
   ├── users/
   │   ├── urls.ts
   │   └── views.ts
   └── urls.ts  # Main URL config
   ```

4. **Use ViewSets for CRUD** — For standard CRUD operations, use `ModelViewSet`
   with `DefaultRouter`

5. **Keep views thin** — Views should handle routing logic; business logic
   belongs in models/services
