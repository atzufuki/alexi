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

export function homeView(request: Request): Response {
  // Redirect to the SPA shell (Service Worker handles rendering)
  const url = new URL(request.url);
  return Response.redirect(
    \`\${url.protocol}//\${url.host}/static/${name}/index.html\`,
    302,
  );
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
