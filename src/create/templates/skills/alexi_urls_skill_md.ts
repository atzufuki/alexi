/**
 * Template for alexi-urls SKILL.md
 *
 * Generates the Agent Skills file for @alexi/urls URL routing.
 */

export function generateAlexiUrlsSkillMd(): string {
  return `---
name: alexi-urls
description: Use when configuring URL routing with @alexi/urls - defining routes with path(), including nested routes, URL parameters, and Django-style URL patterns in Deno.
license: MIT
metadata:
  author: atzufuki
  version: "1.0"
  package: "@alexi/urls"
---

# Alexi URL Routing

## Overview

\`@alexi/urls\` provides Django-style URL routing for Alexi applications. It uses
\`path()\` and \`include()\` functions to define URL patterns that map to views.

## When to Use This Skill

- Defining URL routes for your application
- Creating nested URL patterns with include()
- Adding URL parameters (path variables)
- Organizing routes across multiple apps
- Integrating REST framework routers

## Installation

\`\`\`bash
deno add jsr:@alexi/urls
\`\`\`

## Basic URL Patterns

### Simple Routes

\`\`\`typescript
import { path } from "@alexi/urls";

// View function type
type View = (request: Request, params: Record<string, string>) => Promise<Response>;

const healthView: View = async (request, params) => {
  return Response.json({ status: "ok" });
};

const aboutView: View = async (request, params) => {
  return Response.json({ page: "about" });
};

export const urlpatterns = [
  path("health/", healthView, { name: "health" }),
  path("about/", aboutView, { name: "about" }),
];
\`\`\`

### URL Parameters

Use \`:paramName\` syntax for path variables:

\`\`\`typescript
import { path } from "@alexi/urls";

const userDetailView: View = async (request, params) => {
  const userId = params.id; // Extracted from URL
  const user = await UserModel.objects.get({ id: parseInt(userId) });
  return Response.json({ user });
};

const articleView: View = async (request, params) => {
  const { year, month, slug } = params;
  // params = { year: "2024", month: "01", slug: "hello-world" }
  return Response.json({ year, month, slug });
};

export const urlpatterns = [
  path("users/:id/", userDetailView, { name: "user-detail" }),
  path("articles/:year/:month/:slug/", articleView, { name: "article-detail" }),
];
\`\`\`

## Including Other URL Patterns

### include()

Nest URL patterns from other modules:

\`\`\`typescript
import { include, path } from "@alexi/urls";

// Import URL patterns from other apps
import { urlpatterns as taskUrls } from "@myapp-web/tasks/urls.ts";
import { urlpatterns as userUrls } from "@myapp-web/users/urls.ts";

export const urlpatterns = [
  path("api/tasks/", include(taskUrls)),
  path("api/users/", include(userUrls)),
];
\`\`\`

### Inline Includes

Define nested patterns inline:

\`\`\`typescript
import { include, path } from "@alexi/urls";

export const urlpatterns = [
  path("api/v1/", include([
    path("health/", healthView, { name: "v1-health" }),
    path("tasks/", include(taskRouter.urls)),
    path("users/", include(userRouter.urls)),
  ])),
  
  path("api/v2/", include([
    path("health/", healthViewV2, { name: "v2-health" }),
    // ... v2 routes
  ])),
];
\`\`\`

## Integrating REST Framework Router

\`\`\`typescript
import { include, path } from "@alexi/urls";
import { Router } from "@alexi/restframework";
import { TaskViewSet, UserViewSet } from "./viewsets.ts";

// Create and configure router
const router = new Router();
router.register("tasks", TaskViewSet);
router.register("users", UserViewSet);

export const urlpatterns = [
  // Include all router-generated URLs under /api/
  path("api/", include(router.urls)),
  
  // Additional non-router routes
  path("health/", healthView),
];
\`\`\`

## Complete App URL Structure

### Root urls.ts

\`\`\`typescript
// project/myapp-web/urls.ts
import { include, path } from "@alexi/urls";
import { Router } from "@alexi/restframework";
import { loginRequired } from "@alexi/auth";
import { TaskViewSet, UserViewSet } from "./viewsets.ts";
import { healthView, profileView } from "./views.ts";

const router = new Router();
router.register("tasks", TaskViewSet);
router.register("users", UserViewSet);

export const urlpatterns = [
  // Public endpoints
  path("health/", healthView, { name: "health" }),
  
  // REST API (ViewSet-based)
  path("api/", include(router.urls)),
  
  // Protected function-based views
  path("api/profile/", loginRequired(profileView), { name: "profile" }),
];
\`\`\`

### Settings Configuration

\`\`\`typescript
// project/web.settings.ts
export const ROOT_URLCONF = () => import("@myapp-web/urls");
\`\`\`

## URL Pattern Matching

Patterns are matched in order - first match wins:

\`\`\`typescript
export const urlpatterns = [
  // More specific patterns first
  path("users/me/", currentUserView),      // Matches /users/me/
  path("users/:id/", userDetailView),       // Matches /users/123/
  path("users/", userListView),             // Matches /users/
];
\`\`\`

## Named Routes

Use the \`name\` option for reverse URL lookups:

\`\`\`typescript
import { path, reverse } from "@alexi/urls";

export const urlpatterns = [
  path("users/:id/", userDetailView, { name: "user-detail" }),
];

// Get URL by name
const url = reverse("user-detail", { id: "42" });
// Returns: "/users/42/"
\`\`\`

## Trailing Slashes

Alexi follows Django convention - URLs should end with trailing slashes:

\`\`\`typescript
// ✅ Correct - trailing slash
path("users/", userListView)
path("users/:id/", userDetailView)

// ❌ Avoid - no trailing slash
path("users", userListView)
path("users/:id", userDetailView)
\`\`\`

## Common Mistakes

**Forgetting to export urlpatterns**

\`\`\`typescript
// ❌ Wrong - not exported
const urlpatterns = [
  path("health/", healthView),
];

// ✅ Correct - exported
export const urlpatterns = [
  path("health/", healthView),
];
\`\`\`

**Wrong parameter syntax**

\`\`\`typescript
// ❌ Wrong - Django/regex style
path("users/<int:id>/", userView)
path("users/(?P<id>\\\\d+)/", userView)

// ✅ Correct - use :paramName
path("users/:id/", userView)
\`\`\`

**Not using include() for nested patterns**

\`\`\`typescript
// ❌ Wrong - directly spreading patterns
export const urlpatterns = [
  path("api/", ...taskUrls),  // Syntax error
];

// ✅ Correct - use include()
export const urlpatterns = [
  path("api/", include(taskUrls)),
];
\`\`\`

**Incorrect import for ROOT_URLCONF**

\`\`\`typescript
// ❌ Wrong - string path (old Django style)
export const ROOT_URLCONF = "myapp.urls";

// ✅ Correct - import function
export const ROOT_URLCONF = () => import("@myapp-web/urls");
\`\`\`

## Import Reference

\`\`\`typescript
import { include, path, reverse } from "@alexi/urls";
import type { URLPattern, View } from "@alexi/urls";
\`\`\`
`;
}
