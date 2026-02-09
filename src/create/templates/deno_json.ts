/**
 * deno.json template generator
 *
 * @module @alexi/create/templates/deno_json
 */

import type { ProjectOptions } from "../project.ts";

/**
 * Generate deno.json content for a new project
 */
export function generateDenoJson(
  name: string,
  options: ProjectOptions,
): string {
  const imports: Record<string, string> = {
    "@alexi/core": "jsr:@alexi/core@^0.6.0",
    "@alexi/db": "jsr:@alexi/db@^0.6.0",
    "@alexi/db/backends/denokv": "jsr:@alexi/db@^0.6.0/backends/denokv",
    "@alexi/db/backends/indexeddb": "jsr:@alexi/db@^0.6.0/backends/indexeddb",
    "@alexi/urls": "jsr:@alexi/urls@^0.6.0",
    "@alexi/http": "jsr:@alexi/http@^0.6.0",
    "@alexi/middleware": "jsr:@alexi/middleware@^0.6.0",
    "@alexi/views": "jsr:@alexi/views@^0.6.0",
    "@alexi/web": "jsr:@alexi/web@^0.6.0",
    "@alexi/staticfiles": "jsr:@alexi/staticfiles@^0.6.0",
  };

  if (options.withRest) {
    imports["@alexi/restframework"] = "jsr:@alexi/restframework@^0.6.0";
  }

  if (options.withAuth) {
    imports["@alexi/auth"] = "jsr:@alexi/auth@^0.6.0";
  }

  if (options.withAdmin) {
    imports["@alexi/admin"] = "jsr:@alexi/admin@^0.6.0";
  }

  // Add project-specific imports
  imports[`@${name}`] = `./src/${name}/mod.ts`;
  imports[`@${name}/models`] = `./src/${name}/models.ts`;
  imports[`@${name}/urls`] = `./src/${name}/urls.ts`;
  imports[`@${name}/views`] = `./src/${name}/views.ts`;

  const config = {
    tasks: {
      dev: "deno run -A --unstable-kv manage.ts runserver --settings web",
      test: "deno run -A --unstable-kv manage.ts test --settings web",
      bundle: "deno run -A --unstable-kv manage.ts bundle",
      collectstatic:
        "deno run -A --unstable-kv manage.ts collectstatic --no-input",
    },
    imports,
    compilerOptions: {
      lib: ["deno.ns", "esnext"],
      strict: true,
    },
  };

  return JSON.stringify(config, null, 2) + "\n";
}
