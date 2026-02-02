# Alexi Admin SPA

A Django-style admin interface built as a Single Page Application using HTML Props components.

## Overview

This admin application provides a web-based interface for managing models registered with `alexi_admin`. It follows the same patterns as the main `comachine` frontend application.

## Structure

```
app/
├── main.ts           # Entry point - initializes backend and mounts app
├── app.ts            # Main AdminApp component - routing and layout
├── index.css         # Global CSS styles
└── views/
    ├── mod.ts        # View exports
    ├── dashboard.ts  # Main dashboard showing all models
    ├── model_list.ts # List view for model instances
    └── model_detail.ts # Detail/edit view for single instance

public/
├── index.html        # HTML shell for the SPA
├── bundle.js         # Bundled JavaScript (generated)
└── bundle.css        # Bundled CSS (generated)
```

## Development

### Running the Dev Server

From the project root:

```bash
deno task admin:dev
```

Or from the `alexi_admin` directory:

```bash
deno run -A --unstable-kv --unstable-bundle dev_server.ts
```

The dev server will:
1. Bundle `app/main.ts` to `public/bundle.js`
2. Bundle `app/index.css` to `public/bundle.css`
3. Serve the SPA at `http://localhost:8001/admin/`
4. Watch for changes and auto-reload (HMR)

### Building for Production

```bash
deno task admin:bundle
```

This creates the bundled files in `public/` which are then served by the API server's admin middleware.

## Integration with API Server

The admin SPA is served by the `adminMiddleware` in `comachine-web`. When a request comes to `/admin/*`:

1. Static assets (`/admin/bundle.js`, `/admin/bundle.css`) are served from `alexi_admin/public/`
2. All other `/admin/*` routes return the SPA HTML shell
3. Client-side routing handles navigation within the app

## Architecture

### Routing

The app uses client-side routing with the History API:

- `/admin/` - Dashboard showing all registered models
- `/admin/:model/` - List view for a model
- `/admin/:model/add/` - Add new instance form
- `/admin/:model/:id/` - Edit existing instance

### Components

Built with HTML Props deklaratiivisesti (declaratively):

```typescript
render() {
  return new Container({
    dataset: { key: "my-container" },
    padding: "16px",
    content: new Column({
      gap: "8px",
      content: [
        new Heading2({ textContent: "Title" }),
        new Div({ textContent: "Content" }),
      ],
    }),
  });
}
```

### Data Loading

Data is fetched from the REST API at `/api/`:

```typescript
const response = await fetch(`/api/users/`, {
  headers: { "Content-Type": "application/json" },
  credentials: "include",
});
const data = await response.json();
```

## Model Configuration

Models are configured in `views/model_list.ts` and `views/model_detail.ts` with:

- Column definitions for list view
- Field definitions for detail/edit view
- API endpoint mapping

Example:

```typescript
const MODEL_CONFIGS: Record<string, ModelConfig> = {
  users: {
    name: "users",
    apiEndpoint: "/api/users/",
    verboseName: "User",
    verboseNamePlural: "Users",
    columns: [
      { field: "id", label: "ID" },
      { field: "email", label: "Email", isLink: true },
      { field: "firstName", label: "First Name" },
    ],
  },
};
```

## Styling

The app uses:
- CSS variables for theming (see `index.css`)
- Inline styles on components for layout
- Django admin-inspired color scheme (#417690 primary)

## Future Improvements

- [ ] Authentication/authorization checks
- [ ] Bulk actions (delete, etc.)
- [ ] Sorting and filtering
- [ ] Pagination
- [ ] Search functionality
- [ ] Dynamic model registration from backend
- [ ] Form validation
- [ ] File upload support