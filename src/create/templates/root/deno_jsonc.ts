/**
 * deno.jsonc template generator
 *
 * @module @alexi/create/templates/root/deno_jsonc
 */

/**
 * Generate deno.jsonc content for a new full-stack project
 */
export function generateDenoJsonc(name: string): string {
  const config = {
    tasks: {
      "dev:web":
        "deno run -A --unstable-kv --unstable-bundle manage.ts runserver --settings web",
      "dev:ui":
        "deno run -A --unstable-kv --unstable-bundle manage.ts runserver --settings ui",
      "dev:desktop":
        "deno run -A --unstable-kv --unstable-bundle --unstable-ffi manage.ts runserver --settings desktop",
      dev: {
        description: "Start all servers (opens desktop app)",
        dependencies: ["dev:web", "dev:ui", "dev:desktop"],
      },
      test: "deno test -A --unstable-kv",
      bundle:
        "deno run -A --unstable-kv --unstable-bundle manage.ts bundle --settings web",
      collectstatic:
        "deno run -A --unstable-kv --unstable-bundle manage.ts collectstatic --no-input --settings web",
    },
    imports: {
      // Alexi framework
      "@alexi/core": "jsr:@alexi/core@^0.15",
      "@alexi/db": "jsr:@alexi/db@^0.15",
      "@alexi/db/backends/denokv": "jsr:@alexi/db@^0.15/backends/denokv",
      "@alexi/db/backends/indexeddb": "jsr:@alexi/db@^0.15/backends/indexeddb",
      "@alexi/db/backends/rest": "jsr:@alexi/db@^0.15/backends/rest",
      "@alexi/urls": "jsr:@alexi/urls@^0.15",
      "@alexi/http": "jsr:@alexi/http@^0.15",
      "@alexi/middleware": "jsr:@alexi/middleware@^0.15",
      "@alexi/views": "jsr:@alexi/views@^0.15",
      "@alexi/web": "jsr:@alexi/web@^0.15",
      "@alexi/webui": "jsr:@alexi/webui@^0.15",
      "@alexi/staticfiles": "jsr:@alexi/staticfiles@^0.15",
      "@alexi/restframework": "jsr:@alexi/restframework@^0.15",
      "@alexi/auth": "jsr:@alexi/auth@^0.15",
      "@alexi/admin": "jsr:@alexi/admin@^0.15",

      // HTML Props (frontend)
      "@html-props/core": "jsr:@html-props/core@^1.0.0-beta.6",
      "@html-props/built-ins": "jsr:@html-props/built-ins@^1.0.0-beta.7",
      "@html-props/layout": "jsr:@html-props/layout@^1.0.0-beta.9",
      "@html-props/signals": "jsr:@html-props/signals@^1.0.0-beta.2",

      // App imports (for INSTALLED_APPS import functions in settings)
      [`@${name}/web`]: `./src/${name}-web/mod.ts`,
      [`@${name}/web/urls`]: `./src/${name}-web/urls.ts`,
      [`@${name}/ui`]: `./src/${name}-ui/mod.ts`,
      [`@${name}/ui/urls`]: `./src/${name}-ui/urls.ts`,
      [`@${name}/desktop`]: `./src/${name}-desktop/mod.ts`,

      // App path imports (for imports within app code)
      [`@${name}-web/`]: `./src/${name}-web/`,
      [`@${name}-ui/`]: `./src/${name}-ui/`,
      [`@${name}-desktop/`]: `./src/${name}-desktop/`,
    },
    compilerOptions: {
      lib: ["deno.ns", "dom", "dom.iterable", "esnext"],
      strict: true,
    },
  };

  return JSON.stringify(config, null, 2) + "\n";
}
