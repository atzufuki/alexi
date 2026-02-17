# Authentication

Alexi provides JWT-based authentication through the REST backend, similar to
Django REST Framework's token authentication.

## Overview

Authentication in Alexi is handled by the `RestBackend` class, which provides:

- JWT token management (access + refresh tokens)
- Login/logout/register flows
- Automatic token refresh
- User profile management
- Password change

## Setup

### Backend Configuration

Configure authentication endpoints when creating the REST backend:

```typescript
import { RestBackend } from "@alexi/db/backends/rest";

const backend = new RestBackend({
  apiUrl: "http://localhost:8000/api",
  tokenStorageKey: "myapp_auth_tokens", // LocalStorage key
  authEndpoints: {
    login: "/auth/login/",
    register: "/auth/register/",
    refresh: "/auth/refresh/",
    logout: "/auth/logout/",
    me: "/auth/me/",
    changePassword: "/auth/change-password/",
  },
});
```

### Default Endpoints

If not specified, these defaults are used:

| Endpoint         | Default Path             |
| ---------------- | ------------------------ |
| `login`          | `/auth/login/`           |
| `register`       | `/auth/register/`        |
| `refresh`        | `/auth/refresh/`         |
| `logout`         | `/auth/logout/`          |
| `me`             | `/auth/me/`              |
| `changePassword` | `/auth/change-password/` |

## Login

```typescript
import { getBackendByName } from "@alexi/db";

const backend = getBackendByName("api") as RestBackend;

try {
  const { user, tokens } = await backend.login({
    email: "user@example.com",
    password: "secretpassword",
  });

  console.log("Logged in as:", user.email);
  console.log("User ID:", user.id);
} catch (error) {
  if (error instanceof RestApiError) {
    if (error.status === 401) {
      console.error("Invalid credentials");
    } else {
      console.error("Login failed:", error.message);
    }
  }
}
```

### Login Response

```typescript
interface AuthResponse {
  user: {
    id: number;
    email: string;
    firstName?: string;
    lastName?: string;
    isActive: boolean;
    isStaff: boolean;
    isSuperuser: boolean;
    dateJoined: string;
    lastLogin?: string;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn?: number; // Seconds until expiration
    expiresAt?: string; // ISO timestamp
  };
}
```

## Registration

```typescript
try {
  const { user, tokens } = await backend.register({
    email: "newuser@example.com",
    password: "secretpassword",
    firstName: "Jane",
    lastName: "Doe",
  });

  console.log("Registered and logged in as:", user.email);
} catch (error) {
  if (error instanceof RestApiError) {
    const body = error.parsedBody();
    if (body?.errors) {
      console.error("Validation errors:", body.errors);
    }
  }
}
```

## Logout

```typescript
await backend.logout();

console.log("Logged out");
console.log("Is authenticated:", backend.isAuthenticated()); // false
```

## Check Authentication Status

```typescript
// Check if user is authenticated
if (backend.isAuthenticated()) {
  console.log("User is logged in");
} else {
  console.log("User is not logged in");
}
```

## Get Current User

```typescript
if (backend.isAuthenticated()) {
  const user = await backend.getMe();

  console.log("Email:", user.email);
  console.log("Name:", user.firstName, user.lastName);
  console.log("Is Staff:", user.isStaff);
}
```

## Update User Profile

```typescript
const updated = await backend.updateMe({
  firstName: "Jane",
  lastName: "Smith",
});

console.log("Updated name:", updated.firstName, updated.lastName);
```

## Change Password

```typescript
try {
  await backend.changePassword("currentPassword", "newPassword");
  console.log("Password changed successfully");
} catch (error) {
  console.error("Failed to change password:", error.message);
}
```

## Token Management

### Automatic Token Refresh

The REST backend automatically refreshes the access token when it expires:

1. Before each request, checks if the access token is expired
2. If expired, uses the refresh token to get a new access token
3. If refresh fails, clears tokens (user must log in again)

### Manual Token Reload

If tokens were updated externally (e.g., in another tab):

```typescript
backend.reloadTokens();
```

### Token Storage

Tokens are stored in `localStorage` by default:

```typescript
const backend = new RestBackend({
  apiUrl: "http://localhost:8000/api",
  tokenStorageKey: "myapp_auth_tokens", // Custom key
});

// Tokens are stored as JSON:
// localStorage.getItem("myapp_auth_tokens")
// { "accessToken": "...", "refreshToken": "...", "expiresAt": "..." }
```

### Clear Tokens

To clear tokens without calling the logout endpoint:

```typescript
import { clearAuthTokens } from "@alexi/db/backends/rest";

clearAuthTokens("myapp_auth_tokens");
```

## Protected API Requests

When authenticated, all requests through the REST backend automatically include
the Authorization header:

```typescript
// This request includes: Authorization: Bearer <accessToken>
const todos = await TodoModel.objects
  .using("api")
  .all()
  .fetch();
```

## Server-Side Implementation

Your server needs to provide the authentication endpoints. Here's an example
ViewSet:

