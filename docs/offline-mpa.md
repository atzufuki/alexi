# Offline-First MPA with Alexi and Service Workers

Alexi is a Django-inspired full-stack framework for Deno. Most of the time you
reach for it to build a REST API on the server and a client-side SPA in the
browser. But there is a second architecture hiding in plain sight — one that
trades the SPA model for something older and, in many ways, simpler: a
**Multi-Page Application running entirely inside a Service Worker**.

This guide walks through building an offline-first MPA with Alexi and
[HTMX](https://htmx.org). A cloud-hosted Alexi server provides the REST API. The
browser runs its own Alexi application inside a Service Worker, intercepts every
navigation and HTMX request, serves server-rendered HTML from local data, and
syncs with the cloud whenever a connection is available.

---

## The Architecture

```
┌─────────────────────────────────────────────────────┐
│  Browser                                            │
│                                                     │
│  ┌─────────────┐   fetch/navigate   ┌────────────┐  │
│  │  HTML page  │ ─────────────────► │  Service   │  │
│  │  + HTMX     │ ◄───────────────── │  Worker    │  │
│  └─────────────┘   HTML response    │            │  │
│                                     │  Alexi app │  │
│                                     │  ─────── │  │
│                                     │  URLs      │  │
│                                     │  Views     │  │
│                                     │  ORM       │  │
│                                     │  IndexedDB │  │
│                                     └─────┬──────┘  │
└───────────────────────────────────────────┼─────────┘
                                            │ sync (when online)
                                            ▼
                              ┌─────────────────────────┐
                              │  Cloud                  │
                              │  Alexi web server       │
                              │  REST API               │
                              └─────────────────────────┘
```

The key insight is that `Application.handler` — the heart of every Alexi
application — is a plain `(Request) => Promise<Response>` function. It has no
dependency on `Deno.serve()` or any other runtime-specific API. A Service Worker
intercepts HTTP requests using exactly that same interface. The two fit together
naturally.

---

## Why This Works

Alexi's internals were designed around Web-standard primitives:

| Component                               | Deno-specific APIs? | Works in SW? |
| --------------------------------------- | ------------------- | ------------ |
| `Application.handler`                   | None                | Yes          |
| URL routing (`@alexi/urls`)             | None                | Yes          |
| Middleware (`@alexi/middleware`)        | None                | Yes          |
| REST framework (`@alexi/restframework`) | None                | Yes          |
| IndexedDB backend                       | None (browser APIs) | Yes          |
| REST backend                            | None (`fetch` only) | Yes          |
| `templateView`                          | None                | Yes          |

The only parts of Alexi that use Deno-specific APIs (`Deno.serve`,
`Deno.readFile`, `Deno.openKv`) are the server-side infrastructure — the web
server command and the DenoKV backend. Those simply don't belong in a Service
Worker, and you don't need them there.

---

## Project Structure

A project using this architecture has two Alexi apps:

```
my-project/
├── manage.ts
├── deno.jsonc
├── project/
│   ├── web.settings.ts      # Cloud server settings
│   └── sw.settings.ts       # Service Worker bundle settings
└── src/
    ├── my-app-web/          # Cloud: REST API (DenoKV backend)
    │   ├── mod.ts
    │   ├── models.ts
    │   ├── serializers.ts
    │   ├── viewsets.ts
    │   └── urls.ts
    └── my-app-sw/           # Client: MPA Service Worker
        ├── mod.ts
        ├── models.ts        # Same model definitions
        ├── settings.ts      # Backend configuration
        ├── views.ts         # Server-renders HTML
        ├── urls.ts
        ├── sw.ts            # SW entry point
        └── static/
            └── my-app/
                └── index.html
```

The cloud app and the SW app share model definitions — same field types, same
`dbTable` names. They differ only in which backend they talk to.

---

## Setting Up the Service Worker App

### Settings

Backends are declared in the app's `settings.ts`. The `DATABASES` object maps
string keys to backend instances — the same keys are then passed to `.using()`
in views and sync code.

```typescript
// src/my-app-sw/settings.ts
import { IndexedDBBackend } from "@alexi/db/backends/indexeddb";
import { ModelEndpoint, RestBackend } from "@alexi/db/backends/rest";
import { NoteModel } from "./models.ts";

class NoteEndpoint extends ModelEndpoint {
  model = NoteModel;
  path = "/notes/";
}

export const DATABASES = {
  default: new IndexedDBBackend({ name: "my-app" }),
  remote: new RestBackend({
    apiUrl: "https://api.my-app.com/api",
    endpoints: [NoteEndpoint],
  }),
};
```

### Models

Model definitions are identical to any other Alexi app. The difference is only
in which backend gets injected at runtime.

```typescript
// src/my-app-sw/models.ts
import { AutoField, CharField, Manager, Model, TextField } from "@alexi/db";

export class NoteModel extends Model {
  id = new AutoField({ primaryKey: true });
  title = new CharField({ maxLength: 200 });
  body = new TextField({ blank: true });
  synced = new BooleanField({ default: false });

  static objects = new Manager(NoteModel);
  static meta = { dbTable: "notes" };
}
```

### Templates

SW views use Alexi's `templateView` with `.html` template files — the same way
views work on the server. The template engine resolves templates from the app's
`templates/` directory and supports Django-style variable substitution,
conditionals, loops, and template inheritance.

```
src/my-app-sw/
├── views.ts
├── urls.ts
└── templates/
    └── my-app/
        ├── base.html
        ├── note_list.html
        └── note_detail.html
```

A base template provides the page shell with HTMX:

```html
<!-- src/my-app-sw/templates/my-app/base.html -->
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <title>{% block title %}My App{% endblock %}</title>
    <script src="https://unpkg.com/htmx.org@2" defer></script>
    <link rel="stylesheet" href="/static/my-app/styles.css">
  </head>
  <body>
    <nav>
      <a hx-get="/notes/" hx-target="#content" hx-push-url="true">Notes</a>
      <button hx-post="/sync/" hx-target="#status">Sync</button>
      <span id="status"></span>
    </nav>
    <main id="content">
      {% block content %}{% endblock %}
    </main>
  </body>
</html>
```

List and detail templates extend the base:

```html
<!-- src/my-app-sw/templates/my-app/note_list.html -->
{% extends "my-app/base.html" %} {% block title %}Notes{% endblock %} {% block
content %}
<h1>Notes</h1>
<ul>
  {% for note in notes %}
  <li>
    <a hx-get="/notes/{{ note.id }}/" hx-target="#content" hx-push-url="true">
      {{ note.title }}
    </a>
  </li>
  {% endfor %}
</ul>
<a hx-get="/notes/add/" hx-target="#content" hx-push-url="true">Add note</a>
{% endblock %}
```

```html
<!-- src/my-app-sw/templates/my-app/note_detail.html -->
{% extends "my-app/base.html" %} {% block title %}{{ note.title }}{% endblock %}
{% block content %}
<h1>{{ note.title }}</h1>
<p>{{ note.body }}</p>
<note-actions note-id="{{ note.id }}"></note-actions>
<a hx-get="/notes/" hx-target="#content" hx-push-url="true">← Back</a>
{% endblock %}
```

Notice `<note-actions>` — Web Components work naturally here. The SW returns
plain HTML text, and the browser hydrates any custom elements it finds using the
component JS loaded from `/static/`.

### Views

Views use `templateView` exactly as on the server — pass a template path and a
context function. The `.using("default")` call refers to the key defined in
`settings.ts`:

```typescript
// src/my-app-sw/views.ts
import { templateView } from "@alexi/views";
import { NoteModel } from "./models.ts";

export const noteListView = templateView({
  templateName: "my-app/note_list.html",
  context: async () => ({
    notes: (await NoteModel.objects.using("default").orderBy("-id").fetch())
      .array().map((n) => ({
        id: n.id.get(),
        title: n.title.get(),
      })),
  }),
});

export const noteDetailView = templateView({
  templateName: "my-app/note_detail.html",
  context: async (_request, params) => {
    const note = await NoteModel.objects.using("default").get({
      id: Number(params.id),
    });
    return {
      note: {
        id: note.id.get(),
        title: note.title.get(),
        body: note.body.get(),
      },
    };
  },
});
```

### URL Routing

```typescript
// src/my-app-sw/urls.ts
import { path } from "@alexi/urls";
import { noteDetailView, noteListView } from "./views.ts";

export const urlpatterns = [
  path("notes/", noteListView, { name: "note-list" }),
  path("notes/:id/", noteDetailView, { name: "note-detail" }),
];
```

### The Service Worker Entry Point

The SW entry point wires the Alexi `Application` into the Service Worker `fetch`
event. It imports backends from `settings.ts` and connects them on install.

```typescript
// src/my-app-sw/sw.ts
import { Application } from "@alexi/core/management";
import { setup } from "@alexi/db";
import { urlpatterns } from "./urls.ts";
import { DATABASES } from "./settings.ts";

declare const self: ServiceWorkerGlobalScope;

const app = new Application({ urls: urlpatterns });

// Connect backends on SW install
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      await DATABASES.default.connect();
      await setup({ backend: DATABASES.default });
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Hand every navigation and HTMX request to Alexi
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Only intercept same-origin requests
  if (url.origin !== self.location.origin) return;

  // Let static files through to the network
  if (url.pathname.startsWith("/static/")) return;

  event.respondWith(app.handler(event.request));
});
```

### Registering the Service Worker

The `index.html` shell page registers the SW and bootstraps the first render. On
the very first visit the SW is not yet in control, so the page triggers an HTMX
request to the SW app's root view instead of reloading. HTMX swaps the response
into `#content` — no full page reload, no flash.

```html
<!-- src/my-app-sw/static/my-app/index.html -->
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <title>My App</title>
    <script src="https://unpkg.com/htmx.org@2" defer></script>
    <link rel="stylesheet" href="/static/my-app/styles.css">
  </head>
  <body>
    <div id="content"></div>
    <script>
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("/sw.js").then((reg) => {
          function render() {
            htmx.ajax("GET", location.href, {
              target: "#content",
              swap: "innerHTML",
            });
          }

          if (navigator.serviceWorker.controller) {
            // SW already in control — trigger the first HTMX render
            render();
          } else {
            // First visit — wait for the SW to activate, then render
            const worker = reg.installing || reg.waiting;
            worker.addEventListener("statechange", function () {
              if (this.state === "activated") render();
            });
          }
        });
      }
    </script>
  </body>
</html>
```

On subsequent visits the SW is already in control when the page loads, so the
HTMX request fires immediately and the initial render is instant.

---

## Bundling the Service Worker

The existing `bundle` management command handles this. Add a `bundle` config to
your SW app's `AppConfig`:

```typescript
// src/my-app-sw/mod.ts
import type { AppConfig } from "@alexi/types";

const config: AppConfig = {
  name: "my-app-sw",
  bundle: {
    entrypoint: "src/sw.ts",
    outputDir: "static/my-app",
    outputName: "sw.js",
  },
};

export default config;
```

Build:

```bash
deno task manage bundle --settings sw
```

This produces `src/my-app-sw/static/my-app/sw.js` — a single self-contained file
that the browser registers as a Service Worker.

For development with live reload:

```bash
deno task manage bundle --settings sw --watch
```

---

## Syncing with the Cloud

The cloud server is a standard Alexi web application with a REST API. Syncing is
just the ORM's `.using()` and `.save()` — backends are referenced by the string
keys defined in `settings.ts`.

### Pulling from the Cloud

```typescript
// Fetch notes from the REST API and cache them in IndexedDB
const remoteNotes = await NoteModel.objects
  .using("remote")
  .all()
  .fetch();

await remoteNotes.using("default").save();
```

### Pushing to the Cloud

```typescript
// Find unsynced local changes and push them
const unsynced = await NoteModel.objects
  .using("default")
  .filter({ synced: false })
  .fetch();

await unsynced.using("remote").save();

// Mark as synced locally
for (const note of unsynced.array()) {
  note.synced.set(true);
}
await unsynced.using("default").save();
```

### Triggering Sync

Sync can be triggered anywhere — on app load, on user action, or when the
browser comes back online:

```typescript
// In a view, after a write operation
self.addEventListener("online", async () => {
  await syncToCloud();
});

// Or expose a sync endpoint in the SW app itself
export async function syncView(request: Request): Promise<Response> {
  await syncToCloud();
  return Response.redirect("/notes/", 303);
}
```

Add it to your URL patterns and wire an HTMX button to it:

```html
<button hx-post="/sync/" hx-target="#status">Sync now</button>
```

---

## What You Get

**Full offline support** — The application works with no network connection.
Every page load and HTMX request is served by the local Alexi instance from
IndexedDB. The user experience is identical online and offline.

**MPA simplicity** — No client-side routing framework, no component lifecycle,
no hydration. The server renders HTML and HTMX swaps it in. Forms work. The back
button works. Deep links work. It is just HTTP.

**One codebase, two targets** — The cloud server and the SW app share model
definitions and can share serializer or utility code. The REST framework on the
cloud and the view layer in the SW are the same Alexi abstractions.

**Progressive enhancement** — The sync is explicit and in your control. You
decide when to pull from the cloud, when to push local changes, and how to
resolve conflicts. The ORM's `.using()` makes the mechanics transparent.

---

## Limitations

**Static files are served from the network.** The SW app does not serve CSS,
images, or other static assets — those are handled by the browser's normal cache
or a separate caching strategy. For full offline static file support, cache them
in the SW `install` event using the Cache API.

**HTTPS required in production.** Service Workers only register on secure
origins. `localhost` is exempt for development.
