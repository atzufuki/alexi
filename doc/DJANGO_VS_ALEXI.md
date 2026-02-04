# Django vs Alexi - Feature Comparison

This document compares Django (Python) with Alexi (Deno/TypeScript) frameworks,
highlighting what's implemented, partially implemented, and what's missing.

---

## Legend

| Symbol | Meaning               |
| ------ | --------------------- |
| ✅     | Fully implemented     |
| 🔶     | Partially implemented |
| ❌     | Not implemented       |
| 🔮     | Planned / Placeholder |

---

## Core Framework

| Feature                 | Django                      | Alexi                      | Status | Notes                                  |
| ----------------------- | --------------------------- | -------------------------- | ------ | -------------------------------------- |
| **Management Commands** | `django.core.management`    | `alexi_core`               | ✅     | `manage.ts` CLI with command discovery |
| **WSGI/ASGI Handler**   | `django.core.handlers.wsgi` | `alexi_core` (Application) | ✅     | HTTP application with middleware chain |
| **Settings System**     | `django.conf.settings`      | `project/*.settings.ts`    | ✅     | Per-deployment settings files          |
| **URL Routing**         | `django.urls`               | `alexi_urls`               | ✅     | `path()`, `include()`, URL resolution  |
| **Signals**             | `django.dispatch`           | -                          | ❌     | Event/signal system not implemented    |
| **Caching**             | `django.core.cache`         | -                          | ❌     | No caching framework                   |
| **Email**               | `django.core.mail`          | -                          | ❌     | No email support                       |
| **Logging**             | `logging` (Python)          | Console logging            | 🔶     | Basic console logging only             |

---

## HTTP Layer

| Feature                | Django                                     | Alexi                 | Status | Notes                          |
| ---------------------- | ------------------------------------------ | --------------------- | ------ | ------------------------------ |
| **Request Object**     | `HttpRequest`                              | `Request` (Web API)   | ✅     | Uses native Fetch API Request  |
| **Response Object**    | `HttpResponse`                             | `Response` (Web API)  | ✅     | Uses native Fetch API Response |
| **JSON Response**      | `JsonResponse`                             | `Response.json()`     | ✅     | Native method                  |
| **File Response**      | `FileResponse`                             | Manual                | 🔶     | No dedicated class             |
| **Streaming Response** | `StreamingHttpResponse`                    | `ReadableStream`      | ✅     | Native streams                 |
| **Redirects**          | `HttpResponseRedirect`                     | `Response.redirect()` | ✅     | Native method                  |
| **Cookie Handling**    | `request.COOKIES`, `response.set_cookie()` | Headers API           | 🔶     | Manual cookie handling         |
| **Session Middleware** | `django.contrib.sessions`                  | -                     | ❌     | No session framework           |
| **CSRF Protection**    | `django.middleware.csrf`                   | -                     | ❌     | No CSRF middleware             |

---

## Middleware

| Feature                     | Django                            | Alexi                    | Status | Notes                            |
| --------------------------- | --------------------------------- | ------------------------ | ------ | -------------------------------- |
| **Middleware System**       | `MIDDLEWARE` setting              | `alexi_middleware`       | ✅     | Function-based middleware chain  |
| **CORS**                    | `django-cors-headers` (3rd party) | `corsMiddleware`         | ✅     | Built-in                         |
| **Logging**                 | Custom                            | `loggingMiddleware`      | ✅     | Request/response logging         |
| **Error Handling**          | Custom                            | `errorHandlerMiddleware` | ✅     | Catches exceptions, returns JSON |
| **Authentication**          | `AuthenticationMiddleware`        | JWT via decorators       | 🔶     | View-level, not middleware       |
| **GZip Compression**        | `GZipMiddleware`                  | -                        | ❌     | Not implemented                  |
| **Security Headers**        | `SecurityMiddleware`              | -                        | ❌     | Not implemented                  |
| **Clickjacking Protection** | `XFrameOptionsMiddleware`         | -                        | ❌     | Not implemented                  |

---

## Views

| Feature                  | Django                         | Alexi                   | Status | Notes                           |
| ------------------------ | ------------------------------ | ----------------------- | ------ | ------------------------------- |
| **Function-Based Views** | Functions                      | Functions               | ✅     | `(request, params) => Response` |
| **Class-Based Views**    | `View`, `TemplateView`, etc.   | -                       | ❌     | No CBV system                   |
| **Template View**        | `TemplateView`                 | `templateView()`        | ✅     | Function-based equivalent       |
| **Redirect View**        | `RedirectView`                 | -                       | ❌     | Not implemented                 |
| **Generic Views**        | `ListView`, `DetailView`, etc. | -                       | ❌     | Not implemented                 |
| **Decorators**           | `@login_required`, etc.        | `loginRequired()`, etc. | ✅     | Higher-order functions          |

