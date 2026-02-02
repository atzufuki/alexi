/**
 * Alexi WebUI
 *
 * Desktop application support using WebUI.
 * Provides native desktop windows for web applications.
 *
 * WebUI uses the user's installed browser as the GUI engine,
 * making desktop apps lightweight and portable.
 *
 * @module alexi_webui
 *
 * @example Usage in settings
 * ```ts
 * // desktop.settings.ts
 * export const INSTALLED_APPS = [
 *   "alexi_webui",
 *   "comachine-ui",
 * ];
 *
 * export const UI_APP = "comachine-ui";
 * export const API_URL = "http://localhost:8000/api";
 *
 * export const WEBUI = {
 *   title: "My App",
 *   width: 1400,
 *   height: 900,
 * };
 * ```
 *
 * @example Commands
 * ```bash
 * # Development - open desktop window
 * deno run -A manage.ts runserver --settings desktop
 *
 * # Production - build desktop app
 * deno run -A manage.ts build --settings desktop --target windows
 * deno run -A manage.ts build --settings desktop --target macos
 * deno run -A manage.ts build --settings desktop --target linux
 * ```
 */

// =============================================================================
// App Config
// =============================================================================

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
