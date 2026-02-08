# Issue: Declarative REST Endpoint Configuration (DRF-style)

## Summary

Replace RestBackend's imperative endpoint configuration (`endpointMap`,
`getSpecialQueryHandlers()`, `callModelAction()`) with declarative
**ModelEndpoint** classes that use field-like descriptors — mirroring how Django
REST Framework uses ViewSets, `@action` decorators, and router registration.

---

## Motivation

### Current approach (imperative, verbose)

Configuring endpoints currently requires:

1. A flat `endpointMap` dict for model → URL mapping
2. Overriding `getSpecialQueryHandlers()` with verbose matcher objects
3. Calling `callModelAction()` with raw strings (no type safety)

Example from `uplake-deno` (~40 lines of boilerplate):

```typescript
const UPLAKE_ENDPOINT_MAP: Record<string, string> = {
  UserModel: "users",
  OrganisationModel: "organisations",
  ProjectModel: "projects",
  EmployeeModel: "employees",
  // ... 12 more entries
};

const UPLAKE_SPECIAL_QUERY_HANDLERS: Record<string, SpecialQueryHandler[]> = {
  organisations: [
    {
      matches: (filters) =>
        filters.length === 1 &&
        filters[0].field === "current" &&
        filters[0].lookup === "exact" &&
        filters[0].value === true,
      getEndpoint: () => "/organisations/current/",
      returnsSingle: true,
    },
  ],
  users: [
    {
      matches: (filters) =>
        filters.length === 1 &&
        filters[0].field === "current" &&
        filters[0].lookup === "exact" &&
        filters[0].value === true,
      getEndpoint: () => "/users/current/",
      returnsSingle: true,
    },
  ],
};

export class RestBackend extends BaseRestBackend {
  constructor(config: { apiUrl: string; debug?: boolean }) {
    super({
      apiUrl: config.apiUrl,
      debug: config.debug,
      tokenStorageKey: "uplake_auth_tokens",
      endpointMap: UPLAKE_ENDPOINT_MAP,
    });
  }

  protected override getSpecialQueryHandlers() {
    return UPLAKE_SPECIAL_QUERY_HANDLERS;
  }
}
```

### Problems

- **Verbose**: Each special query handler requires ~10 lines of boilerplate for
  a single filter → endpoint mapping
- **Not Django-like**: DRF uses declarative class-level fields and `@action`
  decorators; the current approach feels like manual wiring
- **No type safety**: `callModelAction("projects", 42, "publish")` is all
  strings — typos cause runtime errors, no autocomplete
- **Scattered configuration**: Endpoint mapping, special handlers, and actions
  are configured in different places with different mechanisms
- **Repetitive patterns**: Every `SingletonQuery` handler has the exact same
  matcher structure — only the field name and endpoint change

---

## Proposal: ModelEndpoint Classes

### DRF parallel

In DRF on the server side:

```python
class ProjectViewSet(ModelViewSet):
    queryset = Project.objects.all()
    serializer_class = ProjectSerializer

    @action(detail=True, methods=["post"])
    def publish(self, request, pk=None):
        project = self.get_object()
        project.publish()
        project.save()
        return Response({"status": "published"})

    @action(detail=True, methods=["post"])
    def unpublish(self, request, pk=None):
        ...
```

The proposed **client-side equivalent** uses the same declarative style:

```typescript
class ProjectEndpoint extends ModelEndpoint {
  model = ProjectModel;

  publish = new DetailAction();
  unpublish = new DetailAction();
}
```

### Design

#### Field-like descriptors

Three descriptor types, each analogous to a DRF concept:

| Descriptor       | DRF Equivalent                 | Generates                                       |
| ---------------- | ------------------------------ | ----------------------------------------------- |
| `DetailAction`   | `@action(detail=True)`         | `POST /endpoint/:id/action_name/`               |
| `ListAction`     | `@action(detail=False)`        | `GET\|POST /endpoint/action_name/`              |
| `SingletonQuery` | Custom queryset method / mixin | `filter({field: true})` → `GET /endpoint/field/` |

