/**
 * Alexi Web - Web API Server Framework for Deno
 *
 * Provides the HTTP runserver command for web applications.
 * This module is responsible for serving Django-style web APIs.
 *
 * @module @alexi/web
 */

// =============================================================================
// Exports
// =============================================================================

// App configuration
export { default } from "./app.ts";
export { default as config } from "./app.ts";

// Commands are loaded dynamically via app.ts commandsModule
