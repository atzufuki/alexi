# Static Files

Alexi provides Django-style static file handling for serving CSS, JavaScript,
images, and other assets. The `@alexi/staticfiles` module includes finders,
storage backends, and middleware for both development and production.

## Overview

Static files in Alexi follow Django's conventions:

- **Finders** locate files in app directories or configured paths
- **Storage** handles reading and serving files
- **Middleware** intercepts requests and serves static content

In development, files are served directly from source directories. In
production, use `collectstatic` to gather all files into a single directory.

---

## Configuration

### Settings

Configure static files in your settings module:

```ts
// project/web.settings.ts

// URL prefix for static files
export const STATIC_URL = "/static/";

// Directory for collected static files (production)
export const STATIC_ROOT = "./staticfiles";

// Additional directories to search (optional)
export const STATICFILES_DIRS = [
  "./assets",
  "./vendor/static",
];

// Development mode
export const DEBUG = true;
```

### Directory Structure

Static files follow a namespaced convention to avoid conflicts:

```
src/
├── myapp/
│   └── static/
│       └── myapp/           # Namespace matches app name
│           ├── css/
│           │   └── styles.css
│           ├── js/
│           │   └── app.js
│           └── images/
│               └── logo.png
│
└── anotherapp/
    └── static/
        └── anotherapp/
            └── ...
```

Files are accessed via URL: `/static/myapp/css/styles.css`

---

## Finders

Finders locate static files in the filesystem. Alexi provides two built-in
finders:

### AppDirectoriesFinder

Searches for files in each app's `static/` directory:

```ts
import { AppDirectoriesFinder } from "@alexi/staticfiles";

const finder = new AppDirectoriesFinder({
  installedApps: ["myapp", "anotherapp"],
  appPaths: {
    myapp: "./src/myapp",
    anotherapp: "./src/anotherapp",
  },
  projectRoot: Deno.cwd(),
});

// Find: /static/myapp/css/styles.css
const result = await finder.find("myapp/css/styles.css");
// → { path: "/abs/path/src/myapp/static/myapp/css/styles.css", source: "myapp" }
```

### FileSystemFinder

Searches additional directories (like `STATICFILES_DIRS`):

```ts
import { FileSystemFinder } from "@alexi/staticfiles";

const finder = new FileSystemFinder({
  directories: ["./assets", "./vendor/static"],
  projectRoot: Deno.cwd(),
});

const result = await finder.find("vendor/jquery.js");
// → { path: "/abs/path/vendor/static/vendor/jquery.js", source: "./vendor/static" }
```

### StaticFileFinders (Combined)

Searches multiple finders in order:

```ts
import { StaticFileFinders } from "@alexi/staticfiles";

const finders = StaticFileFinders.fromSettings({
  installedApps: settings.INSTALLED_APPS,
  appPaths: settings.APP_PATHS,
  staticFilesDirs: settings.STATICFILES_DIRS,
  projectRoot: Deno.cwd(),
});

// Searches STATICFILES_DIRS first, then app directories
const result = await finders.find("myapp/bundle.js");
```

---

## Storage

Storage backends handle reading files and generating URLs.

### FileSystemStorage

Reads files from a base directory:

```ts
import { FileSystemStorage } from "@alexi/staticfiles";

const storage = new FileSystemStorage({
  baseDir: "./staticfiles",
  urlPrefix: "/static/",
});

// Read a file
const file = await storage.read("myapp/css/styles.css");
if (file) {
  console.log(file.contentType); // "text/css; charset=utf-8"
  console.log(file.size); // 1234
  console.log(file.content); // Uint8Array
}

// Check if file exists
const exists = await storage.exists("myapp/logo.png");

// Get URL for a file
const url = storage.url("myapp/logo.png");
// → "/static/myapp/logo.png"
```

### StaticFilesStorage

Main storage class with development/production modes:

```ts
import { StaticFilesStorage } from "@alexi/staticfiles";

// Production mode (reads from STATIC_ROOT)
const storage = StaticFilesStorage.forProduction({
  staticRoot: "./staticfiles",
  staticUrl: "/static/",
});

const file = await storage.read("myapp/bundle.js");
```

---

## Middleware

### staticFilesMiddleware

Intercepts requests to `STATIC_URL` and serves files:

```ts
import { Application } from "@alexi/core";
import { staticFilesMiddleware } from "@alexi/staticfiles";

const app = new Application({
  urls: urlpatterns,
  middleware: [
    staticFilesMiddleware({
      installedApps: settings.INSTALLED_APPS,
      appPaths: settings.APP_PATHS,
      staticUrl: settings.STATIC_URL,
      debug: settings.DEBUG,
    }),
  ],
});
```

Options:

| Option             | Type                     | Default                   | Description               |
| ------------------ | ------------------------ | ------------------------- | ------------------------- |
| `installedApps`    | `string[]`               | (required)                | List of installed apps    |
| `appPaths`         | `Record<string, string>` | (required)                | Map of app names to paths |
| `staticFilesDirs`  | `string[]`               | `[]`                      | Additional directories    |
| `staticUrl`        | `string`                 | `"/static/"`              | URL prefix                |
| `staticRoot`       | `string`                 | -                         | Production static root    |
| `debug`            | `boolean`                | `false`                   | Development mode          |
| `devCacheControl`  | `string`                 | `"no-cache"`              | Cache header (dev)        |
| `prodCacheControl` | `string`                 | `"public, max-age=86400"` | Cache header (prod)       |

### serveBundleMiddleware

Serves bundle files from root URL (for development):

```ts
import { serveBundleMiddleware } from "@alexi/staticfiles";

const bundleMiddleware = serveBundleMiddleware({
  installedApps: settings.INSTALLED_APPS,
  appPaths: settings.APP_PATHS,
  bundleFiles: ["bundle.js", "bundle.css", "chunks/"],
  debug: true,
});
```

