# ViewSets

ViewSets combine the logic for multiple related views into a single class,
providing CRUD operations for your models with minimal code.

## Overview

A ViewSet is a class that provides actions like `list`, `create`, `retrieve`,
`update`, and `destroy` without needing to define separate views for each
operation.

```typescript
import { ModelViewSet } from "@alexi/restframework";
import { TodoModel } from "./models.ts";
import { TodoSerializer } from "./serializers.ts";

class TodoViewSet extends ModelViewSet {
  model = TodoModel;
  serializer_class = TodoSerializer;
}
```

This single class provides:

| Method | Endpoint          | Action         | Description             |
| ------ | ----------------- | -------------- | ----------------------- |
| GET    | `/api/todos/`     | list           | List all todos          |
| POST   | `/api/todos/`     | create         | Create a new todo       |
| GET    | `/api/todos/:id/` | retrieve       | Get a single todo       |
| PUT    | `/api/todos/:id/` | update         | Update a todo           |
| PATCH  | `/api/todos/:id/` | partial_update | Partially update a todo |
| DELETE | `/api/todos/:id/` | destroy        | Delete a todo           |

## ModelViewSet

`ModelViewSet` provides complete CRUD operations for a model.

### Basic Configuration

```typescript
import { ModelViewSet } from "@alexi/restframework";

class ArticleViewSet extends ModelViewSet {
  model = ArticleModel;
  serializer_class = ArticleSerializer;
}
```

### Required Properties

| Property           | Type               | Description          |
| ------------------ | ------------------ | -------------------- |
| `model`            | `ModelWithManager` | The model class      |
| `serializer_class` | `SerializerClass`  | The serializer class |

### Optional Properties

| Property          | Type              | Default | Description                   |
| ----------------- | ----------------- | ------- | ----------------------------- |
| `backend`         | `DatabaseBackend` | —       | Database backend to use       |
| `lookupField`     | `string`          | `"id"`  | Field used for object lookup  |
| `lookupUrlKwarg`  | `string`          | `"id"`  | URL parameter name for lookup |
| `filterBackends`  | `FilterBackend[]` | —       | Filter backends to apply      |
| `filtersetFields` | `string[]`        | —       | Fields allowed for filtering  |
| `orderingFields`  | `string[]`        | —       | Fields allowed for ordering   |
| `searchFields`    | `string[]`        | —       | Fields for text search        |
| `ordering`        | `string[]`        | —       | Default ordering              |

## Registering ViewSets

Use a router to automatically generate URL patterns:

```typescript
import { DefaultRouter } from "@alexi/restframework";
import { TodoViewSet } from "./viewsets.ts";
import { ArticleViewSet } from "./viewsets.ts";

const router = new DefaultRouter();
router.register("todos", TodoViewSet);
router.register("articles", ArticleViewSet);

export const urlpatterns = router.urls;
```

## Custom Actions

Add custom endpoints to your ViewSet using the `@action` decorator:

```typescript
import { action, ModelViewSet } from "@alexi/restframework";
import type { ViewSetContext } from "@alexi/restframework";

class TodoViewSet extends ModelViewSet {
  model = TodoModel;
  serializer_class = TodoSerializer;

  @action({ detail: true, methods: ["POST"] })
  async toggle(context: ViewSetContext): Promise<Response> {
    const todo = await this.getObject(context);
    todo.completed.set(!todo.completed.get());
    await todo.save();

    const serializer = this.getSerializer({ instance: todo });
    const data = await serializer.toRepresentation(todo);
    return Response.json(data);
  }

  @action({ detail: false, methods: ["POST"] })
  async markAllComplete(context: ViewSetContext): Promise<Response> {
    const queryset = await this.getQueryset(context);
    await queryset.update({ completed: true });
    return Response.json({ success: true });
  }
}
```

### Action Options

| Option    | Type           | Description                                                                                                      |
| --------- | -------------- | ---------------------------------------------------------------------------------------------------------------- |
| `detail`  | `boolean`      | `true` for instance actions (`/todos/:id/toggle/`), `false` for collection actions (`/todos/mark_all_complete/`) |
| `methods` | `HttpMethod[]` | Allowed HTTP methods (`"GET"`, `"POST"`, `"PUT"`, `"PATCH"`, `"DELETE"`)                                         |

### Generated URLs

- `detail: true` → `/api/todos/:id/toggle/`
- `detail: false` → `/api/todos/mark_all_complete/`

## Customizing Queryset

Override `getQueryset()` to customize which objects are returned:

```typescript
class ArticleViewSet extends ModelViewSet {
  model = ArticleModel;
  serializer_class = ArticleSerializer;

  override async getQueryset(
    context: ViewSetContext,
  ): Promise<QuerySet<ArticleModel>> {
    const qs = await super.getQueryset(context);

    // Filter by URL query parameter
    const url = new URL(context.request.url);
    const categoryId = url.searchParams.get("category_id");

    if (categoryId) {
      return qs.filter({ categoryId: parseInt(categoryId) });
    }

    return qs;
  }
}
```

### User-Based Filtering

