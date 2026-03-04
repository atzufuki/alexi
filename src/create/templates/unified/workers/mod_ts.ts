/**
 * Worker worker.ts template generator (Service Worker entry point)
 *
 * @module @alexi/create/templates/unified/workers/mod_ts
 */

/**
 * Generate workers/<name>/worker.ts content
 */
export function generateWorkerModTs(name: string): string {
  return `/**
 * ${toPascalCase(name)} Worker Entry Point
 *
 * Service Worker entry point — bundled into static/${name}/worker.js.
 * Runs in the browser's Service Worker context, never on the Deno server.
 *
 * Analogous to Django's wsgi.py / asgi.py — a thin shell that calls
 * getWorkerApplication(settings) and wires it to the SW lifecycle events.
 *
 * @module ${name}/workers/${name}/worker
 */

import { getWorkerApplication } from "@alexi/core";
import * as settings from "./settings.ts";

declare const self: ServiceWorkerGlobalScope;

let app: Awaited<ReturnType<typeof getWorkerApplication>>;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      try {
        app = await getWorkerApplication(settings);
      } catch (error) {
        console.error("[SW] install failed:", error);
        throw error;
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/static/")) return;
  event.respondWith(app.handler(event.request));
});
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
