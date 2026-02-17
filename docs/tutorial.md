# Tutorial: Build a Todo App

This step-by-step tutorial guides you through building a complete Todo
application with Alexi. You'll create a REST API backend and a frontend SPA that
work together.

**What you'll learn:**

- Setting up an Alexi project
- Creating models with the ORM
- Building REST APIs with ViewSets
- Creating a frontend with client-side routing
- Connecting frontend to backend with RestBackend

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
deno run -A jsr:@alexi/create todo-app
cd todo-app
```

This creates a complete project structure with web, UI, and desktop apps.

### Step 2: Explore the Structure

```
todo-app/
├── manage.ts                 # CLI entry point
├── deno.jsonc                # Workspace config
├── project/                  # Settings
│   ├── settings.ts
│   ├── web.settings.ts
│   ├── ui.settings.ts
│   └── desktop.settings.ts
└── src/
    ├── todo-app-web/         # Backend (we'll modify this)
    ├── todo-app-ui/          # Frontend (we'll modify this)
    └── todo-app-desktop/     # Desktop wrapper
```

### Step 3: Start the Development Servers

```bash
deno task dev
```

This starts:

- Web server on `http://localhost:8000`
- UI server on `http://localhost:5173`
- Desktop window (WebUI)

Open `http://localhost:5173` in your browser. You should see the default Todo
app.

---

## Part 2: Understanding the Backend

The scaffolded project already has a working Todo API. Let's understand how it
works.

### Step 4: Examine the Model

Open `src/todo-app-web/models.ts`:

```ts
import {
  AutoField,
  BooleanField,
  CharField,
  DateTimeField,
  Manager,
  Model,
} from "@alexi/db";

export class TodoModel extends Model {
  id = new AutoField({ primaryKey: true });
  title = new CharField({ maxLength: 200 });
  completed = new BooleanField({ default: false });
  createdAt = new DateTimeField({ autoNowAdd: true });
  updatedAt = new DateTimeField({ autoNow: true });

  static objects = new Manager(TodoModel);

  static meta = {
    dbTable: "todos",
    ordering: ["-createdAt"],
  };
}
```

**Key concepts:**

- `Model` — Base class for all models
- Fields (`AutoField`, `CharField`, etc.) — Define the schema
- `Manager` — Provides query methods like `objects.all()`, `objects.filter()`
- `meta` — Model configuration (table name, default ordering)

### Step 5: Examine the Serializer

Open `src/todo-app-web/serializers.ts`:

```ts
import { ModelSerializer } from "@alexi/restframework";
import { TodoModel } from "./models.ts";

export class TodoSerializer extends ModelSerializer {
  static Meta = {
    model: TodoModel,
    fields: ["id", "title", "completed", "createdAt", "updatedAt"],
    readOnlyFields: ["id", "createdAt", "updatedAt"],
  };
}
```

**Key concepts:**

- `ModelSerializer` — Automatically generates fields from the model
- `fields` — Which fields to include in API responses
- `readOnlyFields` — Fields that can't be set via API

### Step 6: Examine the ViewSet

Open `src/todo-app-web/viewsets.ts`:

```ts
import { ModelViewSet } from "@alexi/restframework";
import { TodoModel } from "./models.ts";
import { TodoSerializer } from "./serializers.ts";

export class TodoViewSet extends ModelViewSet {
  model = TodoModel;
  serializer_class = TodoSerializer;
}
```

**Key concepts:**

- `ModelViewSet` — Provides full CRUD operations automatically
- Just point it at a model and serializer — that's it!

### Step 7: Test the API

With the server running, test the API:

```bash
# List all todos
curl http://localhost:8000/api/todos/

# Create a todo
curl -X POST http://localhost:8000/api/todos/ \
  -H "Content-Type: application/json" \
  -d '{"title": "Learn Alexi", "completed": false}'

# Get a specific todo
curl http://localhost:8000/api/todos/1/

# Update a todo
curl -X PUT http://localhost:8000/api/todos/1/ \
  -H "Content-Type: application/json" \
  -d '{"title": "Learn Alexi", "completed": true}'

# Delete a todo
curl -X DELETE http://localhost:8000/api/todos/1/
```

---

## Part 3: Customizing the Backend

Let's add some features to our API.

### Step 8: Add a Priority Field

Update `src/todo-app-web/models.ts`:

