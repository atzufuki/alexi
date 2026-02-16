# Serializers

Serializers handle conversion between complex data types (like model instances)
and Python/JSON primitives. They also provide validation for incoming data.

## Overview

Serializers serve two main purposes:

1. **Serialization** — Convert model instances to JSON for API responses
2. **Deserialization** — Validate and parse incoming JSON data

```typescript
import { ModelSerializer } from "@alexi/restframework";
import { ArticleModel } from "./models.ts";

class ArticleSerializer extends ModelSerializer {
  static Meta = {
    model: ArticleModel,
    fields: ["id", "title", "body", "createdAt"],
    readOnlyFields: ["id", "createdAt"],
  };
}

// Serialize a model instance
const serializer = new ArticleSerializer({ instance: article });
const data = serializer.data; // { id: 1, title: "...", body: "...", createdAt: "..." }

// Validate incoming data
const serializer = new ArticleSerializer({ data: requestData });
if (serializer.isValid()) {
  const article = await serializer.save();
}
```

## ModelSerializer

`ModelSerializer` automatically generates fields from an Alexi ORM model.

### Basic Usage

```typescript
import { ModelSerializer } from "@alexi/restframework";
import { TodoModel } from "./models.ts";

class TodoSerializer extends ModelSerializer {
  static Meta = {
    model: TodoModel,
    fields: ["id", "title", "completed", "createdAt"],
    readOnlyFields: ["id", "createdAt"],
  };
}
```

### Meta Options

| Option           | Type                      | Description                                       |
| ---------------- | ------------------------- | ------------------------------------------------- |
| `model`          | `ModelClass`              | The model class to serialize (required)           |
| `fields`         | `string[]` or `"__all__"` | Fields to include (required)                      |
| `exclude`        | `string[]`                | Fields to exclude                                 |
| `readOnlyFields` | `string[]`                | Fields that are read-only (not accepted in input) |
| `extraKwargs`    | `Record<string, object>`  | Extra options for specific fields                 |

### All Fields

Use `"__all__"` to include all model fields:

```typescript
class TodoSerializer extends ModelSerializer {
  static Meta = {
    model: TodoModel,
    fields: "__all__",
    readOnlyFields: ["id", "createdAt", "updatedAt"],
  };
}
```

### Excluding Fields

```typescript
class UserSerializer extends ModelSerializer {
  static Meta = {
    model: UserModel,
    fields: "__all__",
    exclude: ["password", "resetToken"],
  };
}
```

### Extra Field Options

```typescript
class ArticleSerializer extends ModelSerializer {
  static Meta = {
    model: ArticleModel,
    fields: ["id", "title", "body"],
    extraKwargs: {
      title: { maxLength: 100, required: true },
      body: { required: false, allowNull: true },
    },
  };
}
```

## Base Serializer

For custom serialization logic, extend the base `Serializer` class:

```typescript
import {
  BooleanField,
  CharField,
  IntegerField,
  Serializer,
} from "@alexi/restframework";

class TodoSerializer extends Serializer {
  id = new IntegerField({ readOnly: true });
  title = new CharField({ maxLength: 200 });
  completed = new BooleanField({ default: false });
}
```

### Manual Field Definitions

Override `getFieldDefinitions()` for dynamic fields:

```typescript
class DynamicSerializer extends Serializer {
  protected override getFieldDefinitions(): Record<string, SerializerField> {
    return {
      id: new IntegerField({ readOnly: true }),
      name: new CharField({ maxLength: 100 }),
      // Add fields dynamically based on conditions
    };
  }
}
```

## Field Types

### CharField

String field with optional length constraints:

```typescript
title = new CharField({ maxLength: 200 });
code = new CharField({ maxLength: 10, minLength: 3 });
description = new CharField({ required: false, allowBlank: true });
```

Options:

- `maxLength` — Maximum string length
- `minLength` — Minimum string length
- `allowBlank` — Allow empty strings (default: `false`)
- `trim` — Trim whitespace (default: `true`)

### TextField

Variable-length text field (no max length by default):

```typescript
body = new TextField();
content = new TextField({ required: false });
```

### IntegerField

Integer values:

