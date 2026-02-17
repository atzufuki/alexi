# Middleware

Alexi provides a Django-inspired middleware system that allows you to process
requests and responses globally. Middleware can intercept requests before they
reach your views and modify responses before they're sent to the client.

## Overview

Middleware in Alexi follows a simple pattern: each middleware receives a
`Request` and a `next()` function. The middleware can:

1. **Modify the request** before passing it to the next handler
2. **Short-circuit** and return a response directly (e.g., for authentication
   failures)
3. **Modify the response** after calling `next()`

```ts
import type { Middleware, NextFunction } from "@alexi/middleware";

const myMiddleware: Middleware = async (
  request: Request,
  next: NextFunction,
): Promise<Response> => {
  // Before: do something with the request
  console.log(`Incoming: ${request.method} ${request.url}`);

  // Call the next middleware/view
  const response = await next();

  // After: do something with the response
  console.log(`Outgoing: ${response.status}`);

  return response;
};
```

## Using Middleware

Add middleware to your `Application` configuration:

```ts
import { Application } from "@alexi/core";
import {
  corsMiddleware,
  errorHandlerMiddleware,
  loggingMiddleware,
} from "@alexi/middleware";
import { urlpatterns } from "./urls.ts";

const app = new Application({
  urls: urlpatterns,
  middleware: [
    loggingMiddleware(),
    corsMiddleware({ origins: ["http://localhost:5173"] }),
    errorHandlerMiddleware(),
  ],
});
```

**Middleware execution order matters!** Middleware is executed in the order you
specify:

1. Request flows **down** through the middleware stack (first to last)
2. Response flows **up** through the middleware stack (last to first)

A typical ordering:

1. `loggingMiddleware()` — logs all requests (first, to capture everything)
2. `corsMiddleware()` — handles CORS headers
3. `errorHandlerMiddleware()` — catches errors from views (last, to catch all
   errors)

---

## Built-in Middleware

### CORS Middleware

Handles Cross-Origin Resource Sharing (CORS) headers for browser-based API
access.

```ts
import { corsMiddleware } from "@alexi/middleware";
```

#### Basic Usage

```ts
// Allow all origins (development only)
corsMiddleware();

// Specific origins
corsMiddleware({
  origins: ["http://localhost:5173", "https://myapp.com"],
  credentials: true,
});
```

#### Options

| Option              | Type                                                | Default                                                 | Description                               |
| ------------------- | --------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------- |
| `origins`           | `string \| string[] \| (origin: string) => boolean` | `"*"`                                                   | Allowed origins                           |
| `methods`           | `string[]`                                          | `["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]`  | Allowed HTTP methods                      |
| `allowedHeaders`    | `string[]`                                          | `["Content-Type", "Authorization", "X-Requested-With"]` | Allowed request headers                   |
| `exposedHeaders`    | `string[]`                                          | `[]`                                                    | Headers exposed to the browser            |
| `credentials`       | `boolean`                                           | `false`                                                 | Allow credentials (cookies, auth headers) |
| `maxAge`            | `number`                                            | `86400`                                                 | Preflight cache duration (seconds)        |
| `preflightContinue` | `boolean`                                           | `false`                                                 | Continue to next handler after preflight  |

#### Examples

**Multiple specific origins:**

```ts
corsMiddleware({
  origins: [
    "http://localhost:3000",
    "http://localhost:5173",
    "https://app.example.com",
  ],
  credentials: true,
});
```

**Dynamic origin validation:**

```ts
corsMiddleware({
  origins: (origin) => origin.endsWith(".myapp.com"),
  credentials: true,
});
```

**Allow all origins (quick setup):**

```ts
import { allowAllOriginsMiddleware } from "@alexi/middleware";

// Pre-configured middleware that allows all origins
middleware: [allowAllOriginsMiddleware];
```

> ⚠️ **Warning:** Using `origins: "*"` with `credentials: true` is not allowed
> by browsers. Use specific origins when credentials are needed.

---

### Logging Middleware

Logs incoming requests and outgoing responses with timing information.

