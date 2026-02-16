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
export { generateDesktopSettings } from "./templates/project/desktop_settings_ts.ts";
export { generateSharedSettings } from "./templates/project/settings_ts.ts";
export { generateUiSettings as generateProjectUiSettings } from "./templates/project/ui_settings_ts.ts";
export { generateWebSettings } from "./templates/project/web_settings_ts.ts";

// Web app template generators
export { generateWebAppTs } from "./templates/web/app_ts.ts";
export { generateWebModTs } from "./templates/web/mod_ts.ts";
export { generateWebModelsTs } from "./templates/web/models_ts.ts";
export { generateWebSerializersTs } from "./templates/web/serializers_ts.ts";
export { generateWebUrlsTs } from "./templates/web/urls_ts.ts";
export { generateWebViewsetsTs } from "./templates/web/viewsets_ts.ts";

// UI app template generators
export { generateUiAppTs } from "./templates/ui/app_ts.ts";
export { generateUiEndpointsTs } from "./templates/ui/endpoints_ts.ts";
export { generateUiMainTs } from "./templates/ui/main_ts.ts";
export { generateUiModTs } from "./templates/ui/mod_ts.ts";
export { generateUiModelsTs } from "./templates/ui/models_ts.ts";
export { generateUiSettingsTs } from "./templates/ui/settings_ts.ts";
export { generateUiUrlsTs } from "./templates/ui/urls_ts.ts";
export { generateUiUtilsTs } from "./templates/ui/utils_ts.ts";
export { generateUiViewsTs } from "./templates/ui/views_ts.ts";
export { generateUiHomeTs } from "./templates/ui/templates/home_ts.ts";
export { generateUiComponentsModTs } from "./templates/ui/components/mod_ts.ts";

// Desktop app template generators
export { generateDesktopAppTs } from "./templates/desktop/app_ts.ts";
export { generateDesktopBindingsTs } from "./templates/desktop/bindings_ts.ts";
export { generateDesktopModTs } from "./templates/desktop/mod_ts.ts";
