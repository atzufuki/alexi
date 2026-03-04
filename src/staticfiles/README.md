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
import { getApplication } from "@alexi/core";
import * as settings from "./project/web.settings.ts";

export default await getApplication(settings);
```

Middleware (including `staticFilesMiddleware`) is wired up automatically via
your settings' `createMiddleware` function or `MIDDLEWARE` array.

## Documentation

See the full documentation at
[docs/staticfiles/staticfiles.md](../../docs/staticfiles/staticfiles.md).

## License

MIT
