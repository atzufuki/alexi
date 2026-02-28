# Django vs Alexi Comparison

This document compares Alexi with Django, highlighting similarities,
differences, and features unique to Alexi.

## Overview

| Aspect              | Django                        | Alexi                                 |
| ------------------- | ----------------------------- | ------------------------------------- |
| **Language**        | Python                        | TypeScript                            |
| **Runtime**         | Python (CPython, PyPy)        | Deno                                  |
| **Architecture**    | MVT (Model-View-Template)     | MVT (adapted for TypeScript)          |
| **Package Manager** | pip / PyPI                    | deno add / JSR                        |
| **Type System**     | Dynamic (optional type hints) | Static (TypeScript)                   |
| **Target**          | Server-side web apps          | Full-stack (server, browser, desktop) |

---

## Core Features

### ORM & Database

| Feature                     | Django | Alexi        | Notes                                      |
| --------------------------- | ------ | ------------ | ------------------------------------------ |
| Model definitions           | ✅     | ✅           | Similar syntax with field classes          |
| QuerySet API                | ✅     | ✅           | `filter()`, `exclude()`, `orderBy()`, etc. |
| Field types                 | ✅     | ✅           | CharField, IntegerField, ForeignKey, etc.  |
| Manager class               | ✅     | ✅           | `Model.objects`                            |
| Lookups (`__contains`, etc) | ✅     | ✅           | Same double-underscore syntax              |
| `select_related()`          | ✅     | ✅           | Eager loading for ForeignKey               |
| `prefetch_related()`        | ✅     | ❌ (planned) | —                                          |
| Reverse relations           | ✅     | ✅           | `relatedName` on ForeignKey                |
| Migrations                  | ✅     | ✅           | Deprecation-based rollbacks (no DOWN)      |
| Multiple databases          | ✅     | ✅           | `.using()` for backend selection           |
| Transactions                | ✅     | ✅           | `backend.atomic()`                         |
| Raw SQL                     | ✅     | ❌           | Not applicable to KV/IndexedDB backends    |
| Aggregations                | ✅     | ⚠️ (partial) | Basic Count, Sum supported                 |
| Q objects                   | ✅     | ⚠️ (partial) | Basic support                              |

### Database Backends

| Backend    | Django | Alexi                          |
| ---------- | ------ | ------------------------------ |
| PostgreSQL | ✅     | ✅                             |
| MySQL      | ✅     | ❌                             |
| SQLite     | ✅     | ✅ (via DenoKV)                |
| Oracle     | ✅     | ❌                             |
| DenoKV     | ❌     | ✅                             |
| IndexedDB  | ❌     | ✅ (browser)                   |
| REST API   | ❌     | ✅ (browser, maps ORM to HTTP) |

### REST Framework

| Feature             | Django REST Framework | Alexi REST Framework | Notes                                                  |
| ------------------- | --------------------- | -------------------- | ------------------------------------------------------ |
| Serializers         | ✅                    | ✅                   | Similar API                                            |
| ModelSerializer     | ✅                    | ✅                   | Auto-generates fields from model                       |
| ViewSets            | ✅                    | ✅                   | ModelViewSet, ReadOnlyModelViewSet                     |
| Routers             | ✅                    | ✅                   | DefaultRouter                                          |
| `@action` decorator | ✅                    | ✅                   | Custom actions on ViewSets                             |
| Filter backends     | ✅                    | ✅                   | QueryParamFilterBackend, etc.                          |
| Ordering            | ✅                    | ✅                   | OrderingFilter                                         |
| Search              | ✅                    | ✅                   | SearchFilter                                           |
| Pagination          | ✅                    | ✅                   | PageNumber, LimitOffset, Cursor                        |
| Throttling          | ✅                    | ✅                   | AnonRateThrottle, UserRateThrottle, ScopedRateThrottle |
| Permissions         | ✅                    | ✅                   | ViewSet permission_classes                             |
| Versioning          | ✅                    | ✅                   | URLPath, QueryParameter, AcceptHeader                  |
| Content negotiation | ✅                    | ✅                   | JSON, XML, CSV; custom renderers                       |
| Browsable API       | ✅                    | ✅                   | HTML interface; login/logout; forms                    |

### URL Routing

| Feature        | Django         | Alexi | Notes                    |
| -------------- | -------------- | ----- | ------------------------ |
| `path()`       | ✅             | ✅    | Same syntax              |
| `include()`    | ✅             | ✅    | Nested URL patterns      |
| URL parameters | `<int:id>`     | `:id` | Different syntax         |
| Named routes   | ✅             | ✅    | `{ name: "route-name" }` |
| `reverse()`    | ✅             | ✅    | Generate URLs from names |
| Regex patterns | ✅ (`re_path`) | ❌    | —                        |
| URL namespaces | ✅             | ❌    | —                        |