```typescript
// === Descriptor classes ===

/**
 * Detail action: maps to POST /endpoint/:id/action_name/
 * Like DRF's @action(detail=True)
 */
class DetailAction<TResponse = Record<string, unknown>> {
  constructor(
    public readonly options: {
      method?: "POST" | "PUT" | "PATCH" | "DELETE";
    } = {},
  ) {}
}

/**
 * List action: maps to GET|POST /endpoint/action_name/
 * Like DRF's @action(detail=False)
 */
class ListAction<TResponse = Record<string, unknown>> {
  constructor(
    public readonly options: {
      method?: "POST" | "GET";
      single?: boolean; // Returns single object vs array
    } = {},
  ) {}
}

/**
 * Singleton query: filter({field: true}) → GET /endpoint/field/
 * Replaces verbose SpecialQueryHandler declarations
 */
class SingletonQuery {}
```

#### ModelEndpoint base class

```typescript
/**
 * Base class for declarative REST endpoint configuration.
 * Analogous to DRF's ViewSet, but on the client side.
 *
 * Subclass this and declare fields to describe your API shape.
 */
abstract class ModelEndpoint {
  /** The ORM model this endpoint is for */
  abstract model: typeof Model;

  /**
   * Override to set custom endpoint path.
   * Default: model.meta.dbTable or auto-derived from model name.
   */
  endpoint?: string;
}
```

#### Concrete endpoint declarations

```typescript
class OrganisationEndpoint extends ModelEndpoint {
  model = OrganisationModel;

  // filter({current: true}) → GET /organisations/current/
  current = new SingletonQuery();

  // POST /organisations/:id/activate/
  activate = new DetailAction();
  deactivate = new DetailAction();
}

class ProjectEndpoint extends ModelEndpoint {
  model = ProjectModel;

  // POST /projects/:id/publish/
  publish = new DetailAction();
  unpublish = new DetailAction();

  // GET /projects/published/ → returns array
  published = new ListAction({ method: "GET" });
}

class UserEndpoint extends ModelEndpoint {
  model = UserModel;

  // filter({current: true}) → GET /users/current/
  current = new SingletonQuery();
}

class ConnectionEndpoint extends ModelEndpoint {
  model = ConnectionModel;

  accept = new DetailAction();
  decline = new DetailAction();
  activate = new DetailAction();
  deactivate = new DetailAction();
  shareProject = new DetailAction(); // → POST /connections/:id/share-project/
  shareEmployees = new DetailAction(); // → POST /connections/:id/share-employees/
}
```

---

## Registration

### Option A: In RestBackend config (recommended)

```typescript
const backend = new RestBackend({
  apiUrl: "https://api.example.com/api",
  tokenStorageKey: "myapp_tokens",
  endpoints: [
    OrganisationEndpoint,
    ProjectEndpoint,
    UserEndpoint,
    ConnectionEndpoint,
  ],
});
```

### Option B: Router-style (DRF Router parallel)

```typescript
const router = new RestRouter();
router.register(OrganisationEndpoint);
router.register(ProjectEndpoint);
router.register(UserEndpoint);
router.register(ConnectionEndpoint);

const backend = new RestBackend({
  apiUrl: "https://api.example.com/api",
  router,
});
```

---

## Usage

### ORM queries (unchanged — special handlers auto-generated)

```typescript
// SingletonQuery "current" auto-generates a SpecialQueryHandler
const org = await OrganisationModel.objects
  .using(backend)
  .filter({ current: true })
  .first();
// → GET /organisations/current/

const user = await UserModel.objects
  .using(backend)
  .filter({ current: true })
  .first();
// → GET /users/current/
```

### Actions — type-safe calls

```typescript
// Old way (still works, but not type-safe):
await backend.callModelAction("projects", 42, "publish");

// New way — type-safe:
await backend.action(ProjectEndpoint, "publish", 42);
// → POST /projects/42/publish/

await backend.action(ConnectionEndpoint, "accept", 5, { note: "OK" });
// → POST /connections/5/accept/
```

### List actions

```typescript
const publishedProjects = await backend.action(ProjectEndpoint, "published");
// → GET /projects/published/
```

### Standard CRUD (unchanged)

```typescript
const allProjects = await ProjectModel.objects.using(backend).all().fetch();
await ProjectModel.objects.using(backend).create({ name: "New Project" });
```

---

## Internal Mechanism: Introspection

When `RestBackend` receives the `endpoints` list, it introspects each
`ModelEndpoint` class and auto-generates the internal configuration:

