# @alexi/staticfiles

Static file serving and bundling for Alexi applications.

## Overview

Provides static file handling similar to Django's `django.contrib.staticfiles`:

- **Finders** — Locate static files across apps
- **Storage** — File storage backends
- **Middleware** — Serve static files in development
- **Bundling** — Bundle frontend apps for production

## Installation

```bash
deno add jsr:@alexi/staticfiles
```

## Basic Usage

```typescript
import { staticFilesMiddleware } from "@alexi/staticfiles";

const app = new Application({
  middleware: [staticFilesMiddleware()],
});
```

## Documentation

See the full documentation at [docs/staticfiles/staticfiles.md](../../docs/staticfiles/staticfiles.md).

## License

MIT