# Tutorial: Build a Blog App

This step-by-step tutorial guides you through building a complete blog
application with Alexi. You'll create a REST API backend, server-side rendered
views, and a Service Worker-powered frontend.

**What you'll learn:**

- Setting up an Alexi project
- Creating models with the ORM
- Building REST APIs with ViewSets
- Server-side rendered views with templates
- Connecting the frontend with RestBackend via a Service Worker

**Prerequisites:**

- Deno 2.0+ installed
- Basic TypeScript knowledge
- Familiarity with REST APIs

**Time:** ~30 minutes

---

## Part 1: Project Setup

### Step 1: Create the Project

Use `@alexi/create` to scaffold a new project:

```bash
deno run -A jsr:@alexi/create my-blog
cd my-blog
```

This creates a unified full-stack project with a server app, Service Worker, and
frontend assets all in one directory.

### Step 2: Explore the Structure

```
my-blog/
├── manage.ts                    # CLI entry point
├── deno.jsonc                   # Workspace config & import map
├── project/
│   ├── http.ts                  # Production entry point
│   ├── settings.ts              # Development settings
│   └── production.ts            # Production settings
└── src/
    └── my-blog/                 # Unified app
        ├── mod.ts               # Exports + MyBlogConfig
        ├── models.ts            # PostModel
        ├── serializers.ts       # PostSerializer
        ├── viewsets.ts          # PostViewSet
        ├── urls.ts              # Server URL routing
        ├── views.ts             # Server-side views
        ├── migrations/          # Database migrations
        ├── tests/               # Tests
        ├── templates/my-blog/   # HTML templates
        ├── assets/my-blog/      # Frontend TypeScript
        └── workers/my-blog/     # Service Worker
```

### Step 3: Start the Development Server

```bash
deno task dev
```

Open `http://localhost:8000` in your browser. You should see the default blog
home page.

---

## Part 2: Understanding the Backend

The scaffolded project already has a working Post API. Let's understand how it
works.

### Step 4: Examine the App Config

Open `src/my-blog/mod.ts`:

```ts
import type { AppConfig } from "@alexi/types";

export const MyBlogConfig: AppConfig = {
  name: "my-blog",
  verboseName: "MyBlog",
};

export * from "./models.ts";
export * from "./views.ts";
export * from "./urls.ts";
export * from "./serializers.ts";
export * from "./viewsets.ts";
```

The named `MyBlogConfig` export is what gets added to `INSTALLED_APPS` in
`project/settings.ts`:

```ts
import { MyBlogConfig } from "@my-blog/mod.ts";

export const INSTALLED_APPS = [
  StaticfilesConfig,
  DbConfig,
  AuthConfig,
  AdminConfig,
  MyBlogConfig,
];
```

### Step 5: Examine the Model

Open `src/my-blog/models.ts`:

```ts
import {
  AutoField,
  BooleanField,
  CharField,
  DateTimeField,
  Manager,
  Model,
  TextField,
} from "@alexi/db";

export class PostModel extends Model {
  id = new AutoField({ primaryKey: true });
  title = new CharField({ maxLength: 200 });
  content = new TextField({ blank: true });
  published = new BooleanField({ default: false });
  createdAt = new DateTimeField({ autoNowAdd: true });
  updatedAt = new DateTimeField({ autoNow: true });

  static objects = new Manager(PostModel);

  static meta = {
    dbTable: "posts",
    ordering: ["-createdAt"],
  };
}
```

**Key concepts:**

- `Model` — Base class for all models
- Fields (`AutoField`, `CharField`, etc.) — Define the schema
- `Manager` — Provides query methods like `objects.all()`, `objects.filter()`
- `meta` — Model configuration (table name, default ordering)

### Step 6: Examine the Serializer

Open `src/my-blog/serializers.ts`:

```ts
import { ModelSerializer } from "@alexi/restframework";
import { PostModel } from "./models.ts";

export class PostSerializer extends ModelSerializer {
  static override Meta = {
    model: PostModel,
    fields: ["id", "title", "content", "published", "createdAt", "updatedAt"],
    readOnlyFields: ["id", "createdAt", "updatedAt"],
  };
}
```

**Key concepts:**

- `ModelSerializer` — Automatically generates fields from the model
- `fields` — Which fields to include in API responses
- `readOnlyFields` — Fields that can't be set via API

### Step 7: Examine the ViewSet

Open `src/my-blog/viewsets.ts`:

```ts
import { ModelViewSet } from "@alexi/restframework";
import { PostModel } from "./models.ts";
import { PostSerializer } from "./serializers.ts";

export class PostViewSet extends ModelViewSet {
  model = PostModel;
  serializer_class = PostSerializer;
}
```

**Key concepts:**

- `ModelViewSet` — Provides full CRUD operations automatically
- Just point it at a model and serializer — that's it!

### Step 8: Test the API

With the server running, test the API:

