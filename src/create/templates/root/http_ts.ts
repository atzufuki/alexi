/**
 * http.ts template generator (Deno Deploy production entrypoint)
 *
 * Generates the http.ts file — the production server entrypoint.
 * Named after the HTTP protocol, just as Django's wsgi.py is named
 * after the WSGI protocol.
 *
 * @module @alexi/create/templates/root/http_ts
 */

/**
 * Generate http.ts content for a new project
 */
export function generateHttpTs(name: string): string {
  return `/**
 * ${toPascalCase(name)} — HTTP Entry Point
 *
 * Production server entrypoint for Deno Deploy and \`deno serve\`.
 * Analogous to Django's wsgi.py — a thin shell that calls
 * getApplication(settings) and exports the result.
 *
 * Usage:
 *   deno serve -A --unstable-kv project/http.ts
 *   # or just deploy to Deno Deploy — it picks up the default export.
 *
 * @module http
 */

import { getApplication } from "@alexi/core";
import * as settings from "./settings.ts";

export default await getApplication(settings);
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
