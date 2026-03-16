/**
 * Type augmentation for `Request.user` — **for use in tests and application
 * code only**.
 *
 * JSR prohibits `declare global` in published packages, so Alexi cannot ship
 * this augmentation as part of `@alexi/auth`.  Add it to your own project
 * (e.g. `src/types.d.ts`) to get type-safe access to `request.user`:
 *
 * ```ts
 * // src/types.d.ts  (not published to JSR)
 * import type { AuthenticatedUser } from "@alexi/auth";
 *
 * declare global {
 *   interface Request {
 *     user?: AuthenticatedUser | null;
 *   }
 * }
 * ```
 *
 * This file re-exports the same declaration for use in Alexi's own test suite.
 *
 * @internal
 */

import type { AuthenticatedUser } from "./decorators.ts";

declare global {
  interface Request {
    /**
     * The authenticated user attached by {@link AuthenticationMiddleware},
     * {@link loginRequired}, or {@link permissionRequired}.
     *
     * - `AuthenticatedUser` — request is authenticated
     * - `null` — request passed through `AuthenticationMiddleware` but is anonymous
     * - `undefined` — no auth middleware or decorator has processed the request
     */
    user?: AuthenticatedUser | null;
  }
}

export type {};