---

## Templates

| Feature                  | Django                         | Alexi                       | Status | Notes                           |
| ------------------------ | ------------------------------ | --------------------------- | ------ | ------------------------------- |
| **Template Engine**      | Django Template Language       | `{{variable}}` substitution | 🔶     | Very basic variable replacement |
| **Template Inheritance** | `{% extends %}`, `{% block %}` | -                           | ❌     | Not implemented                 |
| **Template Tags**        | `{% if %}`, `{% for %}`, etc.  | -                           | ❌     | Not implemented                 |
| **Template Filters**     | `{{ value\|filter }}`          | -                           | ❌     | Not implemented                 |
| **Context Processors**   | `context_processors`           | Manual context              | 🔶     | Pass context manually           |
| **Template Loader**      | Multiple loaders               | File-based only             | 🔶     | Simple file loading             |

---

## Database / ORM

| Feature                | Django                          | Alexi                         | Status | Notes                     |
| ---------------------- | ------------------------------- | ----------------------------- | ------ | ------------------------- |
| **ORM**                | Django ORM                      | `alexi_db`                    | ✅     | Model, Manager, QuerySet  |
| **Model Definition**   | `models.Model`                  | `Model` class                 | ✅     | Similar field definitions |
| **Field Types**        | CharField, IntegerField, etc.   | CharField, IntegerField, etc. | ✅     | Core field types          |
| **Auto Fields**        | `AutoField`                     | `AutoField`                   | ✅     | Auto-incrementing IDs     |
| **Foreign Keys**       | `ForeignKey`                    | -                             | ❌     | No relation fields        |
| **Many-to-Many**       | `ManyToManyField`               | -                             | ❌     | No relation fields        |
| **One-to-One**         | `OneToOneField`                 | -                             | ❌     | No relation fields        |
| **QuerySet**           | `objects.filter()`, etc.        | `objects.filter()`, etc.      | ✅     | Basic querying            |
| **Aggregation**        | `annotate()`, `aggregate()`     | -                             | ❌     | Not implemented           |
| **Transactions**       | `transaction.atomic()`          | -                             | ❌     | Not implemented           |
| **Migrations**         | `makemigrations`, `migrate`     | -                             | ❌     | No migration system       |
| **Multiple Databases** | `using()`, routers              | Single backend                | 🔶     | One DB at a time          |
| **Database Backends**  | PostgreSQL, MySQL, SQLite, etc. | DenoKV, IndexedDB             | ✅     | Different backends        |
| **Raw SQL**            | `raw()`, `connection.cursor()`  | -                             | ❌     | Not implemented           |

---

## Forms

| Feature             | Django                  | Alexi | Status | Notes             |
| ------------------- | ----------------------- | ----- | ------ | ----------------- |
| **Form Classes**    | `forms.Form`            | -     | ❌     | No form framework |
| **Model Forms**     | `forms.ModelForm`       | -     | ❌     | Not implemented   |
| **Form Validation** | `is_valid()`, `clean()` | -     | ❌     | Not implemented   |
| **Form Rendering**  | `{{ form }}`            | -     | ❌     | Not implemented   |
| **Formsets**        | `formset_factory`       | -     | ❌     | Not implemented   |
| **Widgets**         | Input, Select, etc.     | -     | ❌     | Not implemented   |

---

## REST Framework

