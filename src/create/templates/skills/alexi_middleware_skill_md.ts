/**
 * Template for alexi-middleware SKILL.md
 *
 * Generates the Agent Skills file for @alexi/middleware.
 */

export function generateAlexiMiddlewareSkillMd(): string {
  return `---
name: alexi-middleware
description: Use when working with @alexi/middleware - adding CORS, logging, error handling, and creating custom middleware for Alexi web applications.
license: MIT
metadata:
  author: atzufuki
  version: "1.0"
  package: "@alexi/middleware"
---

# Alexi Middleware

## Overview

\`@alexi/middleware\` provides middleware components for Alexi web applications,
including CORS handling, request logging, and error handling. It follows the
standard middleware pattern used in modern web frameworks.

## When to Use This Skill

- Adding CORS support for cross-origin requests
- Logging HTTP requests and responses
- Handling errors globally
- Creating custom middleware
- Setting up middleware stack in settings

## Installation

\`\`\`bash
deno add jsr:@alexi/middleware
\`\`\`

## Built-in Middleware

### CORS Middleware

Handle Cross-Origin Resource Sharing:

\`\`\`typescript
import { corsMiddleware } from "@alexi/middleware";

const cors = corsMiddleware({
  allowedOrigins: ["http://localhost:3000", "https://myapp.com"],
  allowedMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  exposedHeaders: ["X-Total-Count"],
  allowCredentials: true,
  maxAge: 86400,  // 24 hours
});
\`\`\`

### Logging Middleware

Log HTTP requests:

\`\`\`typescript
import { loggingMiddleware } from "@alexi/middleware";

const logging = loggingMiddleware({
  format: "combined",  // or "common", "dev", "short"
  skip: (req) => req.url.includes("/health"),  // Skip health checks
});

// Output example:
// [2024-01-15T10:30:00Z] GET /api/tasks 200 45ms
\`\`\`

### Error Handler Middleware

Global error handling:

\`\`\`typescript
import { errorHandlerMiddleware } from "@alexi/middleware";

const errorHandler = errorHandlerMiddleware({
  includeStack: Deno.env.get("DEBUG") === "true",
  onError: (error, request) => {
    // Custom error logging
    console.error(\`Error on \${request.url}:\`, error);
  },
});
\`\`\`

## Middleware Configuration

### In Settings

\`\`\`typescript
// project/web.settings.ts
export const MIDDLEWARE = [
  "corsMiddleware",
  "loggingMiddleware",
  "errorHandlerMiddleware",
];

// Or with custom configuration
export const MIDDLEWARE_CONFIG = {
  cors: {
    allowedOrigins: ["*"],
    allowCredentials: false,
  },
  logging: {
    format: "dev",
  },
  errorHandler: {
    includeStack: true,
  },
};
\`\`\`

## Creating Custom Middleware

### Basic Middleware

\`\`\`typescript
import type { Middleware, NextFunction } from "@alexi/middleware";

const timingMiddleware: Middleware = async (
  request: Request,
  next: NextFunction,
): Promise<Response> => {
  const start = performance.now();
  
  // Call next middleware/handler
  const response = await next(request);
  
  const duration = performance.now() - start;
  
  // Add timing header
  const headers = new Headers(response.headers);
  headers.set("X-Response-Time", \`\${duration.toFixed(2)}ms\`);
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};
\`\`\`

### Authentication Middleware

\`\`\`typescript
import type { Middleware, NextFunction } from "@alexi/middleware";
import { UnauthorizedError } from "@alexi/middleware";

const authMiddleware: Middleware = async (
  request: Request,
  next: NextFunction,
): Promise<Response> => {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");
  
  if (!token) {
    throw new UnauthorizedError("Missing authentication token");
  }
  
  try {
    const payload = await verifyToken(token);
    // Attach user to request (using headers as carrier)
    const headers = new Headers(request.headers);
    headers.set("X-User-Id", String(payload.userId));
    
    const authenticatedRequest = new Request(request.url, {
      method: request.method,
      headers,
      body: request.body,
    });
    
    return next(authenticatedRequest);
  } catch (error) {
    throw new UnauthorizedError("Invalid token");
  }
};
\`\`\`

### Rate Limiting Middleware

\`\`\`typescript
import type { Middleware, NextFunction } from "@alexi/middleware";
import { HttpError } from "@alexi/middleware";

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

const rateLimitMiddleware = (
  limit: number = 100,
  windowMs: number = 60000,
): Middleware => {
  return async (request: Request, next: NextFunction): Promise<Response> => {
    const ip = request.headers.get("X-Forwarded-For") ?? "unknown";
    const now = Date.now();
    
    let record = rateLimitStore.get(ip);
    
    if (!record || now > record.resetAt) {
      record = { count: 0, resetAt: now + windowMs };
      rateLimitStore.set(ip, record);
    }
    
    record.count++;
    
    if (record.count > limit) {
      throw new HttpError(429, "Too many requests");
    }
    
    const response = await next(request);
    
    const headers = new Headers(response.headers);
    headers.set("X-RateLimit-Limit", String(limit));
    headers.set("X-RateLimit-Remaining", String(limit - record.count));
    headers.set("X-RateLimit-Reset", String(record.resetAt));
    
    return new Response(response.body, {
      status: response.status,
      headers,
    });
  };
};
\`\`\`

## HTTP Errors

Built-in error classes:

\`\`\`typescript
import {
  BadRequestError,
  ForbiddenError,
  HttpError,
  NotFoundError,
  UnauthorizedError,
} from "@alexi/middleware";

// Throw in views/middleware
throw new NotFoundError("Task not found");
throw new UnauthorizedError("Invalid credentials");
throw new ForbiddenError("Access denied");
throw new BadRequestError("Invalid input");

// Custom status codes
throw new HttpError(418, "I'm a teapot");
throw new HttpError(503, "Service temporarily unavailable");
\`\`\`

### Error Response Format

\`\`\`json
{
  "error": {
    "status": 404,
    "message": "Task not found",
    "code": "NOT_FOUND"
  }
}
\`\`\`

## Middleware Order

Middleware executes in order - place error handler last:

\`\`\`typescript
export const MIDDLEWARE = [
  "corsMiddleware",      // 1. Handle CORS preflight
  "loggingMiddleware",   // 2. Log all requests
  "rateLimitMiddleware", // 3. Rate limiting
  "authMiddleware",      // 4. Authentication
  "errorHandlerMiddleware", // 5. Catch all errors (LAST)
];
\`\`\`

## Conditional Middleware

Apply middleware to specific paths:

\`\`\`typescript
import type { Middleware, NextFunction } from "@alexi/middleware";

const conditionalMiddleware = (
  pathPattern: RegExp,
  middleware: Middleware,
): Middleware => {
  return async (request: Request, next: NextFunction): Promise<Response> => {
    const url = new URL(request.url);
    
    if (pathPattern.test(url.pathname)) {
      return middleware(request, next);
    }
    
    return next(request);
  };
};

// Usage: only apply auth to /api/ routes
const apiAuth = conditionalMiddleware(/^\\/api\\//, authMiddleware);
\`\`\`

## Common Mistakes

**Wrong middleware order**

\`\`\`typescript
// ❌ Wrong - error handler before other middleware
export const MIDDLEWARE = [
  "errorHandlerMiddleware",  // Errors before this won't be caught!
  "corsMiddleware",
  "loggingMiddleware",
];

// ✅ Correct - error handler last
export const MIDDLEWARE = [
  "corsMiddleware",
  "loggingMiddleware",
  "errorHandlerMiddleware",
];
\`\`\`

**Not calling next()**

\`\`\`typescript
// ❌ Wrong - breaks middleware chain
const badMiddleware: Middleware = async (request, next) => {
  console.log("Request received");
  // Forgot to call next() - request hangs!
};

// ✅ Correct - always call next() or return response
const goodMiddleware: Middleware = async (request, next) => {
  console.log("Request received");
  return next(request);  // Continue chain
};
\`\`\`

**Throwing plain errors**

\`\`\`typescript
// ❌ Wrong - generic 500 error
throw new Error("Not found");

// ✅ Correct - proper HTTP error
throw new NotFoundError("Resource not found");
\`\`\`

## Import Reference

\`\`\`typescript
// Built-in middleware
import {
  corsMiddleware,
  errorHandlerMiddleware,
  loggingMiddleware,
} from "@alexi/middleware";

// HTTP errors
import {
  BadRequestError,
  ForbiddenError,
  HttpError,
  NotFoundError,
  UnauthorizedError,
} from "@alexi/middleware";

// Types
import type { Middleware, NextFunction } from "@alexi/middleware";
\`\`\`
`;
}
