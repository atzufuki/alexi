# Deployment Guide

This guide covers deploying Alexi applications to production, with a focus on
Deno Deploy.

## Overview

Alexi applications can be deployed to:

- **Deno Deploy** — Recommended, native Deno support with edge functions
- **Self-hosted** — VPS, containers, or bare metal
- **Other platforms** — Any platform that supports Deno

---

## Deno Deploy

[Deno Deploy](https://deno.com/deploy) is a globally distributed platform for
serverless JavaScript/TypeScript applications. It's the recommended deployment
target for Alexi apps.

### Features

- **Edge computing** — Code runs close to users globally
- **Zero config** — Automatic TLS, scaling, and deployments
- **Deno KV** — Built-in distributed database (no setup required)
- **GitHub integration** — Automatic deployments on push

### Prerequisites

1. A [Deno Deploy](https://dash.deno.com) account
2. Your project in a GitHub repository
3. A working Alexi application

---

## Step 1: Prepare Your Application

### Update Settings for Production

Create or update `project/web.settings.ts` for production:

```ts
// project/web.settings.ts

// Use environment variables for sensitive data
export const DEBUG = Deno.env.get("DEBUG") === "true";
export const SECRET_KEY = Deno.env.get("SECRET_KEY") ??
  "change-me-in-production";

// Host configuration
export const DEFAULT_HOST = "0.0.0.0";
export const DEFAULT_PORT = parseInt(Deno.env.get("PORT") ?? "8000");

// Allowed hosts (for CORS)
export const ALLOWED_HOSTS = [
  "localhost",
  "127.0.0.1",
  Deno.env.get("DENO_DEPLOYMENT_ID") ? ".deno.dev" : "",
].filter(Boolean);

// Database - Deno KV works automatically on Deno Deploy
export const DATABASE = {
  engine: "denokv" as const,
  name: "myapp",
  // No path needed - Deno Deploy provides KV automatically
};

// Static files
export const STATIC_URL = "/static/";
export const STATIC_ROOT = "./staticfiles";

// CORS settings
export const CORS_ALLOWED_ORIGINS = Deno.env.get("CORS_ORIGINS")?.split(",") ??
  [
    "http://localhost:5173",
    "https://your-app.deno.dev",
  ];

// Installed apps
export const INSTALLED_APPS = [
  () => import("@alexi/staticfiles"),
  () => import("@alexi/web"),
  () => import("@alexi/db"),
  () => import("@alexi/auth"),
  () => import("@myapp/web"),
];

export const ROOT_URLCONF = () => import("@myapp/web/urls");
```

### Create an Entry Point for Deno Deploy

Create `main.ts` in your project root:

```ts
// main.ts - Entry point for Deno Deploy
import { Application } from "@alexi/core/management";
import { setup } from "@alexi/db";
import { DenoKVBackend } from "@alexi/db/backends/denokv";
import {
  corsMiddleware,
  errorHandlerMiddleware,
  loggingMiddleware,
} from "@alexi/middleware";
import { staticFilesMiddleware } from "@alexi/staticfiles";
import { urlpatterns } from "./src/myapp-web/urls.ts";
import * as settings from "./project/web.settings.ts";

// Initialize database
const backend = new DenoKVBackend({
  name: settings.DATABASE.name,
  // Deno Deploy provides KV automatically - no path needed
});
await backend.connect();
await setup({ backend });

// Create application
const app = new Application({
  urls: urlpatterns,
  middleware: [
    loggingMiddleware(),
    corsMiddleware({
      origins: settings.CORS_ALLOWED_ORIGINS,
      credentials: true,
    }),
    staticFilesMiddleware({
      installedApps: [],
      appPaths: {},
      staticUrl: settings.STATIC_URL,
      staticRoot: settings.STATIC_ROOT,
      debug: settings.DEBUG,
    }),
    errorHandlerMiddleware({
      includeStack: settings.DEBUG,
    }),
  ],
});

// Start server
const port = settings.DEFAULT_PORT;

console.log(`Starting server on port ${port}...`);

Deno.serve({ port }, app.handler);
```

### Bundle Static Files

Before deploying, collect and bundle your static files:

```bash
# Bundle frontend
deno run -A manage.ts bundle --settings ui

# Collect static files
deno run -A manage.ts collectstatic --no-input
```

---

## Step 2: Deploy to Deno Deploy

### Option A: GitHub Integration (Recommended)

1. **Push your code to GitHub**

   ```bash
   git add .
   git commit -m "Prepare for deployment"
   git push origin main
   ```

2. **Create a new project on Deno Deploy**

   - Go to [dash.deno.com](https://dash.deno.com)
   - Click "New Project"
   - Select "Deploy from GitHub"
   - Choose your repository
   - Set the entry point to `main.ts`

3. **Configure environment variables**

   In the Deno Deploy dashboard:

   - Go to Settings → Environment Variables
   - Add:
     - `SECRET_KEY` — A secure random string
     - `DEBUG` — `false`
     - `CORS_ORIGINS` — Your frontend URL(s)

4. **Deploy**

   Every push to `main` will automatically deploy.

### Option B: CLI Deployment

1. **Install `deployctl`**

   ```bash
   deno install -Arf jsr:@deno/deployctl
   ```

2. **Login to Deno Deploy**

   ```bash
   deployctl login
   ```

3. **Deploy**

   ```bash
   deployctl deploy --project=your-project-name main.ts
   ```

---

## Step 3: Configure Deno KV

Deno Deploy provides Deno KV automatically. No configuration needed!

### Accessing KV on Deploy

```ts
// This works automatically on Deno Deploy
const backend = new DenoKVBackend({
  name: "myapp",
  // No path needed - Deno Deploy provides KV
});
```

### Local Development with Deploy KV

To use your production KV database locally:

```bash
# Get connection string from Deno Deploy dashboard
# Settings → KV → Connect

# Run locally with remote KV
DENO_KV_ACCESS_TOKEN=your-token deno run -A --unstable-kv main.ts
```

---

## Step 4: Deploying Frontend (SPA)

For SPAs, you have several options:

### Option A: Same Deployment (Monolithic)

Serve the frontend from the same Alexi server:

```ts
// In your urls.ts
import { path } from "@alexi/urls";
import { staticServe } from "@alexi/staticfiles";

const serveSPA = async (request: Request) => {
  // Serve index.html for all non-API routes (SPA routing)
  const indexPath = "./staticfiles/myapp-ui/index.html";
  const content = await Deno.readTextFile(indexPath);
  return new Response(content, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
};

export const urlpatterns = [
  // API routes
  path("api/", include(apiRouter.urls)),
  
  // Static files
  path("static/<path:path>", staticServe({ ... })),
  
  // SPA fallback (must be last)
  path("<path:path>", serveSPA),
  path("", serveSPA),
];
```

### Option B: Separate Deployments

Deploy frontend and backend separately:

1. **Backend**: Deno Deploy (API only)
2. **Frontend**: Deno Deploy, Vercel, Netlify, or Cloudflare Pages

Frontend deployment example for Deno Deploy:

```ts
// frontend/main.ts
const indexHtml = await Deno.readTextFile("./dist/index.html");

Deno.serve((request) => {
  const url = new URL(request.url);

  // Try to serve static file
  try {
    const filePath = `./dist${url.pathname}`;
    const file = Deno.readFileSync(filePath);
    const contentType = getContentType(filePath);
    return new Response(file, {
      headers: { "Content-Type": contentType },
    });
  } catch {
    // Fallback to index.html for SPA routing
    return new Response(indexHtml, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
});
```

---

## Step 5: Environment Variables

### Required Variables

| Variable     | Description       | Example                      |
| ------------ | ----------------- | ---------------------------- |
| `SECRET_KEY` | JWT signing key   | `your-super-secret-key-here` |
| `DEBUG`      | Enable debug mode | `false`                      |

### Optional Variables

| Variable       | Description                       | Default                 |
| -------------- | --------------------------------- | ----------------------- |
| `PORT`         | Server port                       | `8000`                  |
| `CORS_ORIGINS` | Allowed origins (comma-separated) | `http://localhost:5173` |
| `DATABASE_URL` | External database URL             | -                       |

### Setting Variables in Deno Deploy

1. Go to your project dashboard
2. Navigate to Settings → Environment Variables
3. Add each variable

Or via CLI:

```bash
deployctl env set SECRET_KEY=your-secret-key
deployctl env set DEBUG=false
```

---

## Step 6: Custom Domains

### Add a Custom Domain

1. In Deno Deploy dashboard, go to Settings → Domains
2. Click "Add Domain"
3. Enter your domain (e.g., `api.myapp.com`)
4. Follow DNS configuration instructions

### DNS Configuration

Add these DNS records:

```
# For apex domain (myapp.com)
A     @    <Deno Deploy IP>

# For subdomain (api.myapp.com)
CNAME api  your-project.deno.dev
```

### Update CORS Settings

```ts
export const CORS_ALLOWED_ORIGINS = [
  "https://myapp.com",
  "https://www.myapp.com",
  "https://app.myapp.com",
];
```

---

## Production Checklist

Before going live, ensure:

### Security

- [ ] `SECRET_KEY` is set to a strong random value
- [ ] `DEBUG` is `false`
- [ ] CORS origins are properly configured
- [ ] Sensitive data is in environment variables
- [ ] HTTPS is enabled (automatic on Deno Deploy)

### Performance

- [ ] Static files are bundled and minified
- [ ] `collectstatic` has been run
- [ ] Database indexes are set up
- [ ] Caching headers are configured

### Reliability

- [ ] Error handling middleware is enabled
- [ ] Logging is configured
- [ ] Health check endpoint exists
- [ ] Monitoring is set up

### Example Health Check

```ts
// Add to your urls.ts
const healthCheck = async () => {
  return Response.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
};

export const urlpatterns = [
  path("health/", healthCheck),
  path("api/health/", healthCheck),
  // ... other routes
];
```

---

## Monitoring and Logs

### Viewing Logs

In Deno Deploy dashboard:

- Go to your project
- Click "Logs" tab
- View real-time and historical logs

Via CLI:

```bash
deployctl logs --project=your-project-name
```

### Adding Custom Logging

```ts
// Use console methods - they appear in Deno Deploy logs
console.log("Info message");
console.warn("Warning message");
console.error("Error message");

// Structured logging
console.log(JSON.stringify({
  level: "info",
  message: "User logged in",
  userId: 123,
  timestamp: new Date().toISOString(),
}));
```

---

## Troubleshooting

### "Module not found" Errors

Ensure all imports use the correct paths:

```ts
// ✅ Use JSR imports
import { Model } from "jsr:@alexi/db";

// ✅ Or use import map
import { Model } from "@alexi/db";
```

### KV Connection Issues

```ts
// Check if KV is available
try {
  const kv = await Deno.openKv();
  console.log("KV connected successfully");
} catch (error) {
  console.error("KV connection failed:", error);
}
```

### CORS Errors

Check that:

1. Origin is in `CORS_ALLOWED_ORIGINS`
2. `credentials: true` is set if using cookies
3. Preflight requests are handled

```ts
corsMiddleware({
  origins: ["https://your-frontend.com"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
});
```

### Deployment Fails

1. Check build logs in Deno Deploy dashboard
2. Test locally first:
   ```bash
   deno run -A --unstable-kv main.ts
   ```
3. Ensure all dependencies are available on JSR or npm

---

## Alternative Deployment Options

### Docker

```dockerfile
# Dockerfile
FROM denoland/deno:2.0.0

WORKDIR /app

# Cache dependencies
COPY deno.json deno.lock ./
RUN deno install

# Copy source
COPY . .

# Collect static files
RUN deno run -A manage.ts collectstatic --no-input

# Run
EXPOSE 8000
CMD ["deno", "run", "-A", "--unstable-kv", "main.ts"]
```

Build and run:

```bash
docker build -t myapp .
docker run -p 8000:8000 -e SECRET_KEY=your-secret myapp
```

### Fly.io

Create `fly.toml`:

```toml
app = "your-app-name"

[build]
  dockerfile = "Dockerfile"

[env]
  PORT = "8080"

[http_service]
  internal_port = 8080
  force_https = true

[[services.ports]]
  handlers = ["http"]
  port = 80

[[services.ports]]
  handlers = ["tls", "http"]
  port = 443
```

Deploy:

```bash
fly launch
fly secrets set SECRET_KEY=your-secret
fly deploy
```

### Railway

1. Connect your GitHub repository
2. Set environment variables in dashboard
3. Railway auto-detects Deno and deploys

---

## Summary

Deploying Alexi to Deno Deploy:

1. **Prepare** — Create `main.ts`, configure settings
2. **Bundle** — Run `collectstatic` for static files
3. **Deploy** — Connect GitHub or use `deployctl`
4. **Configure** — Set environment variables
5. **Monitor** — Check logs and set up alerts

For production applications, always:

- Use environment variables for secrets
- Enable HTTPS (automatic on Deno Deploy)
- Set up proper CORS
- Monitor logs and errors
