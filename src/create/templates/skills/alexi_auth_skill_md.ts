/**
 * Template for alexi-auth SKILL.md
 *
 * Generates the Agent Skills file for @alexi/auth JWT authentication.
 */

export function generateAlexiAuthSkillMd(): string {
  return `---
name: alexi-auth
description: Use when implementing authentication with @alexi/auth - JWT tokens, login/logout, protected routes, and Django-style auth decorators in Deno.
license: MIT
metadata:
  author: atzufuki
  version: "1.0"
  package: "@alexi/auth"
---

# Alexi Authentication

## Overview

\`@alexi/auth\` provides JWT-based authentication for Alexi applications. It includes
Django-style decorators for protecting views and utilities for token management.

## When to Use This Skill

- Protecting API endpoints with authentication
- Creating login/logout functionality
- Managing JWT access and refresh tokens
- Implementing role-based access (admin vs regular users)
- Accessing the current user in views

## Installation

\`\`\`bash
deno add jsr:@alexi/auth
\`\`\`

## View-Level Authentication (Decorators)

### loginRequired

Requires a valid JWT token:

\`\`\`typescript
import { loginRequired } from "@alexi/auth";
import { path } from "@alexi/urls";

// Protected route - requires valid JWT
const profileView = loginRequired(async (request, params) => {
  const user = getRequestUser(request);
  return Response.json({
    userId: user?.userId,
    email: user?.email,
  });
});

export const urlpatterns = [
  path("api/profile/", profileView),
];
\`\`\`

### adminRequired

Requires admin privileges:

\`\`\`typescript
import { adminRequired } from "@alexi/auth";
import { path } from "@alexi/urls";

// Admin-only route
const adminUsersView = adminRequired(async (request, params) => {
  const users = await UserModel.objects.all().fetch();
  return Response.json({ users: users.array() });
});

export const urlpatterns = [
  path("api/admin/users/", adminUsersView),
];
\`\`\`

### optionalLogin

Works with or without authentication:

\`\`\`typescript
import { optionalLogin } from "@alexi/auth";
import { path } from "@alexi/urls";

// Optional auth - works for anonymous and authenticated users
const feedView = optionalLogin(async (request, params) => {
  const user = getRequestUser(request);
  
  if (user) {
    // Personalized feed for authenticated users
    return Response.json({ feed: await getPersonalizedFeed(user.userId) });
  }
  
  // Generic feed for anonymous users
  return Response.json({ feed: await getPublicFeed() });
});

export const urlpatterns = [
  path("api/feed/", feedView),
];
\`\`\`

## Accessing Current User

Use \`getRequestUser()\` to get the authenticated user:

\`\`\`typescript
import { getRequestUser, loginRequired } from "@alexi/auth";

const myView = loginRequired(async (request, params) => {
  const user = getRequestUser(request);
  
  // user object contains:
  // - userId: number
  // - email: string
  // - isAdmin: boolean
  
  return Response.json({
    message: \`Hello, \${user?.email}\`,
    isAdmin: user?.isAdmin,
  });
});
\`\`\`

## JWT Token Management

### Creating Tokens

\`\`\`typescript
import { createTokenPair } from "@alexi/auth";

// After successful login verification
const tokens = await createTokenPair(userId, email, isAdmin);

// tokens contains:
// - accessToken: string (short-lived, ~15 minutes)
// - refreshToken: string (long-lived, ~7 days)
// - expiresAt: number (Unix timestamp)

return Response.json(tokens);
\`\`\`

### Verifying Tokens

\`\`\`typescript
import { verifyToken } from "@alexi/auth";

try {
  const payload = await verifyToken(accessToken);
  
  // payload contains:
  // - userId: number
  // - email: string
  // - isAdmin: boolean
  // - exp: number (expiration timestamp)
  // - iat: number (issued at timestamp)
  
  console.log(\`Token valid for user: \${payload.email}\`);
} catch (error) {
  console.error("Invalid or expired token");
}
\`\`\`

### Token Refresh Flow

\`\`\`typescript
import { createTokenPair, verifyToken } from "@alexi/auth";

async function refreshTokens(refreshToken: string) {
  try {
    // Verify refresh token
    const payload = await verifyToken(refreshToken);
    
    // Create new token pair
    const tokens = await createTokenPair(
      payload.userId,
      payload.email,
      payload.isAdmin
    );
    
    return Response.json(tokens);
  } catch (error) {
    return new Response("Invalid refresh token", { status: 401 });
  }
}
\`\`\`

## Login/Logout Implementation

### Login Endpoint

\`\`\`typescript
import { createTokenPair } from "@alexi/auth";
import { UserModel } from "./models.ts";

async function loginView(request: Request): Promise<Response> {
  const { email, password } = await request.json();
  
  // Find user
  const user = await UserModel.objects.filter({ email }).first();
  if (!user) {
    return Response.json({ error: "Invalid credentials" }, { status: 401 });
  }
  
  // Verify password (using your preferred hashing library)
  const isValid = await verifyPassword(password, user.passwordHash.get());
  if (!isValid) {
    return Response.json({ error: "Invalid credentials" }, { status: 401 });
  }
  
  // Create tokens
  const tokens = await createTokenPair(
    user.id.get(),
    user.email.get(),
    user.isAdmin.get()
  );
  
  return Response.json({
    user: { id: user.id.get(), email: user.email.get() },
    ...tokens,
  });
}
\`\`\`

### Logout Endpoint

\`\`\`typescript
import { loginRequired } from "@alexi/auth";

// Server-side logout (optional - tokens are stateless)
const logoutView = loginRequired(async (request, params) => {
  // For stateless JWT, client just discards tokens
  // For added security, you can maintain a token blacklist
  
  return Response.json({ message: "Logged out successfully" });
});
\`\`\`

## Client-Side Usage (with RestBackend)

The RestBackend handles token storage and refresh automatically:

\`\`\`typescript
import { RestBackend } from "@alexi/db/backends/rest";

const backend = new RestBackend({
  apiUrl: "https://api.example.com/api",
  tokenStorageKey: "myapp_auth_tokens", // localStorage key
});

// Login
const { user } = await backend.login({
  email: "user@example.com",
  password: "secret",
});

// Get current user
const me = await backend.getMe();

// Logout (clears stored tokens)
await backend.logout();

// Check if authenticated
const isLoggedIn = backend.isAuthenticated();
\`\`\`

## Protected Routes in urls.ts

\`\`\`typescript
import { adminRequired, loginRequired, optionalLogin } from "@alexi/auth";
import { include, path } from "@alexi/urls";
import { Router } from "@alexi/restframework";

// ViewSet-based routes (handled by ViewSet permissions)
const router = new Router();
router.register("tasks", TaskViewSet);

// Function-based routes with decorators
export const urlpatterns = [
  // Public
  path("api/", include(router.urls)),
  path("api/health/", healthView),
  
  // Auth required
  path("api/profile/", loginRequired(profileView)),
  path("api/settings/", loginRequired(settingsView)),
  
  // Admin only
  path("api/admin/users/", adminRequired(adminUsersView)),
  path("api/admin/stats/", adminRequired(adminStatsView)),
  
  // Optional auth
  path("api/feed/", optionalLogin(feedView)),
];
\`\`\`

## Common Mistakes

**Forgetting to await token operations**

\`\`\`typescript
// ❌ Wrong - createTokenPair is async
const tokens = createTokenPair(userId, email, isAdmin);

// ✅ Correct
const tokens = await createTokenPair(userId, email, isAdmin);
\`\`\`

**Not handling token expiration**

\`\`\`typescript
// ❌ Wrong - no error handling
const payload = await verifyToken(token);

// ✅ Correct - handle expiration
try {
  const payload = await verifyToken(token);
} catch (error) {
  // Token expired or invalid - redirect to login
  return new Response("Unauthorized", { status: 401 });
}
\`\`\`

**Applying decorators incorrectly**

\`\`\`typescript
// ❌ Wrong - decorator applied to URL pattern
path("api/profile/", loginRequired, profileView)

// ✅ Correct - decorator wraps the view function
path("api/profile/", loginRequired(profileView))
\`\`\`

## Import Reference

\`\`\`typescript
// Decorators
import { adminRequired, loginRequired, optionalLogin } from "@alexi/auth";

// Token utilities
import { createTokenPair, verifyToken } from "@alexi/auth";

// User access
import { getRequestUser } from "@alexi/auth";
\`\`\`
`;
}
