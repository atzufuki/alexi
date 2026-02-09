/**
 * Alexi Auth - Django-style Authentication for Deno
 *
 * Provides authentication utilities and management commands.
 * Similar to Django's django.contrib.auth.
 *
 * @module @alexi/auth
 */

// =============================================================================
// Exports
// =============================================================================

// App configuration
export { default } from "./app.ts";
export { default as config } from "./app.ts";

// Commands are loaded dynamically via app.ts commandsModule