```typescript
private _registerEndpoints(endpoints: (typeof ModelEndpoint)[]): void {
  for (const EndpointClass of endpoints) {
    const instance = new EndpointClass();
    const modelClass = instance.model;
    const endpoint =
      instance.endpoint ??
      modelClass.meta?.dbTable ??
      this._deriveEndpoint(modelClass.name);

    // 1. Auto-generate endpoint mapping (replaces endpointMap)
    this._endpointMap[modelClass.name] = endpoint;

    // 2. Scan field-like descriptors
    for (const [key, value] of Object.entries(instance)) {
      if (key === "model" || key === "endpoint") continue;

      if (value instanceof SingletonQuery) {
        // Auto-generate SpecialQueryHandler
        this._registerSingletonQuery(endpoint, key);
      }

      if (value instanceof DetailAction) {
        this._registerDetailAction(endpoint, key, value.options);
      }

      if (value instanceof ListAction) {
        this._registerListAction(endpoint, key, value.options);
      }
    }
  }
}

private _registerSingletonQuery(endpoint: string, field: string): void {
  if (!this._specialHandlers[endpoint]) {
    this._specialHandlers[endpoint] = [];
  }

  this._specialHandlers[endpoint].push({
    matches: (filters) =>
      filters.length === 1 &&
      filters[0].field === field &&
      filters[0].lookup === "exact" &&
      filters[0].value === true,
    getEndpoint: () => `/${endpoint}/${field}/`,
    returnsSingle: true,
  });
}
```

---

## Before / After Comparison

### Before (Uplake RestBackend — ~60 lines):

```typescript
const UPLAKE_ENDPOINT_MAP: Record<string, string> = {
  UserModel: "users",
  OrganisationModel: "organisations",
  // ... 14 entries
};

const UPLAKE_SPECIAL_QUERY_HANDLERS: Record<string, SpecialQueryHandler[]> = {
  organisations: [{
    matches: (filters) =>
      filters.length === 1 &&
      filters[0].field === "current" &&
      filters[0].lookup === "exact" &&
      filters[0].value === true,
    getEndpoint: () => "/organisations/current/",
    returnsSingle: true,
  }],
  users: [{
    matches: (filters) =>
      filters.length === 1 &&
      filters[0].field === "current" &&
      filters[0].lookup === "exact" &&
      filters[0].value === true,
    getEndpoint: () => "/users/current/",
    returnsSingle: true,
  }],
};

export class RestBackend extends BaseRestBackend {
  constructor(config: { apiUrl: string; debug?: boolean }) {
    super({
      apiUrl: config.apiUrl,
      tokenStorageKey: "uplake_auth_tokens",
      endpointMap: UPLAKE_ENDPOINT_MAP,
    });
  }

  protected override getSpecialQueryHandlers() {
    return UPLAKE_SPECIAL_QUERY_HANDLERS;
  }
}
```

### After (Declarative endpoints — ~25 lines):

```typescript
class OrganisationEndpoint extends ModelEndpoint {
  model = OrganisationModel;
  current = new SingletonQuery();
}

class UserEndpoint extends ModelEndpoint {
  model = UserModel;
  current = new SingletonQuery();
}

class ProjectEndpoint extends ModelEndpoint {
  model = ProjectModel;
  publish = new DetailAction();
  unpublish = new DetailAction();
}

export class RestBackend extends BaseRestBackend {
  constructor(config: { apiUrl: string; debug?: boolean }) {
    super({
      apiUrl: config.apiUrl,
      tokenStorageKey: "uplake_auth_tokens",
      endpoints: [
        OrganisationEndpoint,
        UserEndpoint,
        ProjectEndpoint,
      ],
    });
  }
}
```

The `endpointMap` is no longer needed for models that have `meta.dbTable` set
(which is already the recommended practice). The `getSpecialQueryHandlers()`
override is completely replaced by `SingletonQuery` declarations.

---

## Naming Conventions

### Action name → URL segment

Following DRF's convention, camelCase property names are converted to
kebab-case URL segments:

| Property Name    | URL Segment        | Full URL                              |
| ---------------- | ------------------ | ------------------------------------- |
| `publish`        | `publish`          | `POST /projects/:id/publish/`         |
| `shareProject`   | `share-project`    | `POST /connections/:id/share-project/` |
| `shareEmployees` | `share-employees`  | `POST /connections/:id/share-employees/` |

This mirrors DRF's automatic `snake_case → kebab-case` URL conversion.

---

## Custom Action Logic

For actions that need custom logic beyond a simple HTTP call, define methods
on the endpoint class:

