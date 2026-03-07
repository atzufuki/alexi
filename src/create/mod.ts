/**
 * Alexi's project and app scaffolding toolkit.
 *
 * `@alexi/create` powers the Alexi project generator and exposes the template
 * and helper functions used to scaffold new projects, settings files, and app
 * modules. It is primarily intended for CLI and generator workflows rather than
 * normal runtime application code.
 *
 * The main starting points are `parseArgs()` for CLI argument handling and
 * `createProject()` for generating a project on disk. The remaining exports are
 * lower-level template builders used by the scaffolder to produce root files,
 * unified app modules, worker entrypoints, and starter HTML templates.
 *
 * Because this package writes files and creates project structure, it is a
 * server-side/tooling package rather than something to import into browser or
 * request-handling code.
 *
 * @module @alexi/create
 *
 * @example Scaffold a new project from the CLI
 * ```bash
 * deno run -A jsr:@alexi/create myproject
 * ```
 *
 * @example Use the project generator programmatically
 * ```ts
 * import { createProject } from "@alexi/create";
 *
 * await createProject({
 *   name: "myproject",
 *   directory: "./myproject",
 * });
 * ```
 */

// CLI
export { parseArgs } from "./args.ts";
export type { CreateArgs } from "./args.ts";

export { createProject } from "./project.ts";
export type { ProjectOptions } from "./project.ts";

export { printHelp, printVersion } from "./help.ts";

// Root template generators
export { generateDenoJsonc } from "./templates/root/deno_jsonc.ts";
export { generateGitignore } from "./templates/root/gitignore.ts";
export { generateManageTs } from "./templates/root/manage_ts.ts";
export { generateReadme } from "./templates/root/readme.ts";

// Project settings template generators
export { generateSettings } from "./templates/project/settings_ts.ts";

// Unified app template generators
export { generateAppTs } from "./templates/unified/app_ts.ts";
export { generateModTs } from "./templates/unified/mod_ts.ts";
export { generateModelsTs } from "./templates/unified/models_ts.ts";
export { generateSerializersTs } from "./templates/unified/serializers_ts.ts";
export { generateViewsetsTs } from "./templates/unified/viewsets_ts.ts";
export { generateUrlsTs } from "./templates/unified/urls_ts.ts";
export { generateViewsTs } from "./templates/unified/views_ts.ts";
export { generatePostTestTs } from "./templates/unified/test_ts.ts";
export { generateInitMigration } from "./templates/unified/migration_ts.ts";

// Unified app — assets template generators
export { generateAssetModTs } from "./templates/unified/assets/mod_ts.ts";

// Unified app — worker template generators
export { generateWorkerModTs } from "./templates/unified/workers/mod_ts.ts";
export { generateWorkerModelsTs } from "./templates/unified/workers/models_ts.ts";
export { generateWorkerEndpointsTs } from "./templates/unified/workers/endpoints_ts.ts";
export { generateWorkerSettingsTs } from "./templates/unified/workers/settings_ts.ts";
export { generateWorkerUrlsTs } from "./templates/unified/workers/urls_ts.ts";
export { generateWorkerViewsTs } from "./templates/unified/workers/views_ts.ts";
export { generateWorkerBaseHtml } from "./templates/unified/workers/base_html.ts";
export { generateWorkerIndexHtml } from "./templates/unified/workers/index_html.ts";
