/**
 * views.ts template generator
 *
 * @module @alexi/create/templates/views_ts
 */

/**
 * Generate views.ts content for a new app
 */
export function generateViewsTs(name: string): string {
  return `/**
 * ${name} Views
 *
 * Define your view functions here.
 *
 * @module ${name}/views
 */

// =============================================================================
// Views
// =============================================================================

/**
 * Home view - returns a welcome message
 */
export function homeView(_request: Request): Response {
  return new Response(
    JSON.stringify({
      message: "Welcome to ${name}!",
      docs: "https://github.com/atzufuki/alexi",
    }),
    {
      headers: { "Content-Type": "application/json" },
    },
  );
}

/**
 * Health check endpoint
 */
export function healthView(_request: Request): Response {
  return new Response(
    JSON.stringify({
      status: "ok",
      timestamp: new Date().toISOString(),
    }),
    {
      headers: { "Content-Type": "application/json" },
    },
  );
}
`;
}