```ts
import {
  AutoField,
  BooleanField,
  CharField,
  DateTimeField,
  IntegerField, // Add this
  Manager,
  Model,
} from "@alexi/db";

export class TodoModel extends Model {
  id = new AutoField({ primaryKey: true });
  title = new CharField({ maxLength: 200 });
  completed = new BooleanField({ default: false });
  priority = new IntegerField({ default: 0 }); // Add this
  createdAt = new DateTimeField({ autoNowAdd: true });
  updatedAt = new DateTimeField({ autoNow: true });

  static objects = new Manager(TodoModel);

  static meta = {
    dbTable: "todos",
    ordering: ["-priority", "-createdAt"], // Sort by priority first
  };
}
```

### Step 9: Update the Serializer

Update `src/todo-app-web/serializers.ts`:

```ts
import { ModelSerializer } from "@alexi/restframework";
import { TodoModel } from "./models.ts";

export class TodoSerializer extends ModelSerializer {
  static Meta = {
    model: TodoModel,
    fields: ["id", "title", "completed", "priority", "createdAt", "updatedAt"],
    readOnlyFields: ["id", "createdAt", "updatedAt"],
  };
}
```

### Step 10: Add Filtering

Update `src/todo-app-web/viewsets.ts`:

```ts
import {
  ModelViewSet,
  OrderingFilter,
  QueryParamFilterBackend,
  SearchFilter,
} from "@alexi/restframework";
import { TodoModel } from "./models.ts";
import { TodoSerializer } from "./serializers.ts";

export class TodoViewSet extends ModelViewSet {
  model = TodoModel;
  serializer_class = TodoSerializer;

  // Enable filtering
  filterBackends = [
    new QueryParamFilterBackend(),
    new OrderingFilter(),
    new SearchFilter(),
  ];

  // Which fields can be filtered
  filtersetFields = ["completed", "priority"];

  // Which fields can be used for ordering
  orderingFields = ["createdAt", "priority", "title"];

  // Which fields are searched
  searchFields = ["title"];

  // Default ordering
  ordering = ["-priority", "-createdAt"];
}
```

### Step 11: Test Filtering

```bash
# Get only completed todos
curl "http://localhost:8000/api/todos/?completed=true"

# Get high priority todos
curl "http://localhost:8000/api/todos/?priority=2"

# Search todos
curl "http://localhost:8000/api/todos/?search=learn"

# Sort by title
curl "http://localhost:8000/api/todos/?ordering=title"

# Sort by priority descending
curl "http://localhost:8000/api/todos/?ordering=-priority"
```

### Step 12: Add a Custom Action

Let's add a "toggle" action that flips the completed status:

```ts
import {
  action,
  ModelViewSet,
  OrderingFilter,
  QueryParamFilterBackend,
  SearchFilter,
} from "@alexi/restframework";
import type { ViewSetContext } from "@alexi/restframework";
import { TodoModel } from "./models.ts";
import { TodoSerializer } from "./serializers.ts";

export class TodoViewSet extends ModelViewSet {
  model = TodoModel;
  serializer_class = TodoSerializer;

  filterBackends = [
    new QueryParamFilterBackend(),
    new OrderingFilter(),
    new SearchFilter(),
  ];

  filtersetFields = ["completed", "priority"];
  orderingFields = ["createdAt", "priority", "title"];
  searchFields = ["title"];
  ordering = ["-priority", "-createdAt"];

  // Custom action: POST /api/todos/:id/toggle/
  @action({ detail: true, methods: ["POST"] })
  async toggle(context: ViewSetContext): Promise<Response> {
    const todo = await this.getObject(context);
    todo.completed.set(!todo.completed.get());
    await todo.save();

    const serializer = new TodoSerializer({ instance: todo });
    return Response.json(await serializer.data);
  }
}
```

Test it:

```bash
# Toggle a todo's completed status
curl -X POST http://localhost:8000/api/todos/1/toggle/
```

---

## Part 4: Understanding the Frontend

Now let's look at how the frontend works.

### Step 13: Examine the Frontend Model

Open `src/todo-app-ui/models.ts`:

