/**
 * Unified views.ts template generator
 *
 * @module @alexi/create/templates/unified/views_ts
 */

/**
 * Generate views.ts content for the unified app (server-side views)
 */
export function generateViewsTs(name: string): string {
  return `/**
 * ${toPascalCase(name)} Views
 *
 * Server-side views for the app.
 *
 * @module ${name}/views
 */

export function homeView(_request: Request): Response {
  return Response.json({
    message: "Welcome to ${name}!",
  });
}

export function healthView(_request: Request): Response {
  return Response.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}
`;
}

/**
 * Convert kebab-case to PascalCase
 */
function toPascalCase(str: string): string {
  return str
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
}