```ts
import { loggingMiddleware } from "@alexi/middleware";
```

#### Basic Usage

```ts
// With default options
loggingMiddleware();

// With custom options
loggingMiddleware({
  colors: true,
  logHeaders: true,
  skip: (req) => req.url.includes("/health"),
});
```

#### Options

| Option       | Type                            | Default       | Description                       |
| ------------ | ------------------------------- | ------------- | --------------------------------- |
| `colors`     | `boolean`                       | `true`        | Enable colored terminal output    |
| `logHeaders` | `boolean`                       | `false`       | Log request headers               |
| `logger`     | `(message: string) => void`     | `console.log` | Custom log function               |
| `skip`       | `(request: Request) => boolean` | `undefined`   | Skip logging for certain requests |

#### Output Example

With colors enabled:

```
→ GET /api/tasks/
← 200 OK (12ms)
→ POST /api/tasks/
← 201 Created (45ms)
→ GET /api/tasks/999/
← 404 Not Found (3ms)
```

#### Examples

**Skip health check endpoints:**

```ts
loggingMiddleware({
  skip: (request) => {
    const url = new URL(request.url);
    return url.pathname === "/health" || url.pathname === "/ready";
  },
});
```

**Custom logger:**

```ts
loggingMiddleware({
  logger: (message) => {
    // Send to external logging service
    myLoggingService.log(message);
  },
});
```

**Simple logging (pre-configured):**

```ts
import { simpleLoggingMiddleware } from "@alexi/middleware";

// Pre-configured middleware with default options
middleware: [simpleLoggingMiddleware];
```

---

### Error Handler Middleware

Catches errors thrown by views and returns appropriate JSON error responses.

```ts
import { errorHandlerMiddleware } from "@alexi/middleware";
```

#### Basic Usage

```ts
// Production (no stack traces)
errorHandlerMiddleware();

// Development (with stack traces)
errorHandlerMiddleware({
  includeStack: true,
});
```

#### Options

| Option         | Type                                         | Default             | Description                       |
| -------------- | -------------------------------------------- | ------------------- | --------------------------------- |
| `includeStack` | `boolean`                                    | `false`             | Include stack traces in responses |
| `logger`       | `(error: unknown, request: Request) => void` | `console.error`     | Custom error logger               |
| `formatError`  | `(error, request, options) => Response`      | (default formatter) | Custom response formatter         |

#### HTTP Error Classes

The middleware module provides pre-built error classes that map to HTTP status
codes:

```ts
import {
  BadRequestError, // 400
  ConflictError, // 409
  ForbiddenError, // 403
  HttpError, // Base class (custom status)
  InternalServerError, // 500
  MethodNotAllowedError, // 405
  NotFoundError, // 404
  UnauthorizedError, // 401
  ValidationError, // 422
} from "@alexi/middleware";
```

**Using error classes in views:**

```ts
import { NotFoundError, ValidationError } from "@alexi/middleware";

async function getTask(
  request: Request,
  params: { id: string },
): Promise<Response> {
  const task = await TaskModel.objects.filter({ id: parseInt(params.id) })
    .first();

  if (!task) {
    throw new NotFoundError(`Task ${params.id} not found`);
  }

  return Response.json(task);
}

async function createTask(request: Request): Promise<Response> {
  const data = await request.json();

  if (!data.title) {
    throw new ValidationError("Title is required", {
      field: "title",
      code: "required",
    });
  }

  const task = await TaskModel.objects.create(data);
  return Response.json(task, { status: 201 });
}
```

**Error response format:**

```json
{
  "error": "Task 999 not found",
  "details": { "id": 999 }
}
```

With `includeStack: true`:

```json
{
  "error": "Task 999 not found",
  "details": { "id": 999 },
  "stack": "NotFoundError: Task 999 not found\n    at getTask ..."
}
```

#### Pre-configured Handlers

```ts
import { debugErrorHandler, simpleErrorHandler } from "@alexi/middleware";

// Production: no stack traces
middleware: [simpleErrorHandler];

// Development: with stack traces
middleware: [debugErrorHandler];
```

