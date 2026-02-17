# @alexi/http

HTTP application handler and middleware system for Alexi.

## Overview

This module provides the `Application` class that handles HTTP requests, manages
middleware pipelines, and routes requests to your views and ViewSets.

## Installation

```bash
deno add jsr:@alexi/http
```

## Quick Example

```typescript
import { Application } from "@alexi/http";
import { urlpatterns } from "./urls.ts";

const app = new Application({
  urls: urlpatterns,
});

Deno.serve({ port: 8000 }, app.handler);
```

## Documentation

See the [HTTP Application documentation](../../docs/http/application.md) for
detailed usage.

## Related Modules

- [`@alexi/urls`](../urls/) — URL routing
- [`@alexi/middleware`](../middleware/) — Middleware utilities
- [`@alexi/restframework`](../restframework/) — REST API framework