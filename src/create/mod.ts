/**
 * @alexi/create - Project scaffolding CLI for Alexi
 *
 * Creates new Alexi projects with proper structure.
 *
 * @example
 * ```bash
 * deno run -A jsr:@alexi/create myproject
 * ```
 *
 * @module @alexi/create
 */

export { parseArgs } from "./args.ts";
export type { CreateArgs, DatabaseBackend } from "./args.ts";

export { createProject } from "./project.ts";
export type { ProjectOptions } from "./project.ts";

export { printHelp, printVersion } from "./help.ts";

// Template generators
export { generateDenoJson } from "./templates/deno_json.ts";
export { generateManageTs } from "./templates/manage_ts.ts";
export { generateSettings } from "./templates/settings.ts";
export { generateAppTs } from "./templates/app_ts.ts";
export { generateModelsTs } from "./templates/models_ts.ts";
export { generateUrlsTs } from "./templates/urls_ts.ts";
export { generateViewsTs } from "./templates/views_ts.ts";
export { generateGitignore } from "./templates/gitignore.ts";
export { generateReadme } from "./templates/readme.ts";
