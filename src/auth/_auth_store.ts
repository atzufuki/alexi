/**
 * Internal shared store for authenticated users attached to in-flight requests.
 *
 * Both {@link loginRequired}/{@link permissionRequired} decorators and
 * {@link AuthenticationMiddleware} write to this store; {@link getRequestUser}
 * reads from it.  Sharing the same `WeakMap` instance guarantees that a user
 * set by middleware is visible inside decorated views, and vice-versa.
 *
 * @module
 * @internal
 */

import type { AuthenticatedUser } from "./decorators.ts";

/**
 * Maps each in-flight `Request` to the authenticated user attached during
 * authentication.  Uses a `WeakMap` so entries are collected automatically
 * when the request object is GC'd.
 *
 * @internal
 */
export const _requestUsers = new WeakMap<Request, AuthenticatedUser>();

/**
 * Maps each in-flight `Request` to the full ORM model instance fetched from
 * the database when `AUTH_USER_MODEL` is configured on
 * {@link AuthenticationMiddleware}.  Populated only when the middleware is
 * configured with a `userModel` option.
 *
 * @internal
 */
export const _requestUserInstances = new WeakMap<Request, unknown>();