```bash
# List all posts
curl http://localhost:8000/api/posts/

# Create a post
curl -X POST http://localhost:8000/api/posts/ \
  -H "Content-Type: application/json" \
  -d '{"title": "Hello Alexi", "content": "My first post.", "published": true}'

# Get a specific post
curl http://localhost:8000/api/posts/1/

# Update a post
curl -X PATCH http://localhost:8000/api/posts/1/ \
  -H "Content-Type: application/json" \
  -d '{"published": true}'

# Delete a post
curl -X DELETE http://localhost:8000/api/posts/1/
```

---

## Part 3: Customizing the Backend

Let's add some features to our API.

### Step 9: Add an Author Field

Update `src/my-blog/models.ts` to add an author name:

```ts
import {
  AutoField,
  BooleanField,
  CharField,
  DateTimeField,
  Manager,
  Model,
  TextField,
} from "@alexi/db";

export class PostModel extends Model {
  id = new AutoField({ primaryKey: true });
  title = new CharField({ maxLength: 200 });
  content = new TextField({ blank: true });
  author = new CharField({ maxLength: 100, blank: true }); // Add this
  published = new BooleanField({ default: false });
  createdAt = new DateTimeField({ autoNowAdd: true });
  updatedAt = new DateTimeField({ autoNow: true });

  static objects = new Manager(PostModel);

  static meta = {
    dbTable: "posts",
    ordering: ["-createdAt"],
  };
}
```

### Step 10: Update the Serializer

Update `src/my-blog/serializers.ts`:

```ts
export class PostSerializer extends ModelSerializer {
  static override Meta = {
    model: PostModel,
    fields: [
      "id",
      "title",
      "content",
      "author",
      "published",
      "createdAt",
      "updatedAt",
    ],
    readOnlyFields: ["id", "createdAt", "updatedAt"],
  };
}
```

### Step 11: Add Filtering

Update `src/my-blog/viewsets.ts`:

```ts
import {
  ModelViewSet,
  OrderingFilter,
  QueryParamFilterBackend,
  SearchFilter,
} from "@alexi/restframework";
import { PostModel } from "./models.ts";
import { PostSerializer } from "./serializers.ts";

export class PostViewSet extends ModelViewSet {
  model = PostModel;
  serializer_class = PostSerializer;

  filterBackends = [
    new QueryParamFilterBackend(),
    new OrderingFilter(),
    new SearchFilter(),
  ];

  filtersetFields = ["published", "author"];
  orderingFields = ["createdAt", "title"];
  searchFields = ["title", "content"];
}
```

### Step 12: Test Filtering

```bash
# Get only published posts
curl "http://localhost:8000/api/posts/?published=true"

# Search posts
curl "http://localhost:8000/api/posts/?search=alexi"

# Sort by title
curl "http://localhost:8000/api/posts/?ordering=title"
```

### Step 13: Add a Custom Action

Add a "publish" action that sets published to true:

```ts
import {
  action,
  ModelViewSet,
  OrderingFilter,
  QueryParamFilterBackend,
  SearchFilter,
} from "@alexi/restframework";
import type { ViewSetContext } from "@alexi/restframework";
import { PostModel } from "./models.ts";
import { PostSerializer } from "./serializers.ts";

export class PostViewSet extends ModelViewSet {
  model = PostModel;
  serializer_class = PostSerializer;

  filterBackends = [
    new QueryParamFilterBackend(),
    new OrderingFilter(),
    new SearchFilter(),
  ];

  filtersetFields = ["published", "author"];
  orderingFields = ["createdAt", "title"];
  searchFields = ["title", "content"];

  // Custom action: POST /api/posts/:id/publish/
  @action({ detail: true, methods: ["POST"] })
  async publish(context: ViewSetContext): Promise<Response> {
    const post = await this.getObject(context);
    post.published.set(true);
    await post.save({ updateFields: ["published"] });

    const serializer = new PostSerializer({ instance: post });
    return Response.json(await serializer.data);
  }
}
```

Test it:

```bash
# Publish a post
curl -X POST http://localhost:8000/api/posts/1/publish/
```

---

## Part 4: Server-Side Views and Templates

The scaffolded project also includes server-side rendered HTML views.

### Step 14: Examine the Views

Open `src/my-blog/views.ts`:

```ts
import { TemplateView } from "@alexi/views";
import { PostModel } from "./models.ts";

export class HomeView extends TemplateView {
  templateName = "my-blog/index.html";

  override async getContext(request: Request) {
    const posts = await PostModel.objects
      .filter({ published: true })
      .fetch();
    return { posts };
  }
}
```

### Step 15: Examine the Templates

Templates live in `src/my-blog/templates/my-blog/` and use Django Template
Language syntax:

```html
{# src/my-blog/templates/my-blog/post_list.html #} {% extends
"my-blog/base.html" %} {% block content %}
<h1>Posts</h1>
{% for post in posts %}
<article>
  <h2><a href="/posts/{{ post.id }}/">{{ post.title }}</a></h2>
  <p>{{ post.content }}</p>
</article>
{% empty %}
<p>No posts yet.</p>
{% endfor %} {% endblock %}
```

---

## Part 5: Service Worker Frontend

The Service Worker intercepts fetch requests and renders templates in the
browser using the same ORM and templates as the server.

