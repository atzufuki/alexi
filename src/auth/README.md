# @alexi/auth

JWT-based authentication for Alexi applications.

## Features

- JWT token creation and verification
- View decorators: `loginRequired`, `adminRequired`, `optionalLogin`
- Token pair management (access + refresh tokens)

## Installation

```bash
deno add jsr:@alexi/auth
```

## Quick Example

```typescript
import { adminRequired, loginRequired } from "@alexi/auth";
import { path } from "@alexi/urls";

export const urlpatterns = [
  path("api/profile/", loginRequired(profileView)),
  path("api/admin/", adminRequired(adminView)),
];
```

## Documentation

See [Authentication Documentation](../../docs/auth/authentication.md) for details.