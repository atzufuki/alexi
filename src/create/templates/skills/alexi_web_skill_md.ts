/**
 * Template for alexi-web SKILL.md
 *
 * Generates the Agent Skills file for @alexi/web web server.
 */

export function generateAlexiWebSkillMd(): string {
  return `---
name: alexi-web
description: Use when working with @alexi/web - configuring the web server, running the development server, and setting up HTTP request handling in Alexi.
license: MIT
metadata:
  author: atzufuki
  version: "1.0"
  package: "@alexi/web"
---

# Alexi Web

## Overview

\`@alexi/web\` provides the HTTP web server for Alexi applications. It handles
incoming HTTP requests, routes them through middleware, and dispatches to views.
Similar to Django's WSGI/ASGI handlers.

## When to Use This Skill

- Configuring web server settings
- Running the development server
- Setting up host and port configuration
- Understanding request/response flow
- Deploying Alexi applications

## Installation

\`\`\`bash
deno add jsr:@alexi/web
\`\`\`

## Running the Server

### Development Server

\`\`\`bash
# Using deno task (recommended)
deno task dev

# Direct command
deno run -A --unstable-kv manage.ts runserver --settings web

# With custom host/port
deno run -A --unstable-kv manage.ts runserver --host 0.0.0.0 --port 3000
\`\`\`

### Server Options

\`\`\`bash
deno run -A --unstable-kv manage.ts runserver --help

Options:
  --host      Host to bind to (default: from settings or 127.0.0.1)
  --port      Port to bind to (default: from settings or 8000)
  --settings  Settings module to use (web, ui, desktop)
\`\`\`

## Web Settings

### Basic Configuration

\`\`\`typescript
// project/web.settings.ts
export const DEBUG = Deno.env.get("DEBUG") === "true";
export const SECRET_KEY = Deno.env.get("SECRET_KEY") ?? "dev-secret-change-me";

// Server configuration
export const DEFAULT_HOST = "0.0.0.0";
export const DEFAULT_PORT = 8000;

// Installed apps
export const INSTALLED_APPS = [
  () => import("@alexi/staticfiles"),
  () => import("@alexi/web"),
  () => import("@alexi/db"),
  () => import("@alexi/auth"),
  () => import("@alexi/admin"),
  () => import("@myapp-web"),
];

// URL configuration
export const ROOT_URLCONF = () => import("@myapp-web/urls");

// Database
export const DATABASE = {
  engine: "denokv" as const,
  name: "myapp",
  path: "./data/myapp.db",
};

// Middleware
export const MIDDLEWARE = [
  "corsMiddleware",
  "loggingMiddleware",
  "errorHandlerMiddleware",
];
\`\`\`

### CORS Configuration

\`\`\`typescript
// project/web.settings.ts
export const CORS_ALLOWED_ORIGINS = [
  "http://localhost:5173",  // UI dev server
  "http://localhost:3000",
];

export const CORS_ALLOW_CREDENTIALS = true;

export const CORS_ALLOWED_METHODS = [
  "GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"
];

export const CORS_ALLOWED_HEADERS = [
  "Content-Type",
  "Authorization",
];
\`\`\`

## Request/Response Flow

\`\`\`
Request
   │
   ▼
┌─────────────────┐
│   Web Server    │  (Deno.serve)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Middleware    │  (CORS, Logging, Auth, ErrorHandler)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   URL Router    │  (ROOT_URLCONF → urls.ts)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  View/ViewSet   │  (Request handler)
└────────┬────────┘
         │
         ▼
      Response
\`\`\`

## Application Handler

The Application class handles requests:

\`\`\`typescript
import { Application } from "@alexi/core";

// Typically handled by runserver command
const app = new Application();
await app.setup("web");  // Load web.settings.ts

// Handle request
const response = await app.handle(request);
\`\`\`

## manage.ts Entry Point

\`\`\`typescript
#!/usr/bin/env -S deno run -A --unstable-kv
import { ManagementUtility } from "@alexi/core";

const utility = new ManagementUtility(Deno.args);
await utility.execute();
\`\`\`

## Production Deployment

### Deno Deploy

\`\`\`typescript
// main.ts - for Deno Deploy
import { Application } from "@alexi/core";

const app = new Application();
await app.setup("web");

Deno.serve({ port: 8000 }, (request) => app.handle(request));
\`\`\`

### Docker

\`\`\`dockerfile
FROM denoland/deno:1.40.0

WORKDIR /app
COPY . .

RUN deno cache manage.ts

EXPOSE 8000

CMD ["deno", "run", "-A", "--unstable-kv", "manage.ts", "runserver", "--host", "0.0.0.0", "--port", "8000", "--settings", "web"]
\`\`\`

### Environment Variables

\`\`\`bash
# .env
DEBUG=false
SECRET_KEY=your-production-secret-key
DATABASE_PATH=/data/myapp.db
\`\`\`

\`\`\`typescript
// project/web.settings.ts
export const DEBUG = Deno.env.get("DEBUG") === "true";
export const SECRET_KEY = Deno.env.get("SECRET_KEY")!;

export const DATABASE = {
  engine: "denokv" as const,
  name: "myapp",
  path: Deno.env.get("DATABASE_PATH") ?? "./data/myapp.db",
};
\`\`\`

## Static Files in Production

\`\`\`typescript
// project/web.settings.ts
export const STATIC_URL = "/static/";
export const STATIC_ROOT = "./staticfiles";  // Collected static files

// In production, serve static files via CDN or reverse proxy
// For development, alexi/staticfiles serves them directly
\`\`\`

## Health Check Endpoint

\`\`\`typescript
// src/myapp-web/urls.ts
import { path } from "@alexi/urls";

const healthView = async () => {
  return Response.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
};

export const urlpatterns = [
  path("health/", healthView, { name: "health" }),
  // ... other routes
];
\`\`\`

## Common Mistakes

**Missing Deno flags**

\`\`\`bash
# ❌ Wrong - missing required flags
deno run manage.ts runserver

# ✅ Correct - include all flags
deno run -A --unstable-kv manage.ts runserver
\`\`\`

**Wrong settings module**

\`\`\`bash
# ❌ Wrong - using UI settings for web server
deno run -A --unstable-kv manage.ts runserver --settings ui

# ✅ Correct - use web settings
deno run -A --unstable-kv manage.ts runserver --settings web
\`\`\`

**Not binding to 0.0.0.0 in Docker**

\`\`\`typescript
// ❌ Wrong - only accessible from container
export const DEFAULT_HOST = "127.0.0.1";

// ✅ Correct - accessible from outside container
export const DEFAULT_HOST = "0.0.0.0";
\`\`\`

**Forgetting to include @alexi/web in INSTALLED_APPS**

\`\`\`typescript
// ❌ Wrong - missing @alexi/web
export const INSTALLED_APPS = [
  () => import("@alexi/db"),
  () => import("@myapp-web"),
];

// ✅ Correct - include @alexi/web
export const INSTALLED_APPS = [
  () => import("@alexi/web"),
  () => import("@alexi/db"),
  () => import("@myapp-web"),
];
\`\`\`

## Import Reference

\`\`\`typescript
// Web server is typically used via manage.ts commands
// Direct imports are rarely needed

// For custom server setup
import { Application } from "@alexi/core";
\`\`\`
`;
}
