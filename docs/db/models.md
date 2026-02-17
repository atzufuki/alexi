# Models and ORM

Alexi's ORM provides a Django-style interface for defining and querying data
models across multiple backends.

## Defining Models

Models are TypeScript classes that extend `Model` and define fields as class
properties:

```typescript
import {
  AutoField,
  BooleanField,
  CharField,
  DateTimeField,
  IntegerField,
  Manager,
  Model,
  TextField,
} from "@alexi/db";

export class TodoModel extends Model {
  id = new AutoField({ primaryKey: true });
  title = new CharField({ maxLength: 200 });
  description = new TextField({ blank: true });
  completed = new BooleanField({ default: false });
  priority = new IntegerField({ default: 0 });
  createdAt = new DateTimeField({ autoNowAdd: true });
  updatedAt = new DateTimeField({ autoNow: true });

  static objects = new Manager(TodoModel);

  static meta = {
    dbTable: "todos",
  };
}
```

## Field Types

### AutoField

Auto-incrementing integer primary key:

```typescript
id = new AutoField({ primaryKey: true });
```

### CharField

Fixed-length string field:

```typescript
title = new CharField({ maxLength: 200 });
name = new CharField({ maxLength: 100, blank: true });
code = new CharField({ maxLength: 10, unique: true });
```

Options:

- `maxLength` (required) — Maximum string length
- `blank` — Allow empty strings (default: `false`)
- `unique` — Enforce uniqueness (default: `false`)

### TextField

Variable-length text field (no max length):

```typescript
description = new TextField();
content = new TextField({ blank: true });
```

### IntegerField

Integer values:

```typescript
count = new IntegerField();
priority = new IntegerField({ default: 0 });
age = new IntegerField({ null: true });
```

Options:

- `default` — Default value
- `null` — Allow null values (default: `false`)

### FloatField

Floating-point numbers:

```typescript
price = new FloatField();
rating = new FloatField({ default: 0.0 });
```

### BooleanField

Boolean values:

```typescript
isActive = new BooleanField({ default: true });
completed = new BooleanField({ default: false });
```

### DateTimeField

Date and time values:

```typescript
createdAt = new DateTimeField({ autoNowAdd: true });
updatedAt = new DateTimeField({ autoNow: true });
publishedAt = new DateTimeField({ null: true });
```

Options:

- `autoNowAdd` — Set to current time on creation
- `autoNow` — Update to current time on every save
- `null` — Allow null values

### DateField

Date values (without time):

```typescript
birthDate = new DateField();
dueDate = new DateField({ null: true });
```

### ForeignKey

Relationship to another model:

```typescript
import { ForeignKey } from "@alexi/db";

export class TaskModel extends Model {
  id = new AutoField({ primaryKey: true });
  title = new CharField({ maxLength: 200 });
  project = new ForeignKey({ to: "ProjectModel", onDelete: "CASCADE" });

  static objects = new Manager(TaskModel);
}
```

Options:

- `to` — Related model name (string) or model class
- `onDelete` — Deletion behavior: `"CASCADE"`, `"SET_NULL"`, `"PROTECT"`
- `null` — Allow null (for optional relationships)
- `relatedName` — Reverse accessor name

## Model Meta Options

Configure model behavior with the `meta` static property:

```typescript
static meta = {
  dbTable: "my_custom_table_name",
  ordering: ["-createdAt"],
};
```

Options:

- `dbTable` — Database table name
- `ordering` — Default ordering for queries

## Manager

Every model needs a Manager for queries:

```typescript
static objects = new Manager(TodoModel);
```

The manager provides the QuerySet interface for database operations.

## QuerySet API

### Retrieving Objects

#### all()

Get all objects:

```typescript
const todos = await TodoModel.objects.all().fetch();
```

#### filter()

Filter by conditions:

```typescript
// Exact match
const completed = await TodoModel.objects
  .filter({ completed: true })
  .fetch();

// Multiple conditions (AND)
const urgent = await TodoModel.objects
  .filter({ completed: false, priority__gte: 5 })
  .fetch();
```

#### exclude()

Exclude matching objects:

```typescript
const incomplete = await TodoModel.objects
  .exclude({ completed: true })
  .fetch();
```

#### get()

Get a single object (throws if not found or multiple):

```typescript
const todo = await TodoModel.objects.get({ id: 1 });
```

#### first() / last()

Get first or last object:

```typescript
const newest = await TodoModel.objects
  .orderBy("-createdAt")
  .first();

const oldest = await TodoModel.objects
  .orderBy("-createdAt")
  .last();
```

### Lookup Expressions

Use double underscores for advanced lookups:

