/**
 * Authentication module for Alexi REST Framework
 *
 * Provides DRF-style authentication classes that populate context.user
 * before permission checks are applied.
 *
 * @module @alexi/restframework/authentication
 *
 * @example JWT authentication with permission check
 * ```ts
 * import { ModelViewSet } from "@alexi/restframework";
 * import { JWTAuthentication, IsAuthenticated } from "@alexi/restframework";
 *
 * class ArticleViewSet extends ModelViewSet {
 *   authentication_classes = [JWTAuthentication];
 *   permission_classes = [IsAuthenticated];
 * }
 * ```
 *
 * @example Custom authenticator
 * ```ts
 * import { BaseAuthentication } from "@alexi/restframework";
 * import type { ViewSetContext } from "@alexi/restframework";
 *
 * class ApiKeyAuthentication extends BaseAuthentication {
 *   async authenticate(context: ViewSetContext) {
 *     const key = context.request.headers.get("X-API-Key");
 *     if (!key) return null;
 *     const user = await UserModel.objects.filter({ apiKey: key }).first();
 *     if (!user) return null;
 *     return { id: user.id.get(), email: user.email.get(), isAdmin: false };
 *   }
 * }
 * ```
 */

export { BaseAuthentication, JWTAuthentication } from "./authentication.ts";

export type {
  AuthenticatedUser,
  AuthenticationClass,
} from "./authentication.ts";