### Authentication

| Feature               | Django                 | Alexi                  |
| --------------------- | ---------------------- | ---------------------- |
| Session-based auth    | ✅                     | ❌                     |
| JWT authentication    | ❌ (via packages)      | ✅ (built-in)          |
| Token authentication  | ✅                     | ✅ (JWT)               |
| Login decorators      | ✅ (`@login_required`) | ✅ (`loginRequired()`) |
| Permission decorators | ✅                     | ✅ (`adminRequired()`) |
| User model            | ✅                     | ⚠️ (user-defined)      |
| Groups & permissions  | ✅                     | ❌                     |
| OAuth / Social auth   | ❌ (via packages)      | ❌                     |

### Middleware

| Feature             | Django       | Alexi         | Notes               |
| ------------------- | ------------ | ------------- | ------------------- |
| Middleware stack    | ✅           | ✅            | Similar pattern     |
| CORS middleware     | ❌ (package) | ✅ (built-in) | —                   |
| Logging middleware  | ❌ (custom)  | ✅ (built-in) | —                   |
| Error handling      | ✅           | ✅            | —                   |
| CSRF protection     | ✅           | ❌            | Not needed with JWT |
| Security middleware | ✅           | ❌            | —                   |

### Admin Panel

| Feature              | Django | Alexi | Notes               |
| -------------------- | ------ | ----- | ------------------- |
| Auto-generated admin | ✅     | ✅    | Similar API         |
| ModelAdmin           | ✅     | ✅    | Customization class |
| List display         | ✅     | ✅    | —                   |
| Search / filters     | ✅     | ✅    | —                   |
| Fieldsets            | ✅     | ✅    | —                   |
| Inline models        | ✅     | ❌    | —                   |
| Actions              | ✅     | ✅    | Bulk actions        |

### Management Commands

| Feature           | Django | Alexi                | Notes                |
| ----------------- | ------ | -------------------- | -------------------- |
| `manage.py` CLI   | ✅     | ✅ (`manage.ts`)     | Same concept         |
| Custom commands   | ✅     | ✅                   | Extend `BaseCommand` |
| `runserver`       | ✅     | ✅                   | —                    |
| `startproject`    | ✅     | ✅ (`@alexi/create`) | —                    |
| `startapp`        | ✅     | ✅                   | —                    |
| `test`            | ✅     | ✅                   | —                    |
| `collectstatic`   | ✅     | ✅                   | —                    |
| `makemigrations`  | ✅     | ✅                   | —                    |
| `migrate`         | ✅     | ✅                   | —                    |
| `showmigrations`  | ✅     | ✅                   | —                    |
| `createsuperuser` | ✅     | ✅                   | —                    |
| `shell`           | ✅     | ❌                   | Use `deno repl`      |

### Views & Templates

| Feature                 | Django | Alexi        | Notes                                            |
| ----------------------- | ------ | ------------ | ------------------------------------------------ |
| Template engine         | ✅     | ✅           | DTL-compatible syntax: `{{ }}`, `{% %}`, `{# #}` |
| Template inheritance    | ✅     | ✅           | `{% extends %}` / `{% block %}`                  |
| Template tags           | ✅     | ✅           | `{% for %}`, `{% if %}`, `{% include %}`         |
| Template registry       | ✅     | ✅           | Global `templateRegistry` singleton              |
| `templateView` helper   | ✅     | ✅           | Renders named template with context              |
| Auto-load from app dirs | ✅     | ✅           | `AppConfig.templatesDir`; auto-loaded by server  |
| Bundle embedding        | ❌     | ✅           | Templates embedded in SW bundles via `bundle`    |
| Custom template tags    | ✅     | ❌ (planned) | —                                                |
| Template filters        | ✅     | ❌ (planned) | —                                                |

### Static Files

| Feature             | Django      | Alexi | Notes                      |
| ------------------- | ----------- | ----- | -------------------------- |
| Static file serving | ✅          | ✅    | Development mode           |
| `collectstatic`     | ✅          | ✅    | Production                 |
| Finders             | ✅          | ✅    | AppDirectoriesFinder, etc. |
| Storage backends    | ✅          | ✅    | Firebase, Memory, custom   |
| ManifestStaticFiles | ✅          | ❌    | —                          |
| CDN support         | ✅ (config) | ❌    | —                          |

### File Storage