```ts
import {
  AutoField,
  BooleanField,
  CharField,
  DateTimeField,
  Manager,
  Model,
} from "@alexi/db";

export class TodoModel extends Model {
  id = new AutoField({ primaryKey: true });
  title = new CharField({ maxLength: 200 });
  completed = new BooleanField({ default: false });
  createdAt = new DateTimeField({ autoNowAdd: true });
  updatedAt = new DateTimeField({ autoNow: true });

  static objects = new Manager(TodoModel);

  static meta = {
    dbTable: "todos",
  };
}
```

Notice: The frontend model mirrors the backend model. This allows the same query
syntax on both sides.

### Step 14: Examine the REST Backend Setup

Open `src/todo-app-ui/settings.ts`:

```ts
import { RestBackend } from "@alexi/db/backends/rest";
import { setBackend } from "@alexi/db";
import { TodoEndpoint } from "./endpoints.ts";

const API_URL = "http://localhost:8000/api";

export const restBackend = new RestBackend({
  apiUrl: API_URL,
  endpoints: [TodoEndpoint],
});

export async function initializeApp() {
  await restBackend.connect();
  setBackend(restBackend);
}
```

The `RestBackend` maps ORM queries to REST API calls:

| ORM Operation                                | REST API Call          |
| -------------------------------------------- | ---------------------- |
| `TodoModel.objects.all().fetch()`            | `GET /api/todos/`      |
| `TodoModel.objects.get({ id: 1 })`           | `GET /api/todos/1/`    |
| `TodoModel.objects.create({ title: "..." })` | `POST /api/todos/`     |
| `todo.save()`                                | `PUT /api/todos/1/`    |
| `todo.delete()`                              | `DELETE /api/todos/1/` |

### Step 15: Update Frontend Model

Add the priority field to `src/todo-app-ui/models.ts`:

```ts
import {
  AutoField,
  BooleanField,
  CharField,
  DateTimeField,
  IntegerField, // Add this
  Manager,
  Model,
} from "@alexi/db";

export class TodoModel extends Model {
  id = new AutoField({ primaryKey: true });
  title = new CharField({ maxLength: 200 });
  completed = new BooleanField({ default: false });
  priority = new IntegerField({ default: 0 }); // Add this
  createdAt = new DateTimeField({ autoNowAdd: true });
  updatedAt = new DateTimeField({ autoNow: true });

  static objects = new Manager(TodoModel);

  static meta = {
    dbTable: "todos",
  };
}
```

---

## Part 5: Building the UI

Let's customize the todo list UI.

### Step 16: Update the Home Template

Open `src/todo-app-ui/templates/home.ts` and customize the todo display to show
priority:

```ts
// Find the todo item rendering and add priority indicator
// The exact implementation depends on your UI framework
// Here's the concept:

function renderTodoItem(todo: TodoModel) {
  const priorityColors = {
    0: "gray",
    1: "blue",
    2: "orange",
    3: "red",
  };

  const priority = todo.priority.get();
  const color = priorityColors[priority] || "gray";

  return `
    <div class="todo-item" data-id="${todo.id.get()}">
      <span class="priority-dot" style="color: ${color}">●</span>
      <input type="checkbox" ${todo.completed.get() ? "checked" : ""}>
      <span class="title">${todo.title.get()}</span>
    </div>
  `;
}
```

### Step 17: Add Priority Selection to the Form

When creating a new todo, allow selecting priority:

```ts
// Add to your todo creation form
const priorityOptions = [
  { value: 0, label: "Low" },
  { value: 1, label: "Normal" },
  { value: 2, label: "High" },
  { value: 3, label: "Urgent" },
];

// Create todo with priority
async function createTodo(title: string, priority: number) {
  const todo = await TodoModel.objects.create({
    title,
    priority,
    completed: false,
  });
  return todo;
}
```

### Step 18: Add Filtering UI

Add filter controls to show only certain todos:

```ts
// Filter functions
async function showAllTodos() {
  const todos = await TodoModel.objects.all().fetch();
  renderTodoList(todos);
}

async function showActiveTodos() {
  const todos = await TodoModel.objects
    .filter({ completed: false })
    .fetch();
  renderTodoList(todos);
}

async function showCompletedTodos() {
  const todos = await TodoModel.objects
    .filter({ completed: true })
    .fetch();
  renderTodoList(todos);
}

async function showHighPriority() {
  const todos = await TodoModel.objects
    .filter({ priority__gte: 2 })
    .fetch();
  renderTodoList(todos);
}
```

---

## Part 6: Adding Tests

### Step 19: Write Backend Tests