| Feature                 | Django REST Framework        | Alexi REST Framework  | Status | Notes                     |
| ----------------------- | ---------------------------- | --------------------- | ------ | ------------------------- |
| **Serializers**         | `Serializer`                 | `Serializer`          | ✅     | Field-based serialization |
| **Model Serializers**   | `ModelSerializer`            | `ModelSerializer`     | 🔶     | Basic implementation      |
| **ViewSets**            | `ViewSet`, `ModelViewSet`    | `ModelViewSet`        | ✅     | CRUD operations           |
| **Routers**             | `DefaultRouter`              | `Router`              | ✅     | URL generation            |
| **Pagination**          | `PageNumberPagination`, etc. | -                     | ❌     | Not implemented           |
| **Filtering**           | `django-filter`              | QuerySet filtering    | 🔶     | Basic filtering only      |
| **Searching**           | `SearchFilter`               | -                     | ❌     | Not implemented           |
| **Ordering**            | `OrderingFilter`             | -                     | ❌     | Not implemented           |
| **Throttling**          | `UserRateThrottle`, etc.     | -                     | ❌     | Not implemented           |
| **Versioning**          | URL, header, etc.            | -                     | ❌     | Not implemented           |
| **Authentication**      | Token, Session, JWT, etc.    | JWT                   | ✅     | JWT implementation        |
| **Permissions**         | `IsAuthenticated`, etc.      | `loginRequired`, etc. | ✅     | Decorator-based           |
| **Content Negotiation** | Multiple renderers           | JSON only             | 🔶     | JSON responses only       |
| **Browsable API**       | HTML interface               | -                     | ❌     | Not implemented           |

---

## Authentication

| Feature                     | Django                            | Alexi                            | Status | Notes                 |
| --------------------------- | --------------------------------- | -------------------------------- | ------ | --------------------- |
| **User Model**              | `auth.User`                       | `UserModel`                      | ✅     | Custom implementation |
| **Password Hashing**        | `make_password`, `check_password` | `hashPassword`, `verifyPassword` | ✅     | Argon2                |
| **Login/Logout**            | `login()`, `logout()`             | JWT tokens                       | ✅     | Token-based           |
| **Authentication Backends** | Multiple backends                 | JWT only                         | 🔶     | Single backend        |
| **Permissions**             | `has_perm()`                      | `isAdmin` check                  | 🔶     | Basic role check      |
| **Groups**                  | `Group` model                     | -                                | ❌     | Not implemented       |
| **Password Reset**          | Email-based                       | -                                | ❌     | Not implemented       |
| **Social Auth**             | `django-allauth` (3rd party)      | -                                | ❌     | Not implemented       |

---

## Admin

| Feature                | Django                  | Alexi                  | Status | Notes                        |
| ---------------------- | ----------------------- | ---------------------- | ------ | ---------------------------- |
| **Admin Site**         | `django.contrib.admin`  | `alexi_admin`          | ✅     | SPA-based admin              |
| **Model Registration** | `admin.site.register()` | `adminSite.register()` | ✅     | Similar API                  |
| **ModelAdmin**         | `ModelAdmin` class      | `ModelAdmin` class     | ✅     | Configuration class          |
| **List Display**       | `list_display`          | `listDisplay`          | ✅     | Column configuration         |
| **List Filter**        | `list_filter`           | `listFilter`           | 🔶     | Basic filtering              |
| **Search Fields**      | `search_fields`         | `searchFields`         | 🔶     | Basic search                 |
| **Ordering**           | `ordering`              | `ordering`             | ✅     | Default ordering             |
| **Readonly Fields**    | `readonly_fields`       | `readonlyFields`       | ✅     | Non-editable fields          |
| **Fieldsets**          | `fieldsets`             | -                      | ❌     | Not implemented              |
| **Inlines**            | `InlineModelAdmin`      | -                      | ❌     | Not implemented              |
| **Actions**            | `actions`               | -                      | ❌     | Bulk actions not implemented |
| **Custom Views**       | `get_urls()`            | -                      | ❌     | Not implemented              |

---

## Static Files

| Feature              | Django                       | Alexi                   | Status | Notes                  |
| -------------------- | ---------------------------- | ----------------------- | ------ | ---------------------- |
| **Static Files**     | `django.contrib.staticfiles` | `alexi_staticfiles`     | ✅     | Static file serving    |
| **collectstatic**    | `collectstatic` command      | `collectstatic` command | ✅     | Collect to STATIC_ROOT |
| **Static Finders**   | `STATICFILES_FINDERS`        | `finders.ts`            | ✅     | App-based finding      |
| **Static Storage**   | `STATICFILES_STORAGE`        | `storage.ts`            | 🔶     | Basic implementation   |
| **Manifest Storage** | Hashed filenames             | -                       | ❌     | No cache busting       |
| **Bundling**         | Webpack/etc. (external)      | `bundle` command        | ✅     | Built-in esbuild       |
| **HMR**              | External tools               | Built-in                | ✅     | Hot module replacement |

---

## Testing

