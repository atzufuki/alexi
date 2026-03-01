/**
 * @alexi/create - Project scaffolding CLI for Alexi
 *
 * Creates new Alexi projects with a unified app structure.
 *
 * @example
 * ```bash
 * deno run -A jsr:@alexi/create myproject
 * ```
 *
 * @module @alexi/create
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
export { generateSharedSettings } from "./templates/project/settings_ts.ts";
export { generateWebSettings } from "./templates/project/web_settings_ts.ts";

// Unified app template generators
export { generateAppTs } from "./templates/unified/app_ts.ts";
export { generateModTs } from "./templates/unified/mod_ts.ts";
export { generateModelsTs } from "./templates/unified/models_ts.ts";
export { generateSerializersTs } from "./templates/unified/serializers_ts.ts";
export { generateViewsetsTs } from "./templates/unified/viewsets_ts.ts";
export { generateUrlsTs } from "./templates/unified/urls_ts.ts";
export { generateViewsTs } from "./templates/unified/views_ts.ts";
export { generateTodoTestTs } from "./templates/unified/test_ts.ts";
export { generateInitMigration } from "./templates/unified/migration_ts.ts";
export { generateStaticIndexHtml } from "./templates/unified/static_index_html.ts";

// Unified app — assets template generators
export { generateAssetModTs } from "./templates/unified/assets/mod_ts.ts";

// Unified app — worker template generators
export { generateWorkerAppTs } from "./templates/unified/workers/app_ts.ts";
export { generateWorkerModTs } from "./templates/unified/workers/mod_ts.ts";
export { generateWorkerModelsTs } from "./templates/unified/workers/models_ts.ts";
export { generateWorkerEndpointsTs } from "./templates/unified/workers/endpoints_ts.ts";
export { generateWorkerSettingsTs } from "./templates/unified/workers/settings_ts.ts";
export { generateWorkerUrlsTs } from "./templates/unified/workers/urls_ts.ts";
export { generateWorkerViewsTs } from "./templates/unified/workers/views_ts.ts";
export { generateWorkerBaseHtml } from "./templates/unified/workers/base_html.ts";
export { generateWorkerIndexHtml } from "./templates/unified/workers/index_html.ts";
