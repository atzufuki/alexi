/**
 * Template for alexi-staticfiles SKILL.md
 *
 * Generates the Agent Skills file for @alexi/staticfiles.
 */

export function generateAlexiStaticfilesSkillMd(): string {
  return `---
name: alexi-staticfiles
description: Use when working with @alexi/staticfiles - serving static files, bundling frontend code, collecting static assets, and configuring static file handling in Alexi.
license: MIT
metadata:
  author: atzufuki
  version: "1.0"
  package: "@alexi/staticfiles"
---

# Alexi Static Files

## Overview

\`@alexi/staticfiles\` handles static file serving and bundling for Alexi applications.
It provides middleware for serving static files in development and commands for
collecting/bundling assets for production. Similar to Django's staticfiles app.

## When to Use This Skill

- Serving CSS, JavaScript, and image files
- Bundling frontend TypeScript/JavaScript
- Collecting static files for production
- Configuring static file paths
- Setting up frontend asset pipeline

## Installation

\`\`\`bash
deno add jsr:@alexi/staticfiles
\`\`\`

## Configuration

### Settings

\`\`\`typescript
// project/web.settings.ts
export const INSTALLED_APPS = [
  () => import("@alexi/staticfiles"),  // Must be included
  () => import("@alexi/web"),
  // ...
];

// Static files URL prefix
export const STATIC_URL = "/static/";

// Where to collect static files for production
export const STATIC_ROOT = "./staticfiles";

// Additional static file directories
export const STATICFILES_DIRS = [
  "./public",
  "./assets",
];
\`\`\`

### UI Settings (Frontend)

\`\`\`typescript
// project/ui.settings.ts
export const STATIC_URL = "/";

// Entry point for bundling
export const BUNDLE_ENTRY = "@myapp-ui/main.ts";

// Output bundle path
export const BUNDLE_OUTPUT = "./src/myapp-ui/static/myapp-ui/bundle.js";
\`\`\`

## Serving Static Files

### Development

Static files are served automatically in development:

\`\`\`typescript
// Static files from each app's static/ directory are served
// src/myapp-web/static/myapp-web/styles.css → /static/myapp-web/styles.css
// src/myapp-ui/static/myapp-ui/bundle.js → /static/myapp-ui/bundle.js
\`\`\`

### Static File Middleware

\`\`\`typescript
import { staticFilesMiddleware } from "@alexi/staticfiles";

// In middleware configuration
const staticFiles = staticFilesMiddleware({
  root: "./static",
  prefix: "/static/",
  maxAge: 86400,  // Cache for 24 hours
});
\`\`\`

## App Static Directory Structure

\`\`\`
src/myapp-web/
├── static/
│   └── myapp-web/           # Namespaced by app name
│       ├── css/
│       │   └── styles.css
│       ├── js/
│       │   └── app.js
│       └── images/
│           └── logo.png
├── app.ts
└── mod.ts
\`\`\`

## Management Commands

### collectstatic

Collect all static files to STATIC_ROOT:

\`\`\`bash
deno run -A --unstable-kv manage.ts collectstatic

# Output:
# Collecting static files...
# Copied: myapp-web/css/styles.css
# Copied: myapp-web/js/app.js
# Copied: admin/css/admin.css
# ...
# Collected 42 static files to ./staticfiles
\`\`\`

### bundle

Bundle frontend TypeScript/JavaScript:

\`\`\`bash
# Bundle UI app
deno run -A --unstable-kv manage.ts bundle --settings ui

# Watch mode for development
deno run -A --unstable-kv manage.ts bundle --settings ui --watch
\`\`\`

## Bundling

### Bundle Configuration

\`\`\`typescript
// project/ui.settings.ts
export const BUNDLE_ENTRY = "@myapp-ui/main.ts";
export const BUNDLE_OUTPUT = "./src/myapp-ui/static/myapp-ui/bundle.js";

// Bundle options
export const BUNDLE_OPTIONS = {
  minify: Deno.env.get("DEBUG") !== "true",
  sourcemap: Deno.env.get("DEBUG") === "true",
  target: ["chrome99", "firefox99", "safari15"],
};
\`\`\`

### Entry Point

\`\`\`typescript
// src/myapp-ui/main.ts
import { setup } from "@alexi/core";
import { IndexedDBBackend } from "@alexi/db/backends/indexeddb";
import { Application } from "@alexi/core";

// Setup database
const backend = new IndexedDBBackend({ name: "myapp" });
await setup({ DATABASES: { default: backend } });

// Initialize app
const app = new Application();
await app.setup("ui");
await app.mount("#app");
\`\`\`

## Using Static Files in Templates

\`\`\`html
<!-- Reference static files with STATIC_URL prefix -->
<link rel="stylesheet" href="/static/myapp-web/css/styles.css">
<script src="/static/myapp-web/js/app.js"></script>
<img src="/static/myapp-web/images/logo.png" alt="Logo">

<!-- Or use the static template tag -->
<link rel="stylesheet" href="{% static 'myapp-web/css/styles.css' %}">
\`\`\`

## Production Setup

### 1. Collect Static Files

\`\`\`bash
deno run -A --unstable-kv manage.ts collectstatic
\`\`\`

### 2. Bundle Frontend

\`\`\`bash
DEBUG=false deno run -A --unstable-kv manage.ts bundle --settings ui
\`\`\`

### 3. Serve via CDN/Nginx

\`\`\`nginx
# nginx.conf
server {
    location /static/ {
        alias /app/staticfiles/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    location / {
        proxy_pass http://localhost:8000;
    }
}
\`\`\`

### 4. Update Settings

\`\`\`typescript
// project/web.settings.ts
export const STATIC_URL = Deno.env.get("CDN_URL") ?? "/static/";
\`\`\`

## File Type Handling

### MIME Types

Static files middleware automatically sets correct MIME types:

| Extension | MIME Type |
|-----------|-----------|
| .html | text/html |
| .css | text/css |
| .js | application/javascript |
| .json | application/json |
| .png | image/png |
| .jpg | image/jpeg |
| .svg | image/svg+xml |
| .woff2 | font/woff2 |

### Custom MIME Types

\`\`\`typescript
import { staticFilesMiddleware } from "@alexi/staticfiles";

const staticFiles = staticFilesMiddleware({
  root: "./static",
  mimeTypes: {
    ".webmanifest": "application/manifest+json",
    ".wasm": "application/wasm",
  },
});
\`\`\`

## Common Mistakes

**Wrong static directory structure**

\`\`\`
# ❌ Wrong - not namespaced
src/myapp-web/static/styles.css

# ✅ Correct - namespaced by app name
src/myapp-web/static/myapp-web/styles.css
\`\`\`

**Missing @alexi/staticfiles in INSTALLED_APPS**

\`\`\`typescript
// ❌ Wrong - static files won't be served
export const INSTALLED_APPS = [
  () => import("@alexi/web"),
  () => import("@myapp-web"),
];

// ✅ Correct
export const INSTALLED_APPS = [
  () => import("@alexi/staticfiles"),
  () => import("@alexi/web"),
  () => import("@myapp-web"),
];
\`\`\`

**Incorrect bundle entry path**

\`\`\`typescript
// ❌ Wrong - file path instead of import path
export const BUNDLE_ENTRY = "./src/myapp-ui/main.ts";

// ✅ Correct - import map alias
export const BUNDLE_ENTRY = "@myapp-ui/main.ts";
\`\`\`

## Import Reference

\`\`\`typescript
// Middleware
import { staticFilesMiddleware } from "@alexi/staticfiles";

// Typically used via management commands:
// - collectstatic
// - bundle
\`\`\`
`;
}