### Step 16: Examine the Worker Settings

Open `src/my-blog/workers/my-blog/settings.ts`:

```ts
import { RestBackend } from "@alexi/db/backends/rest";
import { PostEndpoint } from "./endpoints.ts";
import { urlpatterns } from "./urls.ts";

export const DATABASES = {
  default: new RestBackend({
    apiUrl: "/api",
    endpoints: [PostEndpoint],
  }),
};

export const ROOT_URLCONF = urlpatterns;

export const TEMPLATES = [{ APP_DIRS: true, DIRS: [] as string[] }];
```

The `RestBackend` maps ORM queries to REST API calls:

| ORM Operation                                | REST API Call          |
| -------------------------------------------- | ---------------------- |
| `PostModel.objects.all().fetch()`            | `GET /api/posts/`      |
| `PostModel.objects.get({ id: 1 })`           | `GET /api/posts/1/`    |
| `PostModel.objects.create({ title: "..." })` | `POST /api/posts/`     |
| `post.save()`                                | `PUT /api/posts/1/`    |
| `post.delete()`                              | `DELETE /api/posts/1/` |

---

## Part 6: Adding Tests

### Step 17: Write Backend Tests

Create/update `src/my-blog/tests/post_test.ts`:

```ts
import { assertEquals, assertExists } from "jsr:@std/assert@1";
import { reset, setup } from "@alexi/db";
import { DenoKVBackend } from "@alexi/db/backends/denokv";
import { PostModel } from "../models.ts";

Deno.test({
  name: "PostModel: CRUD operations",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const backend = new DenoKVBackend({ name: "test", path: ":memory:" });
    await backend.connect();
    await setup({ backend });

    try {
      // Create
      const post = await PostModel.objects.create({
        title: "Hello Alexi",
        content: "My first post.",
        published: true,
      });

      assertExists(post.id.get());
      assertEquals(post.title.get(), "Hello Alexi");
      assertEquals(post.published.get(), true);

      // Read
      const fetched = await PostModel.objects.get({ id: post.id.get() });
      assertEquals(fetched.title.get(), "Hello Alexi");

      // Update
      post.title.set("Updated Title");
      await post.save({ updateFields: ["title"] });

      const updated = await PostModel.objects.get({ id: post.id.get() });
      assertEquals(updated.title.get(), "Updated Title");

      // Delete
      await post.delete();
      const deleted = await PostModel.objects
        .filter({ id: post.id.get() })
        .first();
      assertEquals(deleted, null);
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
});

Deno.test({
  name: "PostModel: filtering",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const backend = new DenoKVBackend({ name: "test", path: ":memory:" });
    await backend.connect();
    await setup({ backend });

    try {
      await PostModel.objects.create({ title: "Draft", published: false });
      await PostModel.objects.create({ title: "Live", published: true });

      const published = await PostModel.objects
        .filter({ published: true })
        .fetch();
      assertEquals(published.length, 1);
      assertEquals(published[0].title.get(), "Live");
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
});
```

### Step 18: Run Tests

```bash
deno task test
```

---

## Part 7: Next Steps

Congratulations! You've built a complete blog application. Here are some ideas
for extending it:

### Add Authentication

```ts
// Protect the publish action with JWT
import { JWTAuthentication } from "@alexi/restframework/authentication";
import { IsAuthenticated } from "@alexi/restframework";

export class PostViewSet extends ModelViewSet {
  // ...
  authentication_classes = [JWTAuthentication];
  permission_classes = [IsAuthenticated];
}
```

### Add Categories

```ts
export class CategoryModel extends Model {
  id = new AutoField({ primaryKey: true });
  name = new CharField({ maxLength: 100 });
  slug = new CharField({ maxLength: 120 });

  static objects = new Manager(CategoryModel);
}

export class PostModel extends Model {
  // ...existing fields...
  category = new ForeignKey("CategoryModel", {
    onDelete: OnDelete.SET_NULL,
    null: true,
    relatedName: "posts",
  });
}
```

### Deploy to Deno Deploy

See the [Deployment Guide](./deployment.md) for instructions on deploying your
app to Deno Deploy.

---

## Summary

In this tutorial, you learned:

1. **Project Setup** — Using `@alexi/create` to scaffold a unified project
2. **AppConfig** — Named export pattern for `INSTALLED_APPS`
3. **Models** — Defining data with fields and managers
4. **Serializers** — Controlling API input/output
5. **ViewSets** — Building REST APIs with minimal code
6. **Filtering** — Query parameter filtering, ordering, and search
7. **Custom Actions** — Adding custom endpoints to ViewSets
8. **Templates** — Server-side HTML rendering
9. **Service Worker** — Connecting the frontend with RestBackend
10. **Testing** — Writing tests for models and APIs

For more details, see the full documentation:

- [ORM Models](./db/models.md)
- [REST Framework](./restframework/viewsets.md)
- [Database Backends](./db/backends.md)
- [Authentication](./auth/authentication.md)
- [Scaffolding](./create/scaffolding.md)