```typescript
count = new IntegerField();
age = new IntegerField({ minValue: 0, maxValue: 150 });
priority = new IntegerField({ default: 0 });
```

Options:

- `minValue` — Minimum value
- `maxValue` — Maximum value

### FloatField

Floating-point numbers:

```typescript
price = new FloatField();
rating = new FloatField({ minValue: 0, maxValue: 5 });
```

Options:

- `minValue` — Minimum value
- `maxValue` — Maximum value

### BooleanField

Boolean values (handles string conversion):

```typescript
isActive = new BooleanField({ default: true });
completed = new BooleanField();
```

Accepts: `true`, `false`, `"true"`, `"false"`, `"1"`, `"0"`, `"yes"`, `"no"`

### DateTimeField

Date and time values:

```typescript
createdAt = new DateTimeField({ readOnly: true });
publishedAt = new DateTimeField({ required: false, allowNull: true });
```

Serializes to ISO 8601 string, accepts Date objects or ISO strings.

### DateField

Date values (without time):

```typescript
birthDate = new DateField();
dueDate = new DateField({ required: false });
```

Serializes to `YYYY-MM-DD` format.

### EmailField

Validates email format:

```typescript
email = new EmailField();
contactEmail = new EmailField({ required: false });
```

### URLField

Validates URL format:

```typescript
website = new URLField();
homepage = new URLField({ required: false });
```

### UUIDField

Validates UUID format:

```typescript
uuid = new UUIDField();
externalId = new UUIDField({ required: false });
```

### ChoiceField

Validates value is in a list of choices:

```typescript
status = new ChoiceField({ choices: ["draft", "published", "archived"] });
priority = new ChoiceField({ choices: [1, 2, 3, 4, 5] });
```

### ListField

Array of values:

```typescript
tags = new ListField({ child: new CharField({ maxLength: 50 }) });
scores = new ListField({
  child: new IntegerField({ minValue: 0, maxValue: 100 }),
  minLength: 1,
  maxLength: 10,
});
```

Options:

- `child` — Field type for list items (required)
- `minLength` — Minimum list length
- `maxLength` — Maximum list length
- `allowEmpty` — Allow empty list (default: `true`)

### JSONField

Arbitrary JSON data:

```typescript
metadata = new JSONField();
settings = new JSONField({ required: false });
```

### PrimaryKeyRelatedField

Related object by primary key:

```typescript
authorId = new PrimaryKeyRelatedField();
categoryIds = new PrimaryKeyRelatedField({ many: true });
```

Options:

- `many` — Accept array of IDs (default: `false`)

### SerializerMethodField

Computed read-only field:

```typescript
class ArticleSerializer extends Serializer {
  id = new IntegerField({ readOnly: true });
  title = new CharField();
  authorName = new SerializerMethodField();
  wordCount = new SerializerMethodField({ methodName: "calculateWordCount" });

  getAuthorName(article: Article): string {
    return article.author?.name ?? "Unknown";
  }

  calculateWordCount(article: Article): number {
    return article.body.split(/\s+/).length;
  }
}
```

By default, looks for `get{FieldName}` method. Use `methodName` option to
specify a different method.

## Common Field Options

All fields support these options:

| Option      | Type      | Default | Description                                                 |
| ----------- | --------- | ------- | ----------------------------------------------------------- |
| `required`  | `boolean` | `true`  | Field is required in input                                  |
| `readOnly`  | `boolean` | `false` | Field is only for output (not accepted in input)            |
| `writeOnly` | `boolean` | `false` | Field is only for input (not included in output)            |
| `default`   | `unknown` | —       | Default value if not provided                               |
| `allowNull` | `boolean` | `false` | Accept `null` values                                        |
| `source`    | `string`  | —       | Attribute name on the object (if different from field name) |
| `label`     | `string`  | —       | Human-readable label                                        |
| `helpText`  | `string`  | —       | Help text for documentation                                 |

## Validation

### Field-Level Validation

Add custom validation for specific fields:

