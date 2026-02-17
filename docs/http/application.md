# HTTP Application

The `Application` class is the core HTTP handler that combines URL routing with
middleware to create a web server.

## Overview

`Application` provides:

- URL routing via `@alexi/urls` patterns
- Middleware pipeline for request/response processing
- Error handling with debug mode
- Compatible with `Deno.serve()`

```typescript
import { Application } from "@alexi/http";
import { urlpatterns } from "./urls.ts";

const app = new Application({
  urls: urlpatterns,
});

Deno.serve({ port: 8000 }, app.handler);
```

## Configuration

### ApplicationOptions

| Option       | Type           | Default | Description                         |
| ------------ | -------------- | ------- | ----------------------------------- |
| `urls`       | `URLPattern[]` | —       | URL patterns for routing (required) |
| `middleware` | `Middleware[]` | `[]`    | Middleware stack                    |
| `debug`      | `boolean`      | `false` | Enable debug mode (detailed errors) |

### Basic Setup

```typescript
import { Application } from "@alexi/http";
import { path } from "@alexi/urls";

const urlpatterns = [
  path("api/health/", async () => Response.json({ status: "ok" })),
];

const app = new Application({
  urls: urlpatterns,
});

Deno.serve({ port: 8000 }, app.handler);
```

### With Middleware

```typescript
import { Application, corsMiddleware, loggingMiddleware } from "@alexi/http";
import { urlpatterns } from "./urls.ts";

const app = new Application({
  urls: urlpatterns,
  middleware: [
    loggingMiddleware,
    corsMiddleware({ origins: ["http://localhost:5173"] }),
  ],
  debug: true,
});

Deno.serve({ port: 8000 }, app.handler);
```

### Using app.serve()

Alternative to `Deno.serve()`:

```typescript
const app = new Application({
  urls: urlpatterns,
  middleware: [loggingMiddleware],
});

await app.serve({
  port: 8000,
  hostname: "0.0.0.0",
  onListen: ({ hostname, port }) => {
    console.log(`Server running at http://${hostname}:${port}`);
  },
});
```

## Middleware

Middleware functions intercept requests and responses, allowing you to:

- Log requests
- Add CORS headers
- Authenticate users
- Handle errors
- Modify requests/responses

### Middleware Signature

```typescript
type Middleware = (
  request: Request,
  next: NextFunction,
) => Promise<Response>;

type NextFunction = () => Promise<Response>;
```

### Middleware Order

Middleware executes in the order specified:

```typescript
const app = new Application({
  urls: urlpatterns,
  middleware: [
    loggingMiddleware, // 1. First: logs request
    corsMiddleware(), // 2. Second: adds CORS headers
    authMiddleware, // 3. Third: checks authentication
  ],
});

// Request flow:
// loggingMiddleware → corsMiddleware → authMiddleware → view
//
// Response flow:
// view → authMiddleware → corsMiddleware → loggingMiddleware
```

### Built-in Middleware

#### Logging Middleware

```typescript
import { loggingMiddleware, simpleLoggingMiddleware } from "@alexi/http";

// Detailed logging
const app = new Application({
  middleware: [loggingMiddleware],
});
// Output: → GET /api/todos/
//         ← 200 OK (15ms)

// Simple logging
const app = new Application({
  middleware: [simpleLoggingMiddleware],
});
// Output: GET /api/todos/ 200 15ms
```

#### CORS Middleware

```typescript
import { allowAllOriginsMiddleware, corsMiddleware } from "@alexi/http";

// Allow all origins (development)
const app = new Application({
  middleware: [allowAllOriginsMiddleware],
});

// Specific origins (production)
const app = new Application({
  middleware: [
    corsMiddleware({
      origins: ["https://myapp.com", "https://admin.myapp.com"],
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE"],
      allowedHeaders: ["Content-Type", "Authorization"],
      maxAge: 86400, // 24 hours
    }),
  ],
});

