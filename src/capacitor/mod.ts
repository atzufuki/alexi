/**
 * Alexi's placeholder package for Capacitor-based mobile support.
 *
 * `@alexi/capacitor` is intended to host the framework integration for running
 * Alexi-powered web apps inside native iOS and Android shells via Capacitor. It
 * currently exposes app metadata only and serves mainly as a discovery point for
 * Alexi's planned mobile story.
 *
 * Today this package does not provide a complete implementation of sync, run,
 * or build flows. The primary export is the app config used to register the
 * package with Alexi, while the long-term direction is to add project tooling,
 * native project generation, and plugin wrappers aligned with Capacitor's
 * platform model.
 *
 * This is a tooling-oriented package with future dependencies on native mobile
 * build chains and the Capacitor CLI. It is not currently a complete runtime
 * integration layer.
 *
 * @module @alexi/capacitor
 *
 * @example Register the package in a mobile settings module
 * ```ts
 * export const INSTALLED_APPS = [
 *   () => import("@alexi/capacitor"),
 *   () => import("@myapp/mobile"),
 * ];
 * ```
 */

// =============================================================================
// App Config
// =============================================================================

export { default as appConfig } from "./app.ts";

// =============================================================================
// Note: Additional exports will be added as the module is implemented
// =============================================================================

/**
 * Capacitor support is not yet fully implemented.
 *
 * Planned features include bundle sync, simulator and emulator launch flows,
 * production mobile builds, and wrappers for common Capacitor plugins.
 */