```typescript
class UserSerializer extends ModelSerializer {
  static Meta = {
    model: UserModel,
    fields: ["id", "username", "email"],
  };

  // Validate username field
  validateUsername(value: string): string {
    if (value.toLowerCase() === "admin") {
      throw new FieldValidationError("Username 'admin' is reserved");
    }
    return value;
  }

  // Validate email field
  validateEmail(value: string): string {
    if (!value.endsWith("@company.com")) {
      throw new FieldValidationError("Must use company email");
    }
    return value;
  }
}
```

The method name must be `validate{FieldName}` (camelCase).

### Object-Level Validation

Override `validate()` for cross-field validation:

```typescript
class PasswordChangeSerializer extends Serializer {
  oldPassword = new CharField({ writeOnly: true });
  newPassword = new CharField({ writeOnly: true });
  confirmPassword = new CharField({ writeOnly: true });

  protected override validate(
    data: Record<string, unknown>,
  ): Record<string, unknown> {
    if (data.newPassword !== data.confirmPassword) {
      throw new ValidationError("Passwords do not match");
    }

    if (data.newPassword === data.oldPassword) {
      throw new ValidationError("New password must be different");
    }

    return data;
  }
}
```

### Checking Validity

```typescript
const serializer = new UserSerializer({ data: requestData });

if (serializer.isValid()) {
  // Data is valid
  const validatedData = serializer.validatedData;
  const user = await serializer.save();
} else {
  // Data is invalid
  const errors = serializer.errors;
  // { username: ["Username 'admin' is reserved"], email: ["Must use company email"] }
}
```

### Raising Exceptions

Use `isValid({ raiseException: true })` to throw on invalid data:

```typescript
try {
  serializer.isValid({ raiseException: true });
  const user = await serializer.save();
} catch (error) {
  if (error instanceof SerializerValidationError) {
    return Response.json({ errors: error.errors }, { status: 400 });
  }
  throw error;
}
```

## Serialization

### Single Instance

```typescript
const article = await ArticleModel.objects.get({ id: 1 });
const serializer = new ArticleSerializer({ instance: article });
const data = serializer.data;
// { id: 1, title: "...", body: "...", createdAt: "..." }
```

### Multiple Instances

Use `many: true` for lists:

```typescript
const articles = await ArticleModel.objects.all().fetch();
const serializer = new ArticleSerializer({
  instance: articles.array(),
  many: true,
});
const data = serializer.data;
// [{ id: 1, ... }, { id: 2, ... }, ...]
```

### Async Serialization

Use `toRepresentation()` for async fields (like `SerializerMethodField`):

```typescript
const serializer = new ArticleSerializer({ instance: article });
const data = await serializer.toRepresentation(article);
```

## Creating and Updating

### Creating Objects

```typescript
const serializer = new ArticleSerializer({
  data: { title: "New Article", body: "Content..." },
});

if (serializer.isValid()) {
  const article = await serializer.save();
}
```

### Updating Objects

Pass both `instance` and `data`:

```typescript
const article = await ArticleModel.objects.get({ id: 1 });

const serializer = new ArticleSerializer({
  instance: article,
  data: { title: "Updated Title" },
  partial: true, // Allow partial updates
});

if (serializer.isValid()) {
  const updated = await serializer.save();
}
```

### Partial Updates

Use `partial: true` to allow missing fields:

```typescript
// Without partial: true, all required fields must be present
// With partial: true, only provided fields are validated

const serializer = new ArticleSerializer({
  instance: article,
  data: { title: "New Title" }, // Only updating title
  partial: true,
});
```

### Custom Create/Update

Override `create()` and `update()` for custom logic:

```typescript
class ArticleSerializer extends ModelSerializer {
  static Meta = {
    model: ArticleModel,
    fields: ["id", "title", "body", "authorId"],
  };

  override async create(
    validatedData: Record<string, unknown>,
  ): Promise<ArticleModel> {
    // Add current user as author
    validatedData.authorId = this.context.user?.id;
    return await super.create(validatedData);
  }

  override async update(
    instance: ArticleModel,
    validatedData: Record<string, unknown>,
  ): Promise<ArticleModel> {
    // Track modification
    validatedData.updatedAt = new Date();
    return await super.update(instance, validatedData);
  }
}
```

## Context