// Dynamic origin validation
const app = new Application({
  middleware: [
    corsMiddleware({
      origins: (origin) => origin.endsWith(".myapp.com"),
      credentials: true,
    }),
  ],
});
```

##### CORS Options

| Option           | Type                             | Default                                                 | Description                        |
| ---------------- | -------------------------------- | ------------------------------------------------------- | ---------------------------------- |
| `origins`        | `string \| string[] \| function` | `"*"`                                                   | Allowed origins                    |
| `methods`        | `string[]`                       | `["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]`  | Allowed methods                    |
| `allowedHeaders` | `string[]`                       | `["Content-Type", "Authorization", "X-Requested-With"]` | Allowed headers                    |
| `exposedHeaders` | `string[]`                       | `[]`                                                    | Headers exposed to browser         |
| `credentials`    | `boolean`                        | `false`                                                 | Allow credentials                  |
| `maxAge`         | `number`                         | `86400`                                                 | Preflight cache duration (seconds) |

#### Error Handler Middleware

```typescript
import {
  debugErrorHandler,
  errorHandlerMiddleware,
  simpleErrorHandler,
} from "@alexi/http";

// Debug mode (detailed errors)
const app = new Application({
  middleware: [errorHandlerMiddleware({ debug: true })],
});

// Production mode (generic errors)
const app = new Application({
  middleware: [errorHandlerMiddleware({ debug: false })],
});

// Or use preset handlers
const app = new Application({
  middleware: [debugErrorHandler], // Detailed errors
});

const app = new Application({
  middleware: [simpleErrorHandler], // Generic errors
});
```

### Custom Middleware

#### Logging Example

```typescript
import type { Middleware } from "@alexi/http";

const myLoggingMiddleware: Middleware = async (request, next) => {
  const start = Date.now();
  console.log(`→ ${request.method} ${request.url}`);

  const response = await next();

  const duration = Date.now() - start;
  console.log(`← ${response.status} (${duration}ms)`);

  return response;
};
```

#### Authentication Example

```typescript
import type { Middleware } from "@alexi/http";
import { UnauthorizedError } from "@alexi/http";

const authMiddleware: Middleware = async (request, next) => {
  // Skip auth for public routes
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/public/")) {
    return next();
  }

  // Check authorization header
  const token = request.headers.get("Authorization");
  if (!token) {
    throw new UnauthorizedError("Missing authorization token");
  }

  // Validate token
  const user = await validateToken(token);
  if (!user) {
    throw new UnauthorizedError("Invalid token");
  }

  // Continue to next middleware/view
  return next();
};
```

#### Response Modification Example

```typescript
const addHeadersMiddleware: Middleware = async (request, next) => {
  const response = await next();

  // Clone response with new headers
  const headers = new Headers(response.headers);
  headers.set("X-Custom-Header", "value");
  headers.set("X-Request-Id", crypto.randomUUID());

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};
```

#### Request Timing Example

```typescript
const timingMiddleware: Middleware = async (request, next) => {
  const start = performance.now();

  const response = await next();

  const duration = performance.now() - start;

  const headers = new Headers(response.headers);
  headers.set("Server-Timing", `total;dur=${duration.toFixed(2)}`);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};
```

## Error Handling

### HTTP Errors

Use built-in error classes for proper status codes:

```typescript
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  HttpError,
  InternalServerError,
  MethodNotAllowedError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "@alexi/http";

async function getArticle(request: Request, params: Record<string, string>) {
  const article = await ArticleModel.objects.get({ id: params.id });

  if (!article) {
    throw new NotFoundError("Article not found");
  }

  if (!canAccess(article)) {
    throw new ForbiddenError("You don't have access to this article");
  }

  return Response.json(article);
}
```

### Error Classes

| Class                   | Status | Description             |
| ----------------------- | ------ | ----------------------- |
| `BadRequestError`       | 400    | Invalid request         |
| `UnauthorizedError`     | 401    | Authentication required |
| `ForbiddenError`        | 403    | Access denied           |
| `NotFoundError`         | 404    | Resource not found      |
| `MethodNotAllowedError` | 405    | HTTP method not allowed |
| `ConflictError`         | 409    | Resource conflict       |
| `ValidationError`       | 422    | Validation failed       |
| `InternalServerError`   | 500    | Server error            |

### Debug Mode

With `debug: true`, error responses include stack traces:

```typescript
const app = new Application({
  urls: urlpatterns,
  debug: true, // Include stack traces
});

// Error response in debug mode:
// {
//   "error": "Article not found",
//   "stack": "NotFoundError: Article not found\n    at getArticle..."
// }

// Error response in production:
// {
//   "error": "Article not found"
// }
```

## Static Files

Serve static files using middleware:

```typescript
import { Application, staticFilesMiddleware } from "@alexi/http";

const app = new Application({
  urls: urlpatterns,
  middleware: [
    staticFilesMiddleware({
      root: "./static",
      prefix: "/static/",
    }),
  ],
});

// GET /static/css/style.css → ./static/css/style.css
```

## Full Example

```typescript
import { Application, corsMiddleware, loggingMiddleware } from "@alexi/http";
import { include, path } from "@alexi/urls";
import { DefaultRouter } from "@alexi/restframework";
import { ArticleViewSet, UserViewSet } from "./viewsets.ts";

// Create router for ViewSets
const router = new DefaultRouter();
router.register("articles", ArticleViewSet);
router.register("users", UserViewSet);

// Custom view
async function healthCheck(): Promise<Response> {
  return Response.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}

// URL patterns
const apiPatterns = [
  path("health/", healthCheck),
  ...router.urls,
];

const urlpatterns = [
  path("api/", include(apiPatterns)),
];

// Create application
const app = new Application({
  urls: urlpatterns,
  middleware: [
    loggingMiddleware,
    corsMiddleware({
      origins: ["http://localhost:5173"],
      credentials: true,
    }),
  ],
  debug: Deno.env.get("DEBUG") === "true",
});

// Start server
const port = parseInt(Deno.env.get("PORT") ?? "8000");

Deno.serve({ port }, app.handler);

console.log(`Server running at http://localhost:${port}`);
```

## Best Practices

1. **Order middleware correctly** — Logging first, then CORS, then auth

2. **Use debug mode in development** — Set `debug: true` for detailed errors

3. **Configure CORS specifically** — Don't use `allowAllOriginsMiddleware` in
   production

4. **Handle errors with HttpError classes** — Use appropriate status codes

5. **Keep middleware focused** — Each middleware should do one thing

6. **Use environment variables** — Configure port, debug mode, CORS origins from
   env
