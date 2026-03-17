/**
 * Alexi Static Files Commands
 *
 * Commands for static file handling, bundling, and serving.
 *
 * @module @alexi/staticfiles/commands
 */

export { BundleCommand } from "./bundle.ts";
export { CollectStaticCommand } from "./collectstatic.ts";
export { RunServerCommand } from "./runserver.ts";
export { buildSWBundle, DEFAULT_ASSET_LOADERS } from "./bundle.ts";
export type {
  BuildSWBundleOptions,
  DiscoveredTemplate,
  StaticFilesManifest,
} from "./bundle.ts";