#### Custom Error Formatting

```ts
errorHandlerMiddleware({
  formatError: (error, request, options) => {
    const isHttpError = error instanceof HttpError;

    return Response.json({
      success: false,
      error: {
        code: isHttpError ? error.name : "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
    }, {
      status: isHttpError ? error.status : 500,
    });
  },
});
```

---

## Creating Custom Middleware

### Basic Pattern

```ts
import type { Middleware, NextFunction } from "@alexi/middleware";

const myMiddleware: Middleware = async (
  request: Request,
  next: NextFunction,
): Promise<Response> => {
  // 1. Pre-processing (before view)

  // 2. Call next middleware/view
  const response = await next();

  // 3. Post-processing (after view)

  return response;
};
```

### Authentication Middleware

```ts
import type { Middleware } from "@alexi/middleware";
import { UnauthorizedError } from "@alexi/middleware";
import { verifyToken } from "@alexi/auth";

const authMiddleware: Middleware = async (request, next) => {
  // Skip auth for public routes
  const url = new URL(request.url);
  const publicPaths = ["/api/auth/login", "/api/auth/register", "/health"];

  if (publicPaths.includes(url.pathname)) {
    return next();
  }

  // Check for Authorization header
  const authHeader = request.headers.get("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    throw new UnauthorizedError("Missing or invalid Authorization header");
  }

  const token = authHeader.slice(7);

  try {
    const payload = await verifyToken(token);
    // Attach user info to request (using headers as a workaround)
    const headers = new Headers(request.headers);
    headers.set("X-User-Id", String(payload.userId));
    headers.set("X-User-Email", payload.email);

    const authenticatedRequest = new Request(request.url, {
      method: request.method,
      headers,
      body: request.body,
    });

    return next(); // Note: request modification requires more advanced patterns
  } catch {
    throw new UnauthorizedError("Invalid or expired token");
  }
};
```

### Rate Limiting Middleware

```ts
import type { Middleware } from "@alexi/middleware";

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
}

function rateLimitMiddleware(options: RateLimitOptions): Middleware {
  const { windowMs, maxRequests } = options;
  const requests = new Map<string, { count: number; resetAt: number }>();

  return async (request, next) => {
    const ip = request.headers.get("X-Forwarded-For") || "unknown";
    const now = Date.now();

    let record = requests.get(ip);

    if (!record || now > record.resetAt) {
      record = { count: 0, resetAt: now + windowMs };
      requests.set(ip, record);
    }

    record.count++;

    if (record.count > maxRequests) {
      return Response.json(
        { error: "Too many requests" },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((record.resetAt - now) / 1000)),
          },
        },
      );
    }

    const response = await next();

    // Add rate limit headers
    const headers = new Headers(response.headers);
    headers.set("X-RateLimit-Limit", String(maxRequests));
    headers.set("X-RateLimit-Remaining", String(maxRequests - record.count));
    headers.set("X-RateLimit-Reset", String(Math.ceil(record.resetAt / 1000)));

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}

// Usage
rateLimitMiddleware({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // 100 requests per minute
});
```

### Request Timing Middleware

```ts
import type { Middleware } from "@alexi/middleware";

const timingMiddleware: Middleware = async (request, next) => {
  const start = performance.now();

  const response = await next();

  const duration = performance.now() - start;

  // Add timing header
  const headers = new Headers(response.headers);
  headers.set("X-Response-Time", `${duration.toFixed(2)}ms`);
  headers.set("Server-Timing", `total;dur=${duration.toFixed(2)}`);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};
```

### Conditional Middleware

```ts
import type { Middleware } from "@alexi/middleware";

/**
 * Apply middleware only when condition is met
 */
function conditionalMiddleware(
  condition: (request: Request) => boolean,
  middleware: Middleware,
): Middleware {
  return async (request, next) => {
    if (condition(request)) {
      return middleware(request, next);
    }
    return next();
  };
}

// Usage: only apply auth to /api/ routes
conditionalMiddleware(
  (request) => new URL(request.url).pathname.startsWith("/api/"),
  authMiddleware,
);
```

