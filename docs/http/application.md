# HTTP Application

Alexi's HTTP application is built with `getHttpApplication()` from
`@alexi/core`. It reads your project settings, initialises installed apps, and
returns a standard `Deno.serve`-compatible handler.

## Production Entry Point

```typescript
// project/http.ts
import { getHttpApplication } from "@alexi/core";

export default await getHttpApplication();
```

Start the server with:

```bash
deno serve -A --unstable-kv project/http.ts
```

`deno serve` picks up the `export default` handler automatically.

## Development Server

During development use the `runserver` management command instead, which adds
auto-reload:

```bash
deno run -A --unstable-kv manage.ts runserver --settings ./project/settings.ts
```

## Settings

The application is configured through your settings module. See
[`project/settings.ts`](../create/scaffolding.md) for the full reference.

Key settings that affect the HTTP layer:

| Setting          | Description                                  |
| ---------------- | -------------------------------------------- |
| `DEFAULT_HOST`   | Bind address (default: `"0.0.0.0"`)          |
| `DEFAULT_PORT`   | Listen port (default: `8000`)                |
| `DEBUG`          | Enable debug error pages                     |
| `ROOT_URLCONF`   | Import function returning URL patterns       |
| `INSTALLED_APPS` | Named `AppConfig` objects to load on startup |
| `MIDDLEWARE`     | Ordered list of middleware instances         |

### ROOT_URLCONF

`ROOT_URLCONF` must be an import function so the project's import map is in
scope when it runs:

```typescript
export const ROOT_URLCONF = () => import("@my-project/urls.ts");
```

### INSTALLED_APPS

List named `AppConfig` exports directly — no factory functions:

```typescript
import { DbConfig } from "@alexi/db";
import { AuthConfig } from "@alexi/auth";
import { MyProjectConfig } from "@my-project/mod.ts";

export const INSTALLED_APPS = [
  DbConfig,
  AuthConfig,
  MyProjectConfig,
];
```

### MIDDLEWARE

Middleware instances are listed in outer-first order (same as Django):

```typescript
import { AuthConfig, AuthenticationMiddleware } from "@alexi/auth";
import {
  corsMiddleware,
  errorHandlerMiddleware,
  loggingMiddleware,
} from "@alexi/middleware";

export const MIDDLEWARE = [
  loggingMiddleware(),
  corsMiddleware({ origins: CORS_ORIGINS }),
  AuthenticationMiddleware.configure({ userModel: UserModel }),
  errorHandlerMiddleware(),
];
```

## Service Worker Application

For browser-based apps use `getWorkerApplication()`:

```typescript
// src/my-project/workers/my-project/worker.ts
import { getWorkerApplication } from "@alexi/core";
import * as settings from "./settings.ts";

self.addEventListener("install", (event) => {
  event.waitUntil(
    getWorkerApplication(settings).then((app) => {
      self.app = app;
      return self.skipWaiting();
    }),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/static/")) return;
  event.respondWith(self.app.handler(event.request));
});
```

## Desktop Application

For desktop apps use `getWebuiApplication()` from `@alexi/webui`:

```typescript
// project/desktop.ts
import { getWebuiApplication } from "@alexi/webui";

const app = await getWebuiApplication({
  url: "http://localhost:8000/",
  webui: { title: "MyApp", width: 1400, height: 900 },
});
await app.launch();
```

## Error Handling

Set `DEBUG = true` in settings to enable detailed error pages during
development:

```typescript
export const DEBUG = Deno.env.get("DEBUG") === "true";
```

With `DEBUG = true`, unhandled exceptions are rendered as JSON responses
including the stack trace. In production (`DEBUG = false`) a generic 500
response is returned instead.