| Lookup       | Description               | Example                                 |
| ------------ | ------------------------- | --------------------------------------- |
| `exact`      | Exact match (default)     | `{ id: 1 }` or `{ id__exact: 1 }`       |
| `iexact`     | Case-insensitive exact    | `{ title__iexact: "hello" }`            |
| `contains`   | Contains substring        | `{ title__contains: "test" }`           |
| `icontains`  | Case-insensitive contains | `{ title__icontains: "test" }`          |
| `startswith` | Starts with               | `{ title__startswith: "Hello" }`        |
| `endswith`   | Ends with                 | `{ title__endswith: "world" }`          |
| `gt`         | Greater than              | `{ priority__gt: 5 }`                   |
| `gte`        | Greater than or equal     | `{ priority__gte: 5 }`                  |
| `lt`         | Less than                 | `{ priority__lt: 5 }`                   |
| `lte`        | Less than or equal        | `{ priority__lte: 5 }`                  |
| `in`         | In list                   | `{ status__in: ["active", "pending"] }` |
| `isnull`     | Is null                   | `{ deletedAt__isnull: true }`           |
| `range`      | Within range              | `{ priority__range: [1, 5] }`           |

### Ordering

```typescript
// Ascending
const todos = await TodoModel.objects
  .orderBy("title")
  .fetch();

// Descending (prefix with -)
const recent = await TodoModel.objects
  .orderBy("-createdAt")
  .fetch();

// Multiple fields
const sorted = await TodoModel.objects
  .orderBy("-priority", "title")
  .fetch();
```

### Limiting Results

```typescript
// Limit
const top10 = await TodoModel.objects
  .orderBy("-priority")
  .limit(10)
  .fetch();

// Offset
const page2 = await TodoModel.objects
  .limit(10)
  .offset(10)
  .fetch();

// Slice (start, end)
const items = await TodoModel.objects
  .slice(20, 30)
  .fetch();
```

### Counting

```typescript
const count = await TodoModel.objects
  .filter({ completed: true })
  .count();
```

### Checking Existence

```typescript
const exists = await TodoModel.objects
  .filter({ title: "Important" })
  .exists();
```

## Creating Objects

### create()

Create and save in one step:

```typescript
const todo = await TodoModel.objects.create({
  title: "Learn Alexi",
  completed: false,
});
```

### Manual Creation

```typescript
const todo = new TodoModel();
todo.title.set("Learn Alexi");
todo.completed.set(false);
await todo.save();
```

## Updating Objects

### Update a Single Object

```typescript
const todo = await TodoModel.objects.get({ id: 1 });
todo.completed.set(true);
await todo.save();
```

### Update Multiple Objects

```typescript
await TodoModel.objects
  .filter({ completed: false })
  .update({ priority: 0 });
```

## Deleting Objects

### Delete a Single Object

```typescript
const todo = await TodoModel.objects.get({ id: 1 });
await todo.delete();
```

### Delete Multiple Objects

```typescript
await TodoModel.objects
  .filter({ completed: true })
  .delete();
```

## Multiple Backends

### Configuration

```typescript
import { setup } from "@alexi/db";

setup({
  databases: {
    default: { engine: "sqlite", name: "db.sqlite" },
    cache: { engine: "indexeddb", name: "app-cache" },
    api: { engine: "rest", name: "https://api.example.com" },
  },
});
```

### Using Specific Backends

```typescript
// Use default backend
const todos = await TodoModel.objects.all().fetch();

// Use cache backend
const cached = await TodoModel.objects
  .using("cache")
  .all()
  .fetch();

// Use REST API backend
const remote = await TodoModel.objects
  .using("api")
  .filter({ completed: true })
  .fetch();
```

### Syncing Between Backends

```typescript
// Fetch from API
const remoteTodos = await TodoModel.objects
  .using("api")
  .all()
  .fetch();

// Save to local cache
await remoteTodos.using("cache").save();
```

## Working with Field Values

Model fields use getter/setter methods:

```typescript
const todo = await TodoModel.objects.get({ id: 1 });

// Get value
const title = todo.title.get();
const isCompleted = todo.completed.get();

// Set value
todo.title.set("New Title");
todo.completed.set(true);

// Save changes
await todo.save();
```

## Iterating Results

### Array Access

```typescript
const qs = await TodoModel.objects.all().fetch();
const todos = qs.array();

for (const todo of todos) {
  console.log(todo.title.get());
}
```

### Async Iteration

```typescript
const qs = TodoModel.objects.all();

for await (const todo of qs) {
  console.log(todo.title.get());
}
```

## Select Related (Eager Loading)

Load related objects in a single query:

```typescript
const tasks = await TaskModel.objects
  .selectRelated("project")
  .fetch();

for (const task of tasks.array()) {
  // project is already loaded
  console.log(task.project.get()?.name.get());
}
```

## None QuerySet

Return an empty QuerySet (useful for conditional queries):

```typescript
function getTodos(user: User | null) {
  if (!user) {
    return TodoModel.objects.none();
  }
  return TodoModel.objects.filter({ userId: user.id });
}
```