| Feature           | Django           | Alexi        | Notes                  |
| ----------------- | ---------------- | ------------ | ---------------------- |
| Storage API       | ✅               | ✅           | Django-style interface |
| FileField         | ✅               | ✅           | File upload field      |
| ImageField        | ✅               | ✅           | Image-specific field   |
| FileSystemStorage | ✅               | ❌ (planned) | Local filesystem       |
| S3Storage         | ✅ (via package) | ❌ (planned) | AWS S3                 |
| Firebase Storage  | ❌               | ✅           | Firebase Cloud Storage |
| MemoryStorage     | ❌               | ✅           | In-memory for testing  |

---

## Alexi-Only Features

Features available in Alexi that Django does not provide out of the box:

| Feature               | Description                                                       |
| --------------------- | ----------------------------------------------------------------- |
| **Isomorphic models** | Same ORM API runs on server (DenoKV) and browser (IndexedDB/REST) |
| **REST backend**      | ORM queries automatically map to REST API calls in the browser    |
| **QuerySet.save()**   | Bulk persist fetched objects                                      |
| **ModelEndpoint**     | Declarative REST endpoint configuration (DRF `@action` style)     |
| **WebUI integration** | Desktop application support using system browser                  |
| **Capacitor support** | Mobile app packaging for iOS/Android (placeholder)                |
| **TypeScript-first**  | Full static typing, IDE autocomplete, compile-time checks         |
| **Deno Deploy ready** | Native deployment to edge functions with built-in KV              |
| **No build step**     | Direct TypeScript execution, no transpilation needed              |
| **Import maps**       | Clean module resolution via `deno.json`                           |

---

## Django-Only Features

Features available in Django that Alexi does not currently provide:

| Feature                    | Description                                    |
| -------------------------- | ---------------------------------------------- |
| **MySQL/Oracle**           | MySQL, Oracle database support                 |
| **ORM raw SQL**            | Direct SQL queries                             |
| **Session authentication** | Server-side session management                 |
| **CSRF protection**        | Cross-site request forgery prevention          |
| **Form handling**          | Django Forms with validation                   |
| **Signals**                | Decoupled event system                         |
| **Caching framework**      | Multi-backend caching (Redis, Memcached, etc.) |
| **Email backend**          | Built-in email sending                         |
| **Internationalization**   | i18n/l10n support                              |
| **Syndication feeds**      | RSS/Atom feed generation                       |
| **Sitemaps**               | XML sitemap generation                         |
| **GIS support**            | GeoDjango for geographic data                  |
| **Content types**          | Generic relations framework                    |

---

## Key Differences

### Field Value Access

| Django               | Alexi                   |
| -------------------- | ----------------------- |
| `task.title`         | `task.title.get()`      |
| `task.title = "New"` | `task.title.set("New")` |

### QuerySet Execution

| Django                    | Alexi                        |
| ------------------------- | ---------------------------- |
| `Task.objects.all()`      | `Task.objects.all().fetch()` |
| Lazy by default, iterates | Explicit `.fetch()` required |

### URL Parameters

| Django                         | Alexi                     |
| ------------------------------ | ------------------------- |
| `path("users/<int:id>/", ...)` | `path("users/:id/", ...)` |

### Settings Configuration

| Django                      | Alexi                                    |
| --------------------------- | ---------------------------------------- |
| `INSTALLED_APPS = ["app"]`  | `INSTALLED_APPS = [() => import("app")]` |
| String-based app references | Import function references               |

### Async Support

| Django                          | Alexi                  |
| ------------------------------- | ---------------------- |
| Sync by default, async optional | Async-first throughout |

---

## Migration Guide

For developers coming from Django:

| Django Concept          | Alexi Equivalent                              |
| ----------------------- | --------------------------------------------- |
| `models.Model`          | `Model` from `@alexi/db`                      |
| `models.CharField`      | `CharField` from `@alexi/db`                  |
| `ModelSerializer` (DRF) | `ModelSerializer` from `@alexi/restframework` |
| `ModelViewSet` (DRF)    | `ModelViewSet` from `@alexi/restframework`    |
| `DefaultRouter` (DRF)   | `DefaultRouter` from `@alexi/restframework`   |
| `path()`, `include()`   | Same names from `@alexi/urls`                 |
| `@login_required`       | `loginRequired()` from `@alexi/auth`          |
| `python manage.py`      | `deno run -A manage.ts`                       |
| `pip install`           | `deno add jsr:@alexi/...`                     |

---

## When to Use Which

### Choose Django When

- You need MySQL or Oracle database support
- You need session-based authentication
- Your team is experienced with Python
- You need Django's mature ecosystem of packages

### Choose Alexi When

- You want TypeScript throughout the stack
- You need browser-side ORM (offline-first apps)
- You're deploying to edge functions (Deno Deploy)
- You want isomorphic code (server + browser)
- You're building desktop apps with web technologies
- You prefer Deno's security model and tooling
