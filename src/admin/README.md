# @alexi/admin

Auto-generated Django-style admin panel for Alexi models.

## Installation

```bash
deno add jsr:@alexi/admin
```

## Quick Start

```typescript
import { AdminRouter, AdminSite, ModelAdmin } from "@alexi/admin";
import { UserModel } from "./models.ts";
import { backend } from "./db.ts";
import * as settings from "./settings.ts";

// 1. Create the admin site
const adminSite = new AdminSite({
  title: "My App Admin",
  header: "My App Administration",
});

// 2. Register models
class UserAdmin extends ModelAdmin {
  listDisplay = ["id", "email", "isActive"];
  searchFields = ["email"];
  ordering = ["-dateJoined"];
}

adminSite.register(UserModel, UserAdmin);

// 3. Handle requests
const router = new AdminRouter(adminSite, backend, settings);
const response = await router.handle(request);
```

## Documentation

See [Admin Panel Documentation](../../docs/admin/admin.md) for full usage,
configuration reference, and examples.
