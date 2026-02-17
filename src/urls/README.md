# @alexi/urls

URL routing utilities for Alexi, inspired by Django's URL dispatcher.

## Features

- `path()` — Define URL patterns with parameters
- `include()` — Nest URL configurations
- Pattern matching with typed parameters

## Installation

```bash
deno add jsr:@alexi/urls
```

## Quick Example

```typescript
import { include, path } from "@alexi/urls";

export const urlpatterns = [
  path("api/", include(apiRouter.urls)),
  path("users/:id/", userDetailView),
];
```

## Documentation

See [URL Routing](../../docs/urls.md) for the complete guide.