Pass additional context to serializers:

```typescript
const serializer = new ArticleSerializer({
  data: requestData,
  context: {
    request: request,
    user: currentUser,
  },
});

// Access in serializer methods
class ArticleSerializer extends ModelSerializer {
  // ...

  getCanEdit(article: Article): boolean {
    const user = this.context.user as User;
    return article.authorId === user?.id;
  }
}
```

## Nested Serializers

### Read-Only Nested

```typescript
class CommentSerializer extends Serializer {
  id = new IntegerField({ readOnly: true });
  text = new CharField();
  author = new SerializerMethodField();

  getAuthor(comment: Comment): Record<string, unknown> {
    const author = comment.author;
    return {
      id: author.id,
      name: author.name,
    };
  }
}
```

### Writable Nested (Advanced)

For writable nested data, override `create()` and `update()`:

```typescript
class OrderSerializer extends ModelSerializer {
  static Meta = {
    model: OrderModel,
    fields: ["id", "items"],
  };

  override async create(
    validatedData: Record<string, unknown>,
  ): Promise<OrderModel> {
    const items = validatedData.items as Array<Record<string, unknown>>;
    delete validatedData.items;

    const order = await super.create(validatedData);

    for (const itemData of items) {
      await OrderItemModel.objects.create({
        ...itemData,
        orderId: order.id.get(),
      });
    }

    return order;
  }
}
```

## Full Example

```typescript
import {
  BooleanField,
  CharField,
  DateTimeField,
  FieldValidationError,
  IntegerField,
  ModelSerializer,
  Serializer,
  SerializerMethodField,
} from "@alexi/restframework";
import { ArticleModel, UserModel } from "./models.ts";

// Model Serializer with all features
class ArticleSerializer extends ModelSerializer {
  static Meta = {
    model: ArticleModel,
    fields: [
      "id",
      "title",
      "body",
      "status",
      "authorId",
      "createdAt",
      "updatedAt",
    ],
    readOnlyFields: ["id", "createdAt", "updatedAt"],
    extraKwargs: {
      title: { maxLength: 200 },
      body: { required: false },
    },
  };

  // Computed field
  authorName = new SerializerMethodField();
  wordCount = new SerializerMethodField();

  getAuthorName(article: ArticleModel): string {
    // Access related data
    return article.author?.name.get() ?? "Unknown";
  }

  getWordCount(article: ArticleModel): number {
    const body = article.body.get() as string;
    return body ? body.split(/\s+/).length : 0;
  }

  // Field validation
  validateTitle(value: string): string {
    if (value.toLowerCase().includes("spam")) {
      throw new FieldValidationError("Title contains prohibited words");
    }
    return value;
  }

  validateStatus(value: string): string {
    const validStatuses = ["draft", "published", "archived"];
    if (!validStatuses.includes(value)) {
      throw new FieldValidationError(
        `Status must be one of: ${validStatuses.join(", ")}`,
      );
    }
    return value;
  }

  // Object validation
  protected override validate(
    data: Record<string, unknown>,
  ): Record<string, unknown> {
    // Published articles must have a body
    if (data.status === "published" && !data.body) {
      throw new ValidationError("Published articles must have a body");
    }
    return data;
  }

  // Custom create
  override async create(
    validatedData: Record<string, unknown>,
  ): Promise<ArticleModel> {
    // Set author from context
    const user = this.context.user as UserModel;
    if (user) {
      validatedData.authorId = user.id.get();
    }
    return await super.create(validatedData);
  }
}

// Usage in ViewSet
class ArticleViewSet extends ModelViewSet {
  model = ArticleModel;
  serializerClass = ArticleSerializer;

  override async create(context: ViewSetContext): Promise<Response> {
    const data = await context.request.json();

    const serializer = new ArticleSerializer({
      data,
      context: { user: await getCurrentUser(context.request) },
    });

    if (!serializer.isValid()) {
      return Response.json({ errors: serializer.errors }, { status: 400 });
    }

    const article = await serializer.save();

    return Response.json(
      await new ArticleSerializer({ instance: article }).toRepresentation(
        article,
      ),
      { status: 201 },
    );
  }
}
```