```typescript
class TaskViewSet extends ModelViewSet {
  model = TaskModel;
  serializer_class = TaskSerializer;

  override async getQueryset(
    context: ViewSetContext,
  ): Promise<QuerySet<TaskModel>> {
    const user = await getUserFromRequest(context.request);

    if (!user) {
      // Return empty queryset for unauthenticated users
      return TaskModel.objects.none();
    }

    // Only return tasks owned by the user
    return TaskModel.objects.filter({ ownerId: user.id });
  }
}
```

## Customizing Object Retrieval

Override `getObject()` to customize how a single object is retrieved:

```typescript
class ArticleViewSet extends ModelViewSet {
  model = ArticleModel;
  serializer_class = ArticleSerializer;

  // Use slug instead of id
  lookupField = "slug";
  lookupUrlKwarg = "slug";

  override async getObject(context: ViewSetContext): Promise<ArticleModel> {
    const article = await super.getObject(context);

    // Increment view count
    article.viewCount.set(article.viewCount.get() + 1);
    await article.save();

    return article;
  }
}
```

## Customizing Create/Update/Delete

### Custom Create Logic

```typescript
class ArticleViewSet extends ModelViewSet {
  model = ArticleModel;
  serializer_class = ArticleSerializer;

  override async performCreate(serializer: Serializer): Promise<ArticleModel> {
    // Get current user
    const user = await getUserFromRequest(this.request!);

    // Add author to validated data
    const data = {
      ...serializer.validatedData,
      authorId: user?.id,
    };

    return await ArticleModel.objects.create(data);
  }
}
```

### Custom Update Logic

```typescript
class ArticleViewSet extends ModelViewSet {
  model = ArticleModel;
  serializer_class = ArticleSerializer;

  override async performUpdate(
    serializer: Serializer,
    instance: ArticleModel,
  ): Promise<ArticleModel> {
    // Update fields
    const updated = await serializer.update(instance, serializer.validatedData);

    // Log the update
    console.log(`Article ${instance.id.get()} updated`);

    // Save to database
    await this.backend?.update(updated);

    return updated;
  }
}
```

### Custom Delete Logic

```typescript
class ArticleViewSet extends ModelViewSet {
  model = ArticleModel;
  serializer_class = ArticleSerializer;

  override async performDestroy(instance: ArticleModel): Promise<void> {
    // Soft delete instead of hard delete
    instance.deletedAt.set(new Date());
    await instance.save();

    // Or call super for hard delete
    // await super.performDestroy(instance);
  }
}
```

## ReadOnlyModelViewSet

For read-only APIs, use `ReadOnlyModelViewSet`:

```typescript
import { ReadOnlyModelViewSet } from "@alexi/restframework";

class PublicArticleViewSet extends ReadOnlyModelViewSet {
  model = ArticleModel;
  serializer_class = ArticleSerializer;
}
```

This only provides:

| Method | Endpoint             | Action   |
| ------ | -------------------- | -------- |
| GET    | `/api/articles/`     | list     |
| GET    | `/api/articles/:id/` | retrieve |

## Different Serializers per Action

Use different serializers for different actions:

```typescript
class ArticleViewSet extends ModelViewSet {
  model = ArticleModel;
  serializer_class = ArticleSerializer;

  override getSerializerClass(): SerializerClass {
    switch (this.action) {
      case "list":
        return ArticleListSerializer; // Minimal fields
      case "retrieve":
        return ArticleDetailSerializer; // All fields
      case "create":
      case "update":
        return ArticleWriteSerializer; // Write fields
      default:
        return this.serializer_class;
    }
  }
}
```

## ViewSet Context

The `ViewSetContext` object is passed to all action methods:

```typescript
interface ViewSetContext {
  request: Request; // The HTTP request
  params: Record<string, string>; // URL parameters
  action: ActionType; // Current action name
}
```

Access context in actions:

```typescript
@action({ detail: true, methods: ["GET"] })
async stats(context: ViewSetContext): Promise<Response> {
  const { request, params, action } = context;
  
  console.log(`Action: ${action}`);
  console.log(`Object ID: ${params.id}`);
  console.log(`URL: ${request.url}`);
  
  // ...
}
```

## Full Example

