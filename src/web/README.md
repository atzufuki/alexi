# @alexi/web

Web server commands and development server for Alexi projects.

## Overview

This module provides the `runserver` command for starting development servers
and handling HTTP requests in Alexi applications.

## Installation

```bash
deno add jsr:@alexi/web
```

## Usage

```typescript
import "@alexi/web";
```

Add to your settings:

```typescript
export const INSTALLED_APPS = [
  () => import("@alexi/web"),
  // ...
];
```

Run the development server:

```bash
deno run -A manage.ts runserver --settings web
```

## Documentation

See the main [Alexi documentation](../../docs/getting-started.md) for details.

## License

MIT