/**
 * Alexi's built-in web server integration package.
 *
 * `@alexi/web` provides the app registration used for Alexi's server-side web
 * workflow, especially management-command driven development with `runserver`.
 * It represents the framework component that enables Django-style HTTP serving
 * in projects that expose APIs, HTML pages, admin routes, or other request/
 * response endpoints over the network.
 *
 * The root entrypoint is intentionally small because most of the user-facing
 * APIs for web applications live in neighboring packages such as `@alexi/core`,
 * `@alexi/urls`, `@alexi/middleware`, `@alexi/views`, and
 * `@alexi/restframework`. This package mainly exists so it can be installed as
 * an Alexi app and contribute server functionality through framework setup.
 *
 * This package is server-only and intended for Deno runtimes that can accept
 * HTTP requests.
 *
 * @module @alexi/web
 *
 * @example Enable the web app in project settings
 * ```ts
 * export const INSTALLED_APPS = [
 *   () => import("@alexi/web"),
 *   () => import("@myapp/web"),
 * ];
 * ```
 */

// =============================================================================
// Exports
// =============================================================================

// App configuration
export { default } from "./app.ts";
export { default as config } from "./app.ts";

// Commands are loaded dynamically via app.ts commandsModule