```typescript
import {
  action,
  ModelSerializer,
  ModelViewSet,
  OrderingFilter,
  QueryParamFilterBackend,
} from "@alexi/restframework";
import type { ViewSetContext } from "@alexi/restframework";
import {
  AutoField,
  BooleanField,
  CharField,
  DateTimeField,
  Manager,
  Model,
} from "@alexi/db";

// Model
class ProjectModel extends Model {
  id = new AutoField({ primaryKey: true });
  name = new CharField({ maxLength: 100 });
  description = new TextField({ blank: true });
  isActive = new BooleanField({ default: true });
  createdAt = new DateTimeField({ autoNowAdd: true });
  updatedAt = new DateTimeField({ autoNow: true });

  static objects = new Manager(ProjectModel);
  static meta = { dbTable: "projects" };
}

// Serializer
class ProjectSerializer extends ModelSerializer {
  static Meta = {
    model: ProjectModel,
    fields: ["id", "name", "description", "isActive", "createdAt", "updatedAt"],
    readOnlyFields: ["id", "createdAt", "updatedAt"],
  };
}

// ViewSet
class ProjectViewSet extends ModelViewSet {
  model = ProjectModel;
  serializer_class = ProjectSerializer;

  // Filtering
  filterBackends = [new QueryParamFilterBackend(), new OrderingFilter()];
  filtersetFields = ["id", "isActive"];
  orderingFields = ["name", "createdAt"];
  ordering = ["-createdAt"];

  // Custom action: Archive a project
  @action({ detail: true, methods: ["POST"] })
  async archive(context: ViewSetContext): Promise<Response> {
    const project = await this.getObject(context);
    project.isActive.set(false);
    await project.save();

    return Response.json({
      success: true,
      message: `Project "${project.name.get()}" archived`,
    });
  }

  // Custom action: Get project statistics
  @action({ detail: true, methods: ["GET"] })
  async stats(context: ViewSetContext): Promise<Response> {
    const project = await this.getObject(context);

    // Calculate stats...
    const taskCount = await TaskModel.objects
      .filter({ projectId: project.id.get() })
      .count();

    return Response.json({
      id: project.id.get(),
      name: project.name.get(),
      taskCount,
    });
  }

  // Custom action: Bulk activate
  @action({ detail: false, methods: ["POST"] })
  async activateAll(context: ViewSetContext): Promise<Response> {
    const queryset = await this.getQueryset(context);
    await queryset.update({ isActive: true });

    return Response.json({ success: true });
  }
}

// Router
const router = new DefaultRouter();
router.register("projects", ProjectViewSet);

export const urlpatterns = router.urls;

// Generated endpoints:
// GET    /api/projects/                  # List all projects
// POST   /api/projects/                  # Create a project
// GET    /api/projects/:id/              # Get a project
// PUT    /api/projects/:id/              # Update a project
// PATCH  /api/projects/:id/             # Partial update
// DELETE /api/projects/:id/              # Delete a project
// POST   /api/projects/:id/archive/      # Archive a project
// GET    /api/projects/:id/stats/        # Get project stats
// POST   /api/projects/activate_all/     # Activate all projects
```

## File Uploads

ViewSets handle file uploads by reading `multipart/form-data` from the request,
saving the file via the storage backend, and then passing the stored path to the
serializer.

### Model with ImageField

```typescript
// models.ts
import { AutoField, CharField, ImageField, Manager, Model } from "@alexi/db";

export class PostModel extends Model {
  id = new AutoField({ primaryKey: true });
  title = new CharField({ maxLength: 200 });
  cover = new ImageField({ uploadTo: "covers/", null: true, blank: true });

  static objects = new Manager(PostModel);
  static meta = { dbTable: "posts" };
}
```

### Serializer

Include the file field by name — `ModelSerializer` maps it to a string field
automatically:

```typescript
// serializers.ts
import { ModelSerializer } from "@alexi/restframework";
import { PostModel } from "./models.ts";

export class PostSerializer extends ModelSerializer {
  static override Meta = {
    model: PostModel,
    fields: ["id", "title", "cover"],
    readOnlyFields: ["id"],
  };
}
```

### ViewSet with file upload handling

Override `create()` (and optionally `update()`) to extract the file from
`FormData`, save it, and inject the path into the validated data before calling
`super.create()`:

```typescript
// viewsets.ts
import { getStorage } from "@alexi/storage";
import { ModelViewSet } from "@alexi/restframework";
import type { ViewSetContext } from "@alexi/restframework";
import { PostModel } from "./models.ts";
import { PostSerializer } from "./serializers.ts";

export class PostViewSet extends ModelViewSet {
  override model = PostModel;
  override serializer_class = PostSerializer;

  override async create(context: ViewSetContext): Promise<Response> {
    const formData = await context.request.formData();

    // Extract scalar fields
    const data: Record<string, unknown> = {
      title: formData.get("title"),
    };

    // Handle file upload
    const coverFile = formData.get("cover") as File | null;
    if (coverFile && coverFile.size > 0) {
      const storage = getStorage();
      const instance = new PostModel();
      const uploadPath = instance.cover.getUploadPath(coverFile.name);
      data.cover = await storage.save(uploadPath, coverFile);
    }

    const serializer = new PostSerializer({ data });
    if (!serializer.isValid()) {
      return Response.json({ errors: serializer.errors }, { status: 400 });
    }

    const post = await serializer.save();
    return Response.json(
      await new PostSerializer({ instance: post }).toRepresentation(post),
      { status: 201 },
    );
  }
}
```

### HTML form

Forms that include file inputs must set `enctype="multipart/form-data"`:

```html
<form method="POST" action="/api/posts/" enctype="multipart/form-data">
  <input type="text" name="title" required />
  <input type="file" name="cover" accept="image/*" />
  <button type="submit">Create Post</button>
</form>
```

### Serving uploaded files

Add a route that reads from the storage backend and streams the file back. See
[File Storage — FileSystemStorage](../storage/storage.md#filesystemstorage) for
a complete example.
