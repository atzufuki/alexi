# @alexi/create

Project scaffolding CLI for Alexi.

## Usage

```bash
deno run -A jsr:@alexi/create my-project
```

This generates a unified full-stack project with a server app, Service Worker,
and bundled frontend assets all in one directory under `src/my-project/`.

The app's `mod.ts` exports a named `MyProjectConfig` that you register directly
in `INSTALLED_APPS` — no factory functions or separate `app.ts` files needed.

## Documentation

See [Project Scaffolding](../../docs/create/scaffolding.md) for details.
