/**
 * Routers module for Alexi REST Framework
 *
 * Provides automatic URL generation from ViewSets.
 *
 * @module @alexi/restframework/routers
 *
 * @example
 * ```ts
 * import { DefaultRouter } from "@alexi/restframework/routers";
 * import { AssetViewSet, TaskViewSet } from "./viewsets.ts";
 *
 * const router = new DefaultRouter();
 * router.register("assets", AssetViewSet);
 * router.register("tasks", TaskViewSet);
 *
 * // Use with Application
 * const app = new Application({
 *   urls: router.urls,
 * });
 *
 * // Generated routes:
 * // GET    /assets/          -> AssetViewSet.list
 * // POST   /assets/          -> AssetViewSet.create
 * // GET    /assets/:id/      -> AssetViewSet.retrieve
 * // PUT    /assets/:id/      -> AssetViewSet.update
 * // PATCH  /assets/:id/      -> AssetViewSet.partial_update
 * // DELETE /assets/:id/      -> AssetViewSet.destroy
 * ```
 */

// ============================================================================
// Routers
// ============================================================================

export { DefaultRouter, SimpleRouter } from "./default_router.ts";

export type { RegisterOptions } from "./default_router.ts";