| Feature            | Django                    | Alexi           | Status | Notes                |
| ------------------ | ------------------------- | --------------- | ------ | -------------------- |
| **Test Framework** | `django.test`             | `Deno.test()`   | ✅     | Native Deno testing  |
| **Test Client**    | `Client`                  | Playwright      | ✅     | E2E testing          |
| **Test Database**  | Automatic                 | `test` command  | ✅     | Isolated test DB     |
| **Fixtures**       | JSON/YAML fixtures        | ORM seeding     | 🔶     | Manual data creation |
| **Factory Boy**    | `factory_boy` (3rd party) | -               | ❌     | No factory library   |
| **Coverage**       | `coverage.py`             | `deno coverage` | ✅     | Native Deno coverage |

---

## Internationalization (i18n)

| Feature                  | Django                 | Alexi          | Status | Notes             |
| ------------------------ | ---------------------- | -------------- | ------ | ----------------- |
| **Translation**          | `gettext`, `_()`       | `_()` function | ✅     | Basic translation |
| **Language Detection**   | Middleware             | -              | ❌     | Not implemented   |
| **Locale Middleware**    | `LocaleMiddleware`     | -              | ❌     | Not implemented   |
| **Translation Files**    | `.po`, `.mo` files     | JSON files     | 🔶     | Different format  |
| **Pluralization**        | `ngettext`             | -              | ❌     | Not implemented   |
| **Date/Time Formatting** | `django.utils.formats` | -              | ❌     | Not implemented   |

---

## Deployment

| Feature                | Django            | Alexi             | Status | Notes              |
| ---------------------- | ----------------- | ----------------- | ------ | ------------------ |
| **Development Server** | `runserver`       | `runserver`       | ✅     | Multiple variants  |
| **Production Server**  | Gunicorn, uWSGI   | `Deno.serve()`    | ✅     | Native Deno server |
| **Static Serving**     | WhiteNoise, nginx | Built-in          | ✅     | Static middleware  |
| **Desktop App**        | -                 | `alexi_webui`     | ✅     | WebUI-based        |
| **Mobile App**         | -                 | `alexi_capacitor` | 🔮     | Placeholder        |

---

## Summary Statistics

| Category       | Implemented | Partial | Missing | Total   |
| -------------- | ----------- | ------- | ------- | ------- |
| Core Framework | 5           | 1       | 4       | 10      |
| HTTP Layer     | 5           | 2       | 2       | 9       |
| Middleware     | 4           | 1       | 3       | 8       |
| Views          | 3           | 0       | 3       | 6       |
| Templates      | 0           | 3       | 3       | 6       |
| Database/ORM   | 7           | 1       | 7       | 15      |
| Forms          | 0           | 0       | 6       | 6       |
| REST Framework | 6           | 3       | 7       | 16      |
| Authentication | 3           | 2       | 3       | 8       |
| Admin          | 7           | 2       | 4       | 13      |
| Static Files   | 5           | 1       | 1       | 7       |
| Testing        | 4           | 1       | 1       | 6       |
| i18n           | 1           | 1       | 3       | 5       |
| Deployment     | 4           | 0       | 0       | 4       |
| **Total**      | **54**      | **18**  | **47**  | **119** |

**Coverage: ~60% implemented or partially implemented**

---

## Priority Features to Implement

### High Priority (Core Functionality)

1. **Foreign Key / Relations** - Essential for real-world data models
2. **Migrations** - Database schema management
3. **Session Middleware** - Stateful user sessions
4. **Pagination** - REST API pagination

### Medium Priority (Developer Experience)

5. **Class-Based Views** - Reusable view logic
6. **Form Framework** - Input validation and handling
7. **Signals** - Event-driven architecture
8. **CSRF Protection** - Security for forms

### Lower Priority (Nice to Have)

9. **Template Engine** - Full template inheritance
10. **Caching Framework** - Performance optimization
11. **Email Support** - Notifications
12. **Browsable API** - REST framework HTML interface

---

## Alexi-Specific Features (Not in Django)

| Feature                 | Description                          |
| ----------------------- | ------------------------------------ |
| **TypeScript**          | Full type safety throughout          |
| **Deno Runtime**        | Secure by default, native TypeScript |
| **DenoKV Backend**      | Key-value storage with consistency   |
| **IndexedDB Backend**   | Browser-side database                |
| **WebUI Desktop**       | Native-like desktop apps             |
| **Built-in Bundling**   | esbuild integration                  |
| **Built-in HMR**        | Hot module replacement               |
| **SPA Support**         | Single-page app serving              |
| **Multiple Runservers** | Web, static, desktop variants        |
