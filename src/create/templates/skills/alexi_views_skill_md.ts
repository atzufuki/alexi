/**
 * Template for alexi-views SKILL.md
 *
 * Generates the Agent Skills file for @alexi/views template views.
 */

export function generateAlexiViewsSkillMd(): string {
  return `---
name: alexi-views
description: Use when working with @alexi/views - creating template views, rendering HTML responses, and implementing Django-style class-based views in Deno.
license: MIT
metadata:
  author: atzufuki
  version: "1.0"
  package: "@alexi/views"
---

# Alexi Views

## Overview

\`@alexi/views\` provides template-based views for Alexi applications. It supports
rendering HTML templates with context data, similar to Django's template views.

## When to Use This Skill

- Rendering HTML templates
- Creating template views with context
- Serving HTML pages (not JSON APIs)
- Building traditional server-rendered pages

## Installation

\`\`\`bash
deno add jsr:@alexi/views
\`\`\`

## Template Views

### Basic Template View

\`\`\`typescript
import { templateView } from "@alexi/views";
import { path } from "@alexi/urls";

// Simple template view
const homeView = templateView("home.html");

// With static context
const aboutView = templateView("about.html", {
  title: "About Us",
  companyName: "Acme Inc",
});

export const urlpatterns = [
  path("", homeView, { name: "home" }),
  path("about/", aboutView, { name: "about" }),
];
\`\`\`

### Dynamic Context

\`\`\`typescript
import { templateView } from "@alexi/views";
import { TaskModel } from "./models.ts";

// Context function receives request
const taskListView = templateView("tasks/list.html", async (request) => {
  const tasks = await TaskModel.objects.all().fetch();
  
  return {
    title: "My Tasks",
    tasks: tasks.array(),
    count: tasks.length,
  };
});

const taskDetailView = templateView("tasks/detail.html", async (request, params) => {
  const task = await TaskModel.objects.get({ id: parseInt(params.id) });
  
  return {
    title: task.title.get(),
    task,
  };
});

export const urlpatterns = [
  path("tasks/", taskListView),
  path("tasks/:id/", taskDetailView),
];
\`\`\`

## Function-Based Views

### Returning HTML

\`\`\`typescript
import { path } from "@alexi/urls";

const customView = async (request: Request, params: Record<string, string>) => {
  const html = \`
    <!DOCTYPE html>
    <html>
      <head><title>Custom Page</title></head>
      <body>
        <h1>Hello, World!</h1>
      </body>
    </html>
  \`;
  
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
};

export const urlpatterns = [
  path("custom/", customView),
];
\`\`\`

### Using Template Engine

\`\`\`typescript
import { render } from "@alexi/views";

const myView = async (request: Request, params: Record<string, string>) => {
  const context = {
    user: await getCurrentUser(request),
    notifications: await getNotifications(),
  };
  
  const html = await render("dashboard.html", context);
  
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
};
\`\`\`

## Template Syntax

Alexi uses a simple template syntax:

\`\`\`html
<!-- templates/tasks/list.html -->
<!DOCTYPE html>
<html>
<head>
  <title>{{ title }}</title>
</head>
<body>
  <h1>{{ title }}</h1>
  
  <p>Total tasks: {{ count }}</p>
  
  <ul>
    {% for task in tasks %}
      <li>
        <a href="/tasks/{{ task.id }}/">{{ task.title }}</a>
        - {{ task.status }}
      </li>
    {% endfor %}
  </ul>
  
  {% if count == 0 %}
    <p>No tasks found.</p>
  {% endif %}
</body>
</html>
\`\`\`

### Template Tags

| Tag | Description |
|-----|-------------|
| \`{{ var }}\` | Output variable |
| \`{% if cond %}\` | Conditional |
| \`{% for item in list %}\` | Loop |
| \`{% include "partial.html" %}\` | Include template |
| \`{% block name %}\` | Define block |
| \`{% extends "base.html" %}\` | Template inheritance |

## Template Inheritance

### Base Template

\`\`\`html
<!-- templates/base.html -->
<!DOCTYPE html>
<html>
<head>
  <title>{% block title %}My App{% endblock %}</title>
  {% block head %}{% endblock %}
</head>
<body>
  <nav>
    {% include "partials/nav.html" %}
  </nav>
  
  <main>
    {% block content %}{% endblock %}
  </main>
  
  <footer>
    {% include "partials/footer.html" %}
  </footer>
</body>
</html>
\`\`\`

### Child Template

\`\`\`html
<!-- templates/tasks/list.html -->
{% extends "base.html" %}

{% block title %}Tasks - My App{% endblock %}

{% block content %}
  <h1>Tasks</h1>
  <ul>
    {% for task in tasks %}
      <li>{{ task.title }}</li>
    {% endfor %}
  </ul>
{% endblock %}
\`\`\`

## Redirects

\`\`\`typescript
import { redirect } from "@alexi/views";

const loginRequiredView = async (request: Request) => {
  const user = await getCurrentUser(request);
  
  if (!user) {
    return redirect("/login/");
  }
  
  return templateView("dashboard.html", { user })(request, {});
};

// Redirect with status code
const oldPageView = async () => {
  return redirect("/new-page/", 301);  // Permanent redirect
};
\`\`\`

## JSON Responses

For API endpoints, return JSON directly:

\`\`\`typescript
const apiView = async (request: Request, params: Record<string, string>) => {
  const data = await TaskModel.objects.all().fetch();
  
  return Response.json({
    tasks: data.array(),
    count: data.length,
  });
};
\`\`\`

## Common Mistakes

**Forgetting Content-Type header**

\`\`\`typescript
// ❌ Wrong - no Content-Type, browser may not render
return new Response("<h1>Hello</h1>");

// ✅ Correct - proper Content-Type
return new Response("<h1>Hello</h1>", {
  headers: { "Content-Type": "text/html; charset=utf-8" },
});

// ✅ Or use templateView which handles this
const view = templateView("page.html");
\`\`\`

**Not awaiting async context**

\`\`\`typescript
// ❌ Wrong - Promise passed to template
const view = templateView("page.html", {
  tasks: TaskModel.objects.all().fetch(),  // Missing await!
});

// ✅ Correct - use context function
const view = templateView("page.html", async (request) => ({
  tasks: await TaskModel.objects.all().fetch(),
}));
\`\`\`

**Using wrong template path**

\`\`\`typescript
// ❌ Wrong - absolute path
const view = templateView("/templates/home.html");

// ✅ Correct - relative to templates directory
const view = templateView("home.html");
\`\`\`

## Import Reference

\`\`\`typescript
// Template views
import { redirect, render, templateView } from "@alexi/views";

// Types
import type { TemplateContext, View } from "@alexi/views";
\`\`\`
`;
}