---

## Middleware Best Practices

### 1. Order Matters

Place middleware in the correct order:

```ts
middleware: [
  // 1. Logging (first - to log everything)
  loggingMiddleware(),

  // 2. Error handling (early - to catch errors from all middleware)
  errorHandlerMiddleware(),

  // 3. CORS (before auth - preflight requests don't have auth)
  corsMiddleware({ origins: ["http://localhost:5173"] }),

  // 4. Rate limiting (before expensive operations)
  rateLimitMiddleware({ windowMs: 60000, maxRequests: 100 }),

  // 5. Authentication (after CORS, before views)
  authMiddleware,
  // 6. Other middleware...
];
```

### 2. Always Call `next()` or Return a Response

Every middleware must either:

- Call `next()` and return its response
- Return a response directly (short-circuit)

```ts
// ❌ Wrong - no return
const badMiddleware: Middleware = async (request, next) => {
  await next(); // Missing return!
};

// ✅ Correct
const goodMiddleware: Middleware = async (request, next) => {
  return next();
};

// ✅ Correct - short-circuit
const authMiddleware: Middleware = async (request, next) => {
  if (!isAuthenticated(request)) {
    return new Response("Unauthorized", { status: 401 });
  }
  return next();
};
```

### 3. Handle Errors Gracefully

Don't let middleware errors crash the server:

```ts
const safeMiddleware: Middleware = async (request, next) => {
  try {
    // Middleware logic that might fail
    await someOperation();
  } catch (error) {
    console.error("Middleware error:", error);
    // Continue anyway (or return error response)
  }

  return next();
};
```

### 4. Keep Middleware Focused

Each middleware should do one thing well:

```ts
// ❌ Wrong - too many responsibilities
const doEverythingMiddleware = ...

// ✅ Correct - separate concerns
middleware: [
  loggingMiddleware(),
  corsMiddleware(),
  authMiddleware,
  rateLimitMiddleware(),
]
```

---

## API Reference

### Types

```ts
/**
 * Next function to call the next middleware or view
 */
type NextFunction = () => Promise<Response>;

/**
 * Middleware function signature
 */
type Middleware = (
  request: Request,
  next: NextFunction,
) => Promise<Response>;
```

### CORS Middleware

```ts
interface CorsOptions {
  origins?: string | string[] | ((origin: string) => boolean);
  methods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
  preflightContinue?: boolean;
}

function corsMiddleware(options?: CorsOptions): Middleware;
const allowAllOriginsMiddleware: Middleware;
```

### Logging Middleware

```ts
interface LoggingOptions {
  colors?: boolean;
  logHeaders?: boolean;
  logger?: (message: string) => void;
  skip?: (request: Request) => boolean;
}

function loggingMiddleware(options?: LoggingOptions): Middleware;
const simpleLoggingMiddleware: Middleware;
```

### Error Handler Middleware

```ts
interface ErrorHandlerOptions {
  includeStack?: boolean;
  logger?: (error: unknown, request: Request) => void;
  formatError?: (
    error: unknown,
    request: Request,
    options: ErrorHandlerOptions,
  ) => Response;
}

function errorHandlerMiddleware(options?: ErrorHandlerOptions): Middleware;
const simpleErrorHandler: Middleware;
const debugErrorHandler: Middleware;
```

### HTTP Error Classes

```ts
class HttpError extends Error {
  readonly status: number;
  readonly details?: Record<string, unknown>;
  constructor(
    status: number,
    message: string,
    details?: Record<string, unknown>,
  );
}

class BadRequestError extends HttpError {/* status: 400 */}
class UnauthorizedError extends HttpError {/* status: 401 */}
class ForbiddenError extends HttpError {/* status: 403 */}
class NotFoundError extends HttpError {/* status: 404 */}
class MethodNotAllowedError extends HttpError {/* status: 405 */}
class ConflictError extends HttpError {/* status: 409 */}
class ValidationError extends HttpError {/* status: 422 */}
class InternalServerError extends HttpError {/* status: 500 */}
```