Create/update `src/todo-app-web/tests/todo_test.ts`:

```ts
import { assertEquals, assertExists } from "jsr:@std/assert@1";
import { reset, setup } from "@alexi/db";
import { DenoKVBackend } from "@alexi/db/backends/denokv";
import { TodoModel } from "../models.ts";

Deno.test({
  name: "TodoModel: CRUD operations",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    // Setup in-memory database
    const backend = new DenoKVBackend({ name: "test", path: ":memory:" });
    await backend.connect();
    await setup({ backend });

    try {
      // Create
      const todo = await TodoModel.objects.create({
        title: "Test Todo",
        completed: false,
        priority: 1,
      });

      assertExists(todo.id.get());
      assertEquals(todo.title.get(), "Test Todo");
      assertEquals(todo.completed.get(), false);
      assertEquals(todo.priority.get(), 1);

      // Read
      const fetched = await TodoModel.objects.get({ id: todo.id.get() });
      assertEquals(fetched.title.get(), "Test Todo");

      // Update
      todo.completed.set(true);
      todo.priority.set(2);
      await todo.save();

      const updated = await TodoModel.objects.get({ id: todo.id.get() });
      assertEquals(updated.completed.get(), true);
      assertEquals(updated.priority.get(), 2);

      // Delete
      await todo.delete();
      const deleted = await TodoModel.objects
        .filter({ id: todo.id.get() })
        .first();
      assertEquals(deleted, null);
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
});

Deno.test({
  name: "TodoModel: filtering",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const backend = new DenoKVBackend({ name: "test", path: ":memory:" });
    await backend.connect();
    await setup({ backend });

    try {
      // Create test data
      await TodoModel.objects.create({ title: "Low priority", priority: 0 });
      await TodoModel.objects.create({ title: "High priority", priority: 2 });
      await TodoModel.objects.create({
        title: "Completed",
        priority: 1,
        completed: true,
      });

      // Filter by priority
      const highPriority = await TodoModel.objects
        .filter({ priority__gte: 2 })
        .fetch();
      assertEquals(highPriority.length, 1);
      assertEquals(highPriority.array()[0].title.get(), "High priority");

      // Filter by completed
      const active = await TodoModel.objects
        .filter({ completed: false })
        .fetch();
      assertEquals(active.length, 2);
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
});
```

### Step 20: Run Tests

```bash
deno task test
```

---

## Part 7: Next Steps

Congratulations! You've built a complete Todo application. Here are some ideas
for extending it:

### Add Authentication

```ts
// Protect the API
import { loginRequired } from "@alexi/auth";

export const urlpatterns = [
  path("api/todos/", loginRequired(include(router.urls))),
];
```

### Add Categories/Tags

```ts
// Add a Category model
export class CategoryModel extends Model {
  id = new AutoField({ primaryKey: true });
  name = new CharField({ maxLength: 100 });
  color = new CharField({ maxLength: 7, default: "#3b82f6" });

  static objects = new Manager(CategoryModel);
}

// Add ForeignKey to TodoModel
export class TodoModel extends Model {
  // ...existing fields...
  category = new ForeignKey<CategoryModel>("CategoryModel", {
    onDelete: OnDelete.SET_NULL,
    null: true,
  });
}
```

### Add Due Dates

```ts
export class TodoModel extends Model {
  // ...existing fields...
  dueDate = new DateTimeField({ null: true, blank: true });
}

// Query overdue todos
const overdue = await TodoModel.objects
  .filter({
    completed: false,
    dueDate__lt: new Date(),
  })
  .fetch();
```

### Deploy to Deno Deploy

See the [Deployment Guide](./deployment.md) for instructions on deploying your
app.

---

## Summary

In this tutorial, you learned:

1. **Project Setup** — Using `@alexi/create` to scaffold projects
2. **Models** — Defining data with fields and managers
3. **Serializers** — Controlling API input/output
4. **ViewSets** — Building REST APIs with minimal code
5. **Filtering** — Query parameter filtering, ordering, and search
6. **Custom Actions** — Adding custom endpoints to ViewSets
7. **Frontend** — Connecting to the API with RestBackend
8. **Testing** — Writing tests for models and APIs

For more details, see the full documentation:

- [ORM Models](./db/models.md)
- [REST Framework](./restframework/viewsets.md)
- [Database Backends](./db/backends.md)
- [Authentication](./auth/authentication.md)
