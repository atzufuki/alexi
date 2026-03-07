/**
 * Alexi's desktop application integration for WebUI.
 *
 * `@alexi/webui` provides the pieces needed to package an Alexi application as
 * a desktop app using WebUI. The key exports are `WebUILauncher` for opening and
 * managing native windows backed by the user's installed browser engine,
 * `createDefaultBindings()` for wiring common desktop bindings, and the app
 * config used to register WebUI support with Alexi.
 *
 * This package is the desktop counterpart to Alexi's web stack: projects still
 * use the usual framework building blocks for URLs, views, templates, and data,
 * then use WebUI to host that experience in a local desktop shell. It is aimed
 * at desktop runtimes and local binaries rather than browser deployment.
 *
 * WebUI integration is platform-specific and requires Deno environments that can
 * use FFI and launch native desktop windows.
 *
 * @module @alexi/webui
 *
 * @example Register WebUI support in desktop settings
 * ```ts
 * export const INSTALLED_APPS = [
 *   () => import("@alexi/webui"),
 *   () => import("@myapp/desktop"),
 * ];
 * ```
 *
 * @example Create a launcher
 * ```ts
 * import { WebUILauncher } from "@alexi/webui";
 *
 * const launcher = new WebUILauncher({
 *   title: "My App",
 *   width: 1400,
 *   height: 900,
 * });
 * ```
 */

// =============================================================================
// App Config
// =============================================================================

export { default } from "./app.ts";
export { default as appConfig } from "./app.ts";

// =============================================================================
// Launcher
// =============================================================================

export { WebUILauncher } from "./launcher.ts";

export type { WebUIConfig, WebUILauncherOptions } from "./launcher.ts";

// =============================================================================
// Bindings
// =============================================================================

export { createDefaultBindings } from "./bindings.ts";

export type { WebUIBindings } from "./bindings.ts";