This allows accessing `/bundle.js` instead of `/static/myapp/bundle.js`.

### staticServe

Create a view function for URL patterns:

```ts
import { path } from "@alexi/urls";
import { staticServe } from "@alexi/staticfiles";

const serveStatic = staticServe({
  installedApps: settings.INSTALLED_APPS,
  appPaths: settings.APP_PATHS,
  debug: settings.DEBUG,
});

export const urlpatterns = [
  path("static/<path:path>", serveStatic),
];
```

---

## Management Commands

### collectstatic

Collect all static files into `STATIC_ROOT` for production:

```bash
deno run -A manage.ts collectstatic

# Skip confirmation
deno run -A manage.ts collectstatic --no-input

# Clear existing files first
deno run -A manage.ts collectstatic --clear
```

Output:

```
Collecting static files...
  myapp/css/styles.css → staticfiles/myapp/css/styles.css
  myapp/js/app.js → staticfiles/myapp/js/app.js
  anotherapp/bundle.js → staticfiles/anotherapp/bundle.js

Copied 15 static files to ./staticfiles/
```

### bundle

Bundle frontend assets for production:

```bash
# Bundle default app
deno run -A manage.ts bundle

# Bundle specific app
deno run -A manage.ts bundle --app myapp-ui

# Watch mode
deno run -A manage.ts bundle --watch
```

---

## Content Types

Alexi automatically detects content types from file extensions:

| Extension       | Content-Type                      |
| --------------- | --------------------------------- |
| `.html`         | `text/html; charset=utf-8`        |
| `.css`          | `text/css; charset=utf-8`         |
| `.js`, `.mjs`   | `text/javascript; charset=utf-8`  |
| `.json`         | `application/json; charset=utf-8` |
| `.svg`          | `image/svg+xml`                   |
| `.png`          | `image/png`                       |
| `.jpg`, `.jpeg` | `image/jpeg`                      |
| `.gif`          | `image/gif`                       |
| `.webp`         | `image/webp`                      |
| `.woff`         | `font/woff`                       |
| `.woff2`        | `font/woff2`                      |
| `.pdf`          | `application/pdf`                 |
| `.wasm`         | `application/wasm`                |

Get content type programmatically:

```ts
import { getContentType } from "@alexi/staticfiles";

const type = getContentType("styles.css");
// → "text/css; charset=utf-8"
```

---

## Caching

### Development

In development mode (`DEBUG=true`), files are served with:

- `Cache-Control: no-cache`
- ETag headers for conditional requests

This ensures you always see the latest changes.

### Production

In production, files are served with appropriate cache headers:

- **Immutable files** (with content hashes):
  `public, max-age=31536000, immutable`
- **Other files**: `public, max-age=86400`

Configure custom cache headers:

```ts
staticFilesMiddleware({
  debug: false,
  prodCacheControl: "public, max-age=604800", // 1 week
  prodImmutableCacheControl: "public, max-age=31536000, immutable", // 1 year
});
```

---

## Utility Functions

### isStaticFileRequest

Check if a request is for a static file:

```ts
import { isStaticFileRequest } from "@alexi/staticfiles";

if (isStaticFileRequest(request.pathname, "/static/")) {
  // Handle static file
}
```

### extractStaticPath

Extract the file path from a static URL:

```ts
import { extractStaticPath } from "@alexi/staticfiles";

const path = extractStaticPath("/static/myapp/logo.png", "/static/");
// → "myapp/logo.png"
```

---

## Best Practices

### 1. Use Namespaced Directories

Always namespace static files by app name:

```
✅ src/myapp/static/myapp/styles.css
❌ src/myapp/static/styles.css
```

### 2. Use collectstatic for Production

Never serve files directly from source in production:

```bash
# Build step
deno run -A manage.ts collectstatic --no-input

# Serve from STATIC_ROOT or CDN
```

### 3. Use Content Hashes

Include content hashes in filenames for cache busting:

```
bundle.a1b2c3d4.js
styles.e5f6g7h8.css
```

### 4. Separate Static and Media Files

- **Static files**: CSS, JS, images bundled with your app
- **Media files**: User-uploaded content (use separate storage)

### 5. Configure CORS for CDN

When serving from a CDN, ensure CORS headers are set:

```ts
corsMiddleware({
  origins: ["https://cdn.example.com"],
});
```

---

## API Reference

### Finders

```ts
interface StaticFileFinder {
  find(path: string): Promise<FinderResult | null>;
  list(): AsyncGenerator<[urlPath: string, absPath: string, source: string]>;
}

interface FinderResult {
  path: string;    // Absolute file path
  source: string;  // App or directory name
}

class AppDirectoriesFinder implements StaticFileFinder { ... }
class FileSystemFinder implements StaticFileFinder { ... }
class StaticFileFinders implements StaticFileFinder { ... }
```

### Storage

```ts
interface StaticFile {
  content: Uint8Array;
  contentType: string;
  size: number;
  lastModified?: Date;
  etag?: string;
}

interface StaticFileStorage {
  read(path: string): Promise<StaticFile | null>;
  exists(path: string): Promise<boolean>;
  url(path: string): string;
}

class FileSystemStorage implements StaticFileStorage { ... }
class StaticFilesStorage { ... }
```

### Middleware

```ts
function staticFilesMiddleware(options: StaticServeOptions): Middleware;
function serveBundleMiddleware(options: BundleServeOptions): Middleware;
function staticServe(options: StaticServeOptions): View;
```

### Utilities

```ts
function getContentType(path: string): string;
function isStaticFileRequest(pathname: string, staticUrl?: string): boolean;
function extractStaticPath(pathname: string, staticUrl?: string): string | null;
```