```typescript
class ProjectEndpoint extends ModelEndpoint {
  model = ProjectModel;

  // Simple action (generic POST, no custom logic needed)
  publish = new DetailAction();
  unpublish = new DetailAction();

  // Custom action with app-specific logic
  async duplicate(
    backend: RestBackend,
    id: number,
    options?: { newName?: string },
  ): Promise<Record<string, unknown>> {
    return backend.request(`/${this.resolvedEndpoint}/${id}/duplicate/`, {
      method: "POST",
      body: JSON.stringify(options ?? {}),
    });
  }
}
```

---

## Open Questions

1. **Field constructors vs factory functions**: Should descriptors be `new
   DetailAction()` (class instances, like Alexi ORM fields) or
   `detailAction()` (factory functions, lighter syntax)?

   ```typescript
   // Option A: Class instances (consistent with ORM field style)
   publish = new DetailAction();
   current = new SingletonQuery();

   // Option B: Factory functions (lighter)
   publish = detailAction();
   current = singletonQuery();
   ```

2. **Registration style**: `endpoints` array in config (Option A) vs
   `RestRouter.register()` (Option B)? Config array is simpler; Router is more
   DRF-like. Could support both.

3. **Endpoint resolution for models without `meta.dbTable`**: Should
   `ModelEndpoint` auto-derive the endpoint from the model name (strip `Model`
   suffix, lowercase, pluralize), or require an explicit `endpoint` property?

4. **Type-safe action calls**: How strict should the `backend.action()` typing
   be? Full inference of valid action names from the endpoint class, or simpler
   string-based approach?

---

## Backwards Compatibility

This proposal is **fully backwards compatible**:

- `endpointMap` config continues to work (lowest priority in resolution)
- `getSpecialQueryHandlers()` override continues to work (merged with
  auto-generated handlers from `SingletonQuery` fields)
- `callModelAction()` continues to work alongside the new
  `backend.action()` API
- `ModelEndpoint` classes are opt-in — existing subclassing patterns remain
  valid

---

## Implementation Plan

### Phase 1: Core descriptor classes

- [x] Create `ModelEndpoint` base class
- [x] Create `DetailAction`, `ListAction`, `SingletonQuery` descriptor classes
- [x] Add `camelToKebab()` utility for action name → URL conversion
- [x] File: `alexi/src/db/backends/rest/endpoints.ts`
- [x] Add type guards: `isDetailAction()`, `isListAction()`, `isSingletonQuery()`, `isEndpointDescriptor()`
- [x] Add `introspectEndpoint()` and `introspectEndpoints()` functions
- [x] Add 58 unit tests (`alexi/src/db/tests/endpoints_test.ts`)

### Phase 2: RestBackend integration

- [x] Add `endpoints` option to `RestBackendConfig`
- [x] Implement `_registerEndpoints()` introspection logic
- [x] Auto-generate `SpecialQueryHandler` entries from `SingletonQuery` fields
- [x] Auto-generate endpoint map from `ModelEndpoint.model`
- [x] Add `backend.action()` type-safe method
- [x] Add `backend.getRegisteredActions()` and `backend.getEndpointIntrospections()` debug helpers
- [x] Ensure backwards compatibility with existing config options

### Phase 3: Update applications

- [x] Migrate `uplake-deno` RestBackend to use `ModelEndpoint` classes
  - `OrganisationEndpoint` with `current = new SingletonQuery()`
  - `UserEndpoint` with `current = new SingletonQuery()`
  - Removed `getSpecialQueryHandlers()` override
  - Slimmed `endpointMap` to only underscore/hyphen mismatches
- [x] Migrate `comachine-deno` RestBackend to use minimal config
  - Slimmed `endpointMap` to only underscore/hyphen mismatches (3 entries)
  - Added re-exports for declarative types for future use
- [x] Remove redundant `endpointMap` entries and `getSpecialQueryHandlers()` overrides

### Phase 4: Documentation

- [x] Update `AGENTS.md` with `ModelEndpoint` documentation and examples
- [x] Add examples for each descriptor type
- [x] Document migration path from old config to new declarative style
- [x] Updated Import Paths section with new imports
- [x] Added Updated Configuration Reference table with `endpoints` option

### Phase 5: Export updates

- [x] Export new classes from `@alexi/db/backends/rest`
- [x] Update `mod.ts` with new exports