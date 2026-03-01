# @alexi/restframework

REST API framework for Alexi, inspired by Django REST Framework.

## Features

- **Serializers** — Data validation, transformation, and model integration
- **ViewSets** — Class-based views with CRUD operations
- **Routers** — Automatic URL routing for ViewSets
- **Filter Backends** — Query parameter filtering, ordering, and search

## Installation

```bash
deno add jsr:@alexi/restframework
```

## Quick Example

```typescript
import {
  DefaultRouter,
  ModelSerializer,
  ModelViewSet,
} from "@alexi/restframework";
import { TodoModel } from "./models.ts";

class TodoSerializer extends ModelSerializer {
  static Meta = {
    model: TodoModel,
    fields: ["id", "title", "completed"],
  };
}

class TodoViewSet extends ModelViewSet {
  model = TodoModel;
  serializer_class = TodoSerializer;
}

const router = new DefaultRouter();
router.register("todos", TodoViewSet);

export const urlpatterns = router.urls;
```

## Documentation

- [ViewSets](../../docs/restframework/viewsets.md)
- [Serializers](../../docs/restframework/serializers.md)
- [Filtering](../../docs/restframework/filtering.md)

## License

MIT