```typescript
// auth/viewsets.ts
import { action, ViewSet } from "@alexi/restframework";
import { UserModel } from "./models.ts";
import { generateTokens, hashPassword, verifyPassword } from "./utils.ts";

export class AuthViewSet extends ViewSet {
  @action({ detail: false, methods: ["POST"] })
  async login(context: ViewSetContext): Promise<Response> {
    const { email, password } = await context.request.json();

    const user = await UserModel.objects.get({ email });
    if (!user || !await verifyPassword(password, user.password.get())) {
      return Response.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const tokens = generateTokens(user);

    return Response.json({
      user: {
        id: user.id.get(),
        email: user.email.get(),
        firstName: user.firstName.get(),
        lastName: user.lastName.get(),
      },
      tokens,
    });
  }

  @action({ detail: false, methods: ["POST"] })
  async register(context: ViewSetContext): Promise<Response> {
    const data = await context.request.json();

    const hashedPassword = await hashPassword(data.password);
    const user = await UserModel.objects.create({
      email: data.email,
      password: hashedPassword,
      firstName: data.firstName,
      lastName: data.lastName,
    });

    const tokens = generateTokens(user);

    return Response.json({
      user: {
        id: user.id.get(),
        email: user.email.get(),
        firstName: user.firstName.get(),
        lastName: user.lastName.get(),
      },
      tokens,
    }, { status: 201 });
  }

  @action({ detail: false, methods: ["GET"] })
  async me(context: ViewSetContext): Promise<Response> {
    const user = await getUserFromRequest(context.request);
    if (!user) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    return Response.json({
      id: user.id.get(),
      email: user.email.get(),
      firstName: user.firstName.get(),
      lastName: user.lastName.get(),
    });
  }
}
```

## Authentication Middleware

Create middleware to protect routes:

```typescript
import type { Middleware } from "@alexi/http";
import { UnauthorizedError } from "@alexi/http";
import { verifyToken } from "./auth/utils.ts";

export const authMiddleware: Middleware = async (request, next) => {
  // Skip auth for public routes
  const url = new URL(request.url);
  const publicPaths = [
    "/api/auth/login/",
    "/api/auth/register/",
    "/api/health/",
  ];

  if (publicPaths.some((path) => url.pathname.startsWith(path))) {
    return next();
  }

  // Check Authorization header
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new UnauthorizedError("Missing authorization token");
  }

  const token = authHeader.slice(7);

  try {
    const payload = await verifyToken(token);
    // Attach user to request (via header or other mechanism)
    // Continue to next middleware/view
    return next();
  } catch {
    throw new UnauthorizedError("Invalid or expired token");
  }
};

// Usage
const app = new Application({
  urls: urlpatterns,
  middleware: [
    loggingMiddleware,
    corsMiddleware(),
    authMiddleware, // Protect API routes
  ],
});
```

## Frontend Integration

### Login Form Example

```typescript
class LoginPage extends HTMLPropsMixin(HTMLElement, {
  email: prop(""),
  password: prop(""),
  error: prop(""),
  loading: prop(false),
}) {
  private handleSubmit = async (e: Event) => {
    e.preventDefault();
    this.loading = true;
    this.error = "";

    try {
      const backend = getBackendByName("api") as RestBackend;
      await backend.login({
        email: this.email,
        password: this.password,
      });

      // Redirect to home
      navigate("/");
    } catch (error) {
      if (error instanceof RestApiError) {
        this.error = error.status === 401
          ? "Invalid email or password"
          : "Login failed. Please try again.";
      }
    } finally {
      this.loading = false;
    }
  };

  render() {
    return new Form({
      onsubmit: this.handleSubmit,
      content: [
        new Input({
          type: "email",
          placeholder: "Email",
          value: this.email,
          oninput: (e) => {
            this.email = e.target.value;
          },
        }),
        new Input({
          type: "password",
          placeholder: "Password",
          value: this.password,
          oninput: (e) => {
            this.password = e.target.value;
          },
        }),
        this.error && new Div({
          className: "error",
          textContent: this.error,
        }),
        new Button({
          type: "submit",
          disabled: this.loading,
          textContent: this.loading ? "Logging in..." : "Login",
        }),
      ],
    });
  }
}
```

### Auth Context Pattern

```typescript
// auth-context.ts
import { getBackendByName } from "@alexi/db";
import type { RestBackend } from "@alexi/db/backends/rest";

class AuthContext {
  private backend: RestBackend;
  private _user: AuthUser | null = null;

  constructor() {
    this.backend = getBackendByName("api") as RestBackend;
  }

  get isAuthenticated(): boolean {
    return this.backend.isAuthenticated();
  }

  get user(): AuthUser | null {
    return this._user;
  }

  async login(email: string, password: string): Promise<void> {
    const response = await this.backend.login({ email, password });
    this._user = response.user;
  }

  async logout(): Promise<void> {
    await this.backend.logout();
    this._user = null;
  }

  async loadUser(): Promise<void> {
    if (this.isAuthenticated) {
      this._user = await this.backend.getMe();
    }
  }
}

export const authContext = new AuthContext();
```

## Best Practices

1. **Use HTTPS in production** — Never send credentials over unencrypted
   connections

2. **Store tokens securely** — Consider using `httpOnly` cookies instead of
   localStorage for sensitive applications

3. **Handle token expiration** — The backend handles this automatically, but
   handle 401 responses in your UI

4. **Validate on server** — Always validate authentication server-side;
   client-side checks are for UX only

5. **Use short-lived access tokens** — Configure short expiration (15-60
   minutes) with refresh tokens

6. **Clear tokens on logout** — Ensure tokens are cleared from storage on logout

7. **Protect sensitive routes** — Use middleware to enforce authentication on
   API routes
