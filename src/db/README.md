# @alexi/db

Django-style ORM for Deno with multiple database backends.

## Features

- **Models** — Define data structures with typed fields
- **QuerySets** — Filter, order, and chain queries
- **Managers** — Custom model managers
- **Multiple Backends** — SQLite (DenoKV), IndexedDB, REST API

## Installation

```bash
deno add jsr:@alexi/db
```

## Quick Example

```typescript
import { AutoField, BooleanField, CharField, Manager, Model } from "@alexi/db";

class TodoModel extends Model {
  id = new AutoField({ primaryKey: true });
  title = new CharField({ maxLength: 200 });
  completed = new BooleanField({ default: false });

  static objects = new Manager(TodoModel);
  static meta = { dbTable: "todos" };
}

// Query
const todos = await TodoModel.objects.filter({ completed: false }).fetch();
```

## Documentation

See the full documentation:

- [ORM Models](../../docs/db/models.md)
- [Database Backends](../../docs/db/backends.md)

## License

MIT