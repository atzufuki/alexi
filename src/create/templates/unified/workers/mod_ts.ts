/**
 * Worker mod.ts template generator (Service Worker entry point)
 *
 * @module @alexi/create/templates/unified/workers/mod_ts
 */

/**
 * Generate workers/<name>/mod.ts content
 */
export function generateWorkerModTs(name: string): string {
  return `/**
 * ${toPascalCase(name)} Worker Entry Point
 *
 * Service Worker entry point — bundled into static/${name}/worker.js.
 * Runs in the browser's Service Worker context, never on the Deno server.
 *
 * @module ${name}/workers/${name}/mod
 */

import { Application, setup } from "@alexi/core";
import { IndexedDBBackend } from "@alexi/db/backends/indexeddb";
import { urlpatterns } from "./urls.ts";

declare const self: ServiceWorkerGlobalScope;

const app = new Application({ urls: urlpatterns });

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const backend = new IndexedDBBackend({ name: "${name}" });
      await setup({ DATABASES: { default: backend } });
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
