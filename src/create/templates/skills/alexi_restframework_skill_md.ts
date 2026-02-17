/**
 * Template for alexi-restframework SKILL.md
 *
 * Generates the Agent Skills file for @alexi/restframework REST API.
 */

export function generateAlexiRestframeworkSkillMd(): string {
  return `---
name: alexi-restframework
description: Use when building REST APIs with @alexi/restframework - creating Serializers, ViewSets, Routers, and implementing Django REST Framework patterns in Deno.
license: MIT
metadata:
  author: atzufuki
  version: "1.0"
  package: "@alexi/restframework"
---

# Alexi REST Framework

## Overview

\`@alexi/restframework\` is a Django REST Framework-inspired toolkit for building
REST APIs in Deno. It provides Serializers, ViewSets, and Routers that mirror
DRF's patterns.

## When to Use This Skill

- Building REST API endpoints
- Serializing model data for JSON responses
- Creating CRUD ViewSets for models
- Defining custom API actions
- Setting up URL routing for API endpoints

## Installation

\`\`\`bash
deno add jsr:@alexi/restframework
\`\`\`

## Serializers

Serializers define how data is converted to/from JSON:

\`\`\`typescript
import {
  BooleanField,
  CharField,
  DateTimeField,
  IntegerField,
  Serializer,
} from "@alexi/restframework";

export class TaskSerializer extends Serializer {
  id = new IntegerField({ readOnly: true });
  title = new CharField({ maxLength: 200 });
  description = new CharField({ required: false });
  completed = new BooleanField({ default: false });
  createdAt = new DateTimeField({ readOnly: true });
}
\`\`\`

### ModelSerializer

Auto-generates fields from a model:

\`\`\`typescript
import { ModelSerializer } from "@alexi/restframework";
import { TaskModel } from "./models.ts";

export class TaskModelSerializer extends ModelSerializer {
  static override Meta = {
    model: TaskModel,
    fields: ["id", "title", "description", "status", "priority", "createdAt"],
    readOnlyFields: ["id", "createdAt"],
  };
}
\`\`\`

### SerializerMethodField

For computed/async fields:

\`\`\`typescript
import {
  CharField,
  IntegerField,
  Serializer,
  SerializerMethodField,
} from "@alexi/restframework";

export class TaskDetailSerializer extends Serializer {
  id = new IntegerField({ readOnly: true });
  title = new CharField();
  assigneeName = new SerializerMethodField();

  async getAssigneeName(task: unknown): Promise<string | null> {
    const record = task as Record<string, unknown>;
    const assigneeId = record.assigneeId;
    if (!assigneeId) return null;
    const user = await UserModel.objects.filter({ id: assigneeId }).first();
    return user ? \`\${user.firstName.get()} \${user.lastName.get()}\` : null;
  }
}
\`\`\`

## ViewSets

### ModelViewSet

Full CRUD operations for a model:

\`\`\`typescript
import { ModelViewSet } from "@alexi/restframework";
import type { ViewSetContext } from "@alexi/restframework";
import { TaskModel } from "./models.ts";
import { TaskSerializer } from "./serializers.ts";

export class TaskViewSet extends ModelViewSet {
  model = TaskModel;
  serializer_class = TaskSerializer;

  // Optional: customize queryset
  override getQueryset(context: ViewSetContext) {
    const qs = super.getQueryset(context);
    const url = new URL(context.request.url);
    const status = url.searchParams.get("status");
    if (status) {
      return qs.filter({ status });
    }
    return qs;
  }
}
\`\`\`

### Custom Actions

Use the \`@action\` decorator for custom endpoints:

\`\`\`typescript
import { action, ModelViewSet } from "@alexi/restframework";
import type { ViewSetContext } from "@alexi/restframework";

export class TaskViewSet extends ModelViewSet {
  model = TaskModel;
  serializer_class = TaskSerializer;

  // POST /tasks/:id/complete/
  @action({ detail: true, methods: ["POST"] })
  async complete(context: ViewSetContext): Promise<Response> {
    const task = await this.getObject(context);
    task.status.set("completed");
    await task.save();
    return Response.json({ status: "completed" });
  }

  // GET /tasks/statistics/
  @action({ detail: false, methods: ["GET"] })
  async statistics(context: ViewSetContext): Promise<Response> {
    const total = await TaskModel.objects.count();
    const completed = await TaskModel.objects.filter({ status: "completed" }).count();
    return Response.json({ total, completed });
  }
}
\`\`\`

### ViewSet (Non-Model)

For endpoints without a model:

\`\`\`typescript
import { ViewSet } from "@alexi/restframework";
import type { ViewSetContext } from "@alexi/restframework";

export class HealthViewSet extends ViewSet {
  async list(context: ViewSetContext): Promise<Response> {
    return Response.json({ status: "ok", timestamp: new Date().toISOString() });
  }
}
\`\`\`

## Router

Register ViewSets and generate URL patterns:

\`\`\`typescript
import { Router } from "@alexi/restframework";
import { HealthViewSet, TaskViewSet, UserViewSet } from "./viewsets.ts";

const router = new Router();
router.register("tasks", TaskViewSet);
router.register("users", UserViewSet);
router.register("health", HealthViewSet, { basename: "health" });

export const urlpatterns = router.urls;
\`\`\`

### Generated URLs

For \`TaskViewSet\` registered at "tasks":

| Action  | Method | URL               |
|---------|--------|-------------------|
| list    | GET    | /tasks/           |
| create  | POST   | /tasks/           |
| retrieve| GET    | /tasks/:id/       |
| update  | PUT    | /tasks/:id/       |
| partial | PATCH  | /tasks/:id/       |
| destroy | DELETE | /tasks/:id/       |
| complete| POST   | /tasks/:id/complete/ |
| statistics | GET | /tasks/statistics/ |

## Serializer Field Types

| Field             | Description                    |
|-------------------|--------------------------------|
| \`CharField\`       | String                         |
| \`IntegerField\`    | Integer                        |
| \`FloatField\`      | Float                          |
| \`DecimalField\`    | Decimal with precision         |
| \`BooleanField\`    | Boolean                        |
| \`DateField\`       | Date (YYYY-MM-DD)              |
| \`DateTimeField\`   | DateTime (ISO 8601)            |
| \`EmailField\`      | Email string                   |
| \`URLField\`        | URL string                     |
| \`UUIDField\`       | UUID string                    |
| \`JSONField\`       | JSON object                    |
| \`ListField\`       | Array of items                 |
| \`PrimaryKeyRelatedField\` | FK as ID             |
| \`SerializerMethodField\`  | Computed field         |

## Field Options

\`\`\`typescript
new CharField({
  required: true,       // Must be provided (default: true)
  readOnly: false,      // Cannot be written (default: false)
  writeOnly: false,     // Not included in output (default: false)
  default: "draft",     // Default value
  maxLength: 200,       // Max string length
  minLength: 1,         // Min string length
  allowBlank: false,    // Allow empty string (default: false)
  source: "fieldName",  // Map to different field name
});
\`\`\`

## Using Serializers

\`\`\`typescript
const serializer = new TaskSerializer();

// Serialize single instance
const data = await serializer.toRepresentation(task);
// { id: 1, title: "Task 1", completed: false, ... }

// Serialize multiple instances
const tasksData = await Promise.all(
  tasks.map((t) => serializer.toRepresentation(t))
);

// Deserialize and validate
const validated = await serializer.toInternalValue(requestData);
if (serializer.isValid()) {
  const task = await TaskModel.objects.create(validated);
}
\`\`\`

## Common Mistakes

**Not using async toRepresentation**

\`\`\`typescript
// ❌ Wrong - SerializerMethodField is async
const data = serializer.toRepresentation(task);

// ✅ Correct - always await
const data = await serializer.toRepresentation(task);
\`\`\`

**Forgetting to register ViewSet in Router**

\`\`\`typescript
// ❌ Missing registration
const router = new Router();
// ... forgot router.register()

// ✅ Register all ViewSets
const router = new Router();
router.register("tasks", TaskViewSet);
\`\`\`

**Not returning Response from ViewSet methods**

\`\`\`typescript
// ❌ Wrong - returns plain object
async list(context: ViewSetContext) {
  return { tasks: [] };
}

// ✅ Correct - return Response
async list(context: ViewSetContext): Promise<Response> {
  return Response.json({ tasks: [] });
}
\`\`\`

## Import Reference

\`\`\`typescript
// ViewSets
import { ModelViewSet, Router, ViewSet } from "@alexi/restframework";
import type { ViewSetContext } from "@alexi/restframework";

// Serializers
import {
  CharField,
  IntegerField,
  ModelSerializer,
  Serializer,
} from "@alexi/restframework";
import {
  PrimaryKeyRelatedField,
  SerializerMethodField,
} from "@alexi/restframework";

// Decorators
import { action } from "@alexi/restframework";
\`\`\`
`;
}
