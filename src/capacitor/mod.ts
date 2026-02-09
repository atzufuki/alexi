/**
 * Alexi Capacitor
 *
 * Mobile application support using Capacitor.
 * Provides native iOS and Android containers for web applications.
 *
 * Capacitor is a cross-platform native runtime that makes it easy
 * to build web apps that run natively on iOS, Android, and the web.
 *
 * @module alexi_capacitor
 *
 * @example Usage in settings
 * ```ts
 * // mobile.settings.ts
 * export const INSTALLED_APPS = [
 *   "alexi_capacitor",
 *   "comachine-ui",
 * ];
 *
 * export const UI_APP = "comachine-ui";
 * export const API_URL = "https://api.myapp.io";
 *
 * export const CAPACITOR = {
 *   appId: "io.myapp.app",
 *   appName: "My App",
 * };
 * ```
 *
 * @example Commands
 * ```bash
 * # Sync web bundle to native projects
 * deno run -A manage.ts sync --settings mobile
 *
 * # Development - run on simulator/emulator
 * deno run -A manage.ts runserver --settings mobile --target ios
 * deno run -A manage.ts runserver --settings mobile --target android
 *
 * # Production - build for app stores
 * deno run -A manage.ts build --settings mobile --target ios
 * deno run -A manage.ts build --settings mobile --target android
 * ```
 *
 * @note This module is a placeholder. Full implementation will require:
 * - Node.js/npm integration for Capacitor CLI
 * - Native project generation (ios/, android/ directories)
 * - Plugin API wrappers for Deno
 */

// =============================================================================
// App Config
// =============================================================================

export { default as appConfig } from "./app.ts";

// =============================================================================
// Note: Additional exports will be added as the module is implemented
// =============================================================================

/**
 * Capacitor is not yet fully implemented.
 *
 * Planned features:
 * - sync: Copy web bundle to native projects
 * - run: Launch iOS simulator or Android emulator
 * - build: Create production builds (.ipa, .apk, .aab)
 * - Plugin wrappers for common Capacitor plugins
 */
