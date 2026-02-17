# @alexi/core

Management commands and utilities for Alexi.

Provides a Django-style CLI framework for running commands like `runserver`,
`createsuperuser`, `test`, and custom management commands.

## Installation

```bash
deno add jsr:@alexi/core
```

## Quick Example

```typescript
import { BaseCommand, ManagementUtility } from "@alexi/core";

const cli = new ManagementUtility();
await cli.execute(Deno.args);
```

## Documentation

See [Management Commands](../../docs/core/management.md) for full documentation.
