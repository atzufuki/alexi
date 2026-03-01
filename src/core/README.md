# @alexi/core

Universal setup module for Alexi.

Provides `setup()` for initializing the framework and `DatabasesConfig` for
database configuration. This module is safe to import in both server and browser
contexts.

For management commands, the CLI framework, and server-only utilities, use
`@alexi/core/management`.

## Installation

```bash
deno add jsr:@alexi/core
```

## Quick Example

```typescript
import { setup } from "@alexi/core";
import { DenoKVBackend } from "@alexi/db/backends/denokv";

await setup({
  DATABASES: {
    default: new DenoKVBackend({ name: "myapp", path: "./data/myapp.db" }),
  },
});
```

## Management Commands

```typescript
import { BaseCommand, ManagementUtility } from "@alexi/core/management";

const cli = new ManagementUtility();
await cli.execute(Deno.args);
```

## Documentation

See [Management Commands](../../docs/core/management.md) for full documentation.
