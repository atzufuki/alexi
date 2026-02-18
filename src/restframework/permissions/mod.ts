/**
 * Permissions module for Alexi REST Framework
 *
 * @module @alexi/restframework/permissions
 */

export {
  AllowAny,
  And,
  BasePermission,
  DenyAll,
  IsAdminUser,
  IsAuthenticated,
  IsAuthenticatedOrReadOnly,
  Not,
  Or,
} from "./permission.ts";

export type { PermissionClass } from "./permission.ts";
