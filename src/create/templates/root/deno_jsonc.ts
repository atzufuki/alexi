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
      dev:
        "deno run -A --unstable-kv --unstable-bundle manage.ts runserver --settings web",
      test: "deno test -A --unstable-kv",
      bundle:
        "deno run -A --unstable-kv --unstable-bundle manage.ts bundle --settings web",
      collectstatic:
        "deno run -A --unstable-kv --unstable-bundle manage.ts collectstatic --no-input --settings web",
    },
    imports: {
      // Alexi framework
      "@alexi/core": "jsr:@alexi/core@^0.18",
      "@alexi/db": "jsr:@alexi/db@^0.18",
      "@alexi/db/backends/denokv": "jsr:@alexi/db@^0.18/backends/denokv",
      "@alexi/db/backends/indexeddb": "jsr:@alexi/db@^0.18/backends/indexeddb",
      "@alexi/db/backends/rest": "jsr:@alexi/db@^0.18/backends/rest",
      "@alexi/urls": "jsr:@alexi/urls@^0.18",
      "@alexi/http": "jsr:@alexi/http@^0.18",
      "@alexi/middleware": "jsr:@alexi/middleware@^0.18",
      "@alexi/views": "jsr:@alexi/views@^0.18",
      "@alexi/web": "jsr:@alexi/web@^0.18",
      "@alexi/staticfiles": "jsr:@alexi/staticfiles@^0.18",
      "@alexi/restframework": "jsr:@alexi/restframework@^0.18",
      "@alexi/auth": "jsr:@alexi/auth@^0.18",
      "@alexi/admin": "jsr:@alexi/admin@^0.18",
      "@alexi/types": "jsr:@alexi/types@^0.18",

      // App imports — one entry point per app
      [`@${name}/`]: `./src/${name}/`,
      [`@${name}/workers`]: `./src/${name}/workers/${name}/mod.ts`,
      [`@${name}/workers/urls`]: `./src/${name}/workers/${name}/urls.ts`,
      [`@${name}/workers/`]: `./src/${name}/workers/${name}/`,
    },
    compilerOptions: {
      lib: ["deno.ns", "dom", "dom.iterable", "esnext"],
      strict: true,
    },
  };

  return JSON.stringify(config, null, 2) + "\n";
}
