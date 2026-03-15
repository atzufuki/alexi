/**
 * Alexi's desktop application integration for WebUI.
 *
 * `@alexi/webui` provides the pieces needed to package an Alexi application as
 * a desktop app using WebUI. The primary entry point is
 * {@link getWebuiApplication}, which follows the same factory pattern as
 * `getHttpApplication()` from `@alexi/core`. Use it in `project/webui.ts` to
 * open the web server UI in a native desktop window.
 *
 * Other exports — {@link WebUILauncher} and {@link createDefaultBindings} —
 * are available for advanced use cases such as custom window management or
 * extending the native binding surface.
 *
 * WebUI integration is platform-specific and requires Deno environments that
 * can use FFI (`--unstable-ffi`) to launch native desktop windows.
 *
 * @module @alexi/webui
 *
 * @example Minimal desktop entry point (`project/webui.ts`)
 * ```ts
 * import { getWebuiApplication } from "@alexi/webui";
 *
 * const app = await getWebuiApplication({
 *   url: "http://localhost:8000/",
 *   webui: { title: "MyApp", width: 1400, height: 900 },
 * });
 *
 * await app.launch();
 * ```
 *
 * @example With custom bindings
 * ```ts
 * import { getWebuiApplication } from "@alexi/webui";
 *
 * const app = await getWebuiApplication({
 *   url: "http://localhost:8000/",
 *   bindings: {
 *     greet: (name: unknown) => `Hello, ${name}!`,
 *   },
 * });
 *
 * await app.launch();
 * ```
 */

// =============================================================================
// App Config
// =============================================================================

export { default } from "./app.ts";
export { default as appConfig } from "./app.ts";

// =============================================================================
// Factory
// =============================================================================

export { getWebuiApplication, WebuiApplication } from "./get_application.ts";

export type { GetWebuiApplicationSettings } from "./get_application.ts";

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
