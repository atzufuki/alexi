# Filtering

Alexi REST Framework provides Django REST Framework-style filter backends for
filtering, ordering, and searching querysets via query parameters.

## Overview

Filter backends allow clients to filter API results using URL query parameters:

```
GET /api/todos/?completed=true
GET /api/todos/?priority__gte=5
GET /api/todos/?ordering=-createdAt
GET /api/todos/?search=important
```

## Quick Start

Enable filtering on a ViewSet:

```typescript
import {
  ModelViewSet,
  OrderingFilter,
  QueryParamFilterBackend,
  SearchFilter,
} from "@alexi/restframework";

class TodoViewSet extends ModelViewSet {
  model = TodoModel;
  serializerClass = TodoSerializer;

  // Enable filter backends
  filterBackends = [
    new QueryParamFilterBackend(),
    new OrderingFilter(),
    new SearchFilter(),
  ];

  // Configure allowed fields
  filtersetFields = ["id", "completed", "priority"];
  orderingFields = ["createdAt", "title", "priority"];
  searchFields = ["title", "description"];
  ordering = ["-createdAt"]; // default ordering
}
```

## QueryParamFilterBackend

Filters results based on query parameters matching model fields.

### Configuration

```typescript
class ArticleViewSet extends ModelViewSet {
  model = ArticleModel;
  serializerClass = ArticleSerializer;

  filterBackends = [new QueryParamFilterBackend()];
  filtersetFields = ["id", "status", "authorId", "categoryId"];
}
```

### Basic Filtering

```
GET /api/articles/?status=published
GET /api/articles/?authorId=5
GET /api/articles/?status=published&authorId=5
```

### Lookup Expressions

Use double underscores for advanced lookups:

| Lookup        | Example                     | Description                  |
| ------------- | --------------------------- | ---------------------------- |
| `exact`       | `?id=5`                     | Exact match (default)        |
| `iexact`      | `?title__iexact=hello`      | Case-insensitive exact match |
| `contains`    | `?title__contains=guide`    | Contains substring           |
| `icontains`   | `?title__icontains=guide`   | Case-insensitive contains    |
| `startswith`  | `?title__startswith=How`    | Starts with                  |
| `istartswith` | `?title__istartswith=how`   | Case-insensitive starts with |
| `endswith`    | `?title__endswith=Guide`    | Ends with                    |
| `iendswith`   | `?title__iendswith=guide`   | Case-insensitive ends with   |
| `gt`          | `?priority__gt=5`           | Greater than                 |
| `gte`         | `?priority__gte=5`          | Greater than or equal        |
| `lt`          | `?priority__lt=5`           | Less than                    |
| `lte`         | `?priority__lte=5`          | Less than or equal           |
| `in`          | `?status__in=draft,pending` | In list (comma-separated)    |
| `isnull`      | `?deletedAt__isnull=true`   | Is null                      |
| `range`       | `?priority__range=1,5`      | Within range                 |

### Type Coercion

Query parameter values are automatically converted to appropriate types:

| String Value | Converted To       |
| ------------ | ------------------ |
| `"true"`     | `true`             |
| `"false"`    | `false`            |
| `"null"`     | `null`             |
| `"123"`      | `123` (number)     |
| `"3.14"`     | `3.14` (number)    |
| `"hello"`    | `"hello"` (string) |

### Security

**Important:** Only fields listed in `filtersetFields` can be filtered. This
prevents clients from filtering on sensitive or internal fields.

```typescript
// Only these fields can be filtered
filtersetFields = ["id", "status", "categoryId"];

// This will be ignored:
// GET /api/articles/?internalScore=100
```

## OrderingFilter

Allows clients to order results via the `ordering` query parameter.

### Configuration

```typescript
class ArticleViewSet extends ModelViewSet {
  model = ArticleModel;
  serializerClass = ArticleSerializer;

  filterBackends = [new OrderingFilter()];
  orderingFields = ["createdAt", "title", "viewCount"];
  ordering = ["-createdAt"]; // default ordering
}
```

### Usage

```
GET /api/articles/?ordering=title           # Ascending by title
GET /api/articles/?ordering=-createdAt      # Descending by createdAt
GET /api/articles/?ordering=-viewCount,title # Multiple fields
```

### Default Ordering

Use the `ordering` property to set default ordering when no `ordering` parameter
is provided:

```typescript
ordering = ["-createdAt"]; // newest first
ordering = ["title"]; // alphabetical
ordering = ["-priority", "title"]; // by priority, then title
```

### Allowed Fields

If `orderingFields` is set, only those fields can be used for ordering. If not
set, all fields are allowed.

