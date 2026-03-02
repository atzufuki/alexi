/**
 * deno.jsonc template generator
 *
 * @module @alexi/create/templates/root/deno_jsonc
 */

/**
 * Generate deno.jsonc content for a new full-stack project
 *
 * @param name - Project name
 * @param version - Alexi framework version (e.g. "0.29.0")
 */
export function generateDenoJsonc(name: string, version: string): string {
  const versionRange = `^${version}`;

  const config = {
    tasks: {
      dev:
        "deno run -A --unstable-kv --unstable-bundle manage.ts runserver --settings ./project/settings.ts",
      serve: "deno serve -A --unstable-kv project/http.ts",
      test: "deno test -A --unstable-kv",
      bundle:
        "deno run -A --unstable-kv --unstable-bundle manage.ts bundle --settings ./project/settings.ts",
      collectstatic:
        "deno run -A --unstable-kv --unstable-bundle manage.ts collectstatic --no-input --settings ./project/settings.ts",
    },
    imports: {
      // Alexi framework
      "@alexi/core": `jsr:@alexi/core@${versionRange}`,
      "@alexi/core/management": `jsr:@alexi/core@${versionRange}/management`,
      "@alexi/db": `jsr:@alexi/db@${versionRange}`,
      "@alexi/db/backends/denokv":
        `jsr:@alexi/db@${versionRange}/backends/denokv`,
      "@alexi/db/backends/indexeddb":
        `jsr:@alexi/db@${versionRange}/backends/indexeddb`,
      "@alexi/db/backends/rest": `jsr:@alexi/db@${versionRange}/backends/rest`,
      "@alexi/urls": `jsr:@alexi/urls@${versionRange}`,
      "@alexi/http": `jsr:@alexi/http@${versionRange}`,
      "@alexi/middleware": `jsr:@alexi/middleware@${versionRange}`,
      "@alexi/views": `jsr:@alexi/views@${versionRange}`,
      "@alexi/web": `jsr:@alexi/web@${versionRange}`,
      "@alexi/staticfiles": `jsr:@alexi/staticfiles@${versionRange}`,
      "@alexi/restframework": `jsr:@alexi/restframework@${versionRange}`,
      "@alexi/auth": `jsr:@alexi/auth@${versionRange}`,
      "@alexi/admin": `jsr:@alexi/admin@${versionRange}`,
      "@alexi/types": `jsr:@alexi/types@${versionRange}`,

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