```typescript
// Only allow ordering by these fields
orderingFields = ["createdAt", "title"];

// This will be ignored:
// GET /api/articles/?ordering=secretScore
```

## SearchFilter

Provides text search across multiple fields using the `search` query parameter.

### Configuration

```typescript
class ArticleViewSet extends ModelViewSet {
  model = ArticleModel;
  serializerClass = ArticleSerializer;

  filterBackends = [new SearchFilter()];
  searchFields = ["title", "body", "summary"];
}
```

### Usage

```
GET /api/articles/?search=typescript
GET /api/articles/?search=getting%20started
```

The search is case-insensitive and uses `icontains` lookup.

**Note:** Currently, SearchFilter searches the first field in `searchFields`.
Full multi-field OR-based search requires Q objects support (planned for future
release).

## Combining Filter Backends

Multiple filter backends can be combined:

```typescript
class ArticleViewSet extends ModelViewSet {
  model = ArticleModel;
  serializerClass = ArticleSerializer;

  filterBackends = [
    new QueryParamFilterBackend(),
    new OrderingFilter(),
    new SearchFilter(),
  ];

  filtersetFields = ["status", "categoryId", "authorId"];
  orderingFields = ["createdAt", "title", "viewCount"];
  searchFields = ["title", "body"];
  ordering = ["-createdAt"];
}
```

Now you can combine all features:

```
GET /api/articles/?status=published&ordering=-viewCount&search=typescript
```

## Reserved Parameters

The following query parameters are reserved and not used for filtering:

- `limit` — Pagination limit
- `offset` — Pagination offset
- `page` — Page number
- `page_size` — Page size
- `ordering` — Used by OrderingFilter
- `search` — Used by SearchFilter
- `format` — Response format

## Custom Filter Backend

Create a custom filter backend by implementing the `FilterBackend` interface:

```typescript
import type { FilterableViewSet, FilterBackend } from "@alexi/restframework";
import type { Model, QuerySet } from "@alexi/db";
import type { ViewSetContext } from "@alexi/restframework";

class MyCustomFilter implements FilterBackend {
  filterQueryset<T extends Model>(
    queryset: QuerySet<T>,
    context: ViewSetContext,
    viewset: FilterableViewSet,
  ): QuerySet<T> {
    const url = new URL(context.request.url);
    const myParam = url.searchParams.get("my_param");

    if (myParam) {
      return queryset.filter({ someField: myParam });
    }

    return queryset;
  }
}

// Use it
class MyViewSet extends ModelViewSet {
  filterBackends = [new MyCustomFilter()];
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
  SearchFilter,
} from "@alexi/restframework";
import {
  AutoField,
  BooleanField,
  CharField,
  DateTimeField,
  IntegerField,
  Manager,
  Model,
} from "@alexi/db";

// Model
class TaskModel extends Model {
  id = new AutoField({ primaryKey: true });
  title = new CharField({ maxLength: 200 });
  description = new TextField({ blank: true });
  completed = new BooleanField({ default: false });
  priority = new IntegerField({ default: 0 });
  createdAt = new DateTimeField({ autoNowAdd: true });

  static objects = new Manager(TaskModel);
  static meta = { dbTable: "tasks" };
}

// Serializer
class TaskSerializer extends ModelSerializer {
  static Meta = {
    model: TaskModel,
    fields: [
      "id",
      "title",
      "description",
      "completed",
      "priority",
      "createdAt",
    ],
    readOnlyFields: ["id", "createdAt"],
  };
}

// ViewSet with full filtering
class TaskViewSet extends ModelViewSet {
  model = TaskModel;
  serializerClass = TaskSerializer;

  // Enable all filter backends
  filterBackends = [
    new QueryParamFilterBackend(),
    new OrderingFilter(),
    new SearchFilter(),
  ];

  // Field configurations
  filtersetFields = ["id", "completed", "priority"];
  orderingFields = ["createdAt", "title", "priority"];
  searchFields = ["title", "description"];
  ordering = ["-createdAt"];
}

// Example API calls:
// GET /api/tasks/                                    # All tasks, newest first
// GET /api/tasks/?completed=false                    # Incomplete tasks
// GET /api/tasks/?priority__gte=5                    # High priority
// GET /api/tasks/?completed=false&priority__gte=5    # High priority incomplete
// GET /api/tasks/?ordering=priority                  # Order by priority
// GET /api/tasks/?ordering=-priority,title           # Order by priority desc, then title
// GET /api/tasks/?search=important                   # Search in title/description
// GET /api/tasks/?completed=false&ordering=-priority&search=urgent  # Combined
```
