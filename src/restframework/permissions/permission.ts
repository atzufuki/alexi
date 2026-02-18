/**
 * Permission classes for Alexi REST Framework
 *
 * Provides DRF-style permission classes for ViewSet-level access control.
 *
 * @module @alexi/restframework/permissions/permission
 */

import type { ViewSetContext } from "../viewsets/viewset.ts";

// ============================================================================
// Types
// ============================================================================

/**
 * Permission class constructor type
 */
export interface PermissionClass {
  new (): BasePermission;
}

// ============================================================================
// Base Permission
// ============================================================================

/**
 * Base permission class
 *
 * All permission classes should extend this class and implement
 * the hasPermission and/or hasObjectPermission methods.
 *
 * @example
 * ```ts
 * class IsProjectMember extends BasePermission {
 *   async hasObjectPermission(
 *     context: ViewSetContext,
 *     obj: ProjectModel
 *   ): Promise<boolean> {
 *     const userId = context.user?.id;
 *     return obj.members.includes(userId);
 *   }
 * }
 * ```
 */
export abstract class BasePermission {
  /**
   * Human-readable message shown when permission is denied
   */
  message = "Permission denied.";

  /**
   * Check if the request has permission to proceed
   *
   * This is called on every request before the view is executed.
   * Return true to allow the request, false to deny.
   *
   * @param context - The ViewSet context with request, params, action, and user
   * @returns true if permission is granted, false otherwise
   */
  abstract hasPermission(context: ViewSetContext): Promise<boolean> | boolean;

  /**
   * Check if the request has permission on a specific object
   *
   * This is called when accessing a specific object (retrieve, update, destroy).
   * By default, it delegates to hasPermission.
   *
   * @param context - The ViewSet context
   * @param obj - The object being accessed
   * @returns true if permission is granted, false otherwise
   */
  hasObjectPermission(
    context: ViewSetContext,
    _obj: unknown,
  ): Promise<boolean> | boolean {
    // Default: delegate to hasPermission
    return this.hasPermission(context);
  }
}

// ============================================================================
// Built-in Permission Classes
// ============================================================================

/**
 * Allow any access - no restrictions
 *
 * Use this to explicitly mark a ViewSet as publicly accessible.
 *
 * @example
 * ```ts
 * class PublicViewSet extends ModelViewSet {
 *   permission_classes = [AllowAny];
 * }
 * ```
 */
export class AllowAny extends BasePermission {
  override message = "Access allowed.";

  hasPermission(_context: ViewSetContext): boolean {
    return true;
  }

  override hasObjectPermission(
    _context: ViewSetContext,
    _obj: unknown,
  ): boolean {
    return true;
  }
}

/**
 * Deny all access
 *
 * Use this to completely block access to a ViewSet.
 * Useful for temporarily disabling endpoints.
 *
 * @example
 * ```ts
 * class MaintenanceViewSet extends ModelViewSet {
 *   permission_classes = [DenyAll];
 * }
 * ```
 */
export class DenyAll extends BasePermission {
  override message = "Access denied.";

  hasPermission(_context: ViewSetContext): boolean {
    return false;
  }

  override hasObjectPermission(
    _context: ViewSetContext,
    _obj: unknown,
  ): boolean {
    return false;
  }
}

/**
 * Only allow authenticated users
 *
 * Requires the user to be logged in (context.user must be set).
 *
 * @example
 * ```ts
 * class ProtectedViewSet extends ModelViewSet {
 *   permission_classes = [IsAuthenticated];
 * }
 * ```
 */
export class IsAuthenticated extends BasePermission {
  override message = "Authentication required.";

  hasPermission(context: ViewSetContext): boolean {
    return context.user != null && context.user.id != null;
  }
}

/**
 * Only allow admin users
 *
 * Requires the user to be logged in AND have isAdmin = true.
 *
 * @example
 * ```ts
 * class AdminOnlyViewSet extends ModelViewSet {
 *   permission_classes = [IsAdminUser];
 * }
 * ```
 */
export class IsAdminUser extends BasePermission {
  override message = "Admin access required.";

  hasPermission(context: ViewSetContext): boolean {
    return context.user != null && context.user.isAdmin === true;
  }
}

/**
 * Safe methods (GET, HEAD, OPTIONS) are allowed for anyone.
 * Unsafe methods (POST, PUT, PATCH, DELETE) require authentication.
 *
 * This is useful for public read access with protected writes.
 *
 * @example
 * ```ts
 * class ArticleViewSet extends ModelViewSet {
 *   permission_classes = [IsAuthenticatedOrReadOnly];
 * }
 * // GET /articles/ - anyone can read
 * // POST /articles/ - only authenticated users
 * ```
 */
export class IsAuthenticatedOrReadOnly extends BasePermission {
  override message = "Authentication required for this action.";

  /**
   * Safe HTTP methods that don't modify data
   */
  static readonly SAFE_METHODS = ["GET", "HEAD", "OPTIONS"];

  hasPermission(context: ViewSetContext): boolean {
    const method = context.request.method.toUpperCase();

    // Safe methods are always allowed
    if (IsAuthenticatedOrReadOnly.SAFE_METHODS.includes(method)) {
      return true;
    }

    // Unsafe methods require authentication
    return context.user != null && context.user.id != null;
  }
}

// ============================================================================
// Operator Permissions (AND, OR, NOT)
// ============================================================================

/**
 * Combine multiple permissions with AND logic
 *
 * All permissions must pass for access to be granted.
 *
 * @example
 * ```ts
 * // User must be authenticated AND admin
 * class AdminViewSet extends ModelViewSet {
 *   permission_classes = [And.of(IsAuthenticated, IsAdminUser)];
 * }
 * ```
 */
export class And extends BasePermission {
  private permissions: BasePermission[];

  constructor(...permissions: BasePermission[]) {
    super();
    this.permissions = permissions;
  }

  /**
   * Create an And permission from permission classes
   */
  static of(...classes: PermissionClass[]): And {
    return new And(...classes.map((cls) => new cls()));
  }

  async hasPermission(context: ViewSetContext): Promise<boolean> {
    for (const permission of this.permissions) {
      const result = await permission.hasPermission(context);
      if (!result) {
        this.message = permission.message;
        return false;
      }
    }
    return true;
  }

  override async hasObjectPermission(
    context: ViewSetContext,
    obj: unknown,
  ): Promise<boolean> {
    for (const permission of this.permissions) {
      const result = await permission.hasObjectPermission(context, obj);
      if (!result) {
        this.message = permission.message;
        return false;
      }
    }
    return true;
  }
}

/**
 * Combine multiple permissions with OR logic
 *
 * At least one permission must pass for access to be granted.
 *
 * @example
 * ```ts
 * // User must be admin OR owner
 * class ItemViewSet extends ModelViewSet {
 *   permission_classes = [Or.of(IsAdminUser, IsOwner)];
 * }
 * ```
 */
export class Or extends BasePermission {
  private permissions: BasePermission[];

  constructor(...permissions: BasePermission[]) {
    super();
    this.permissions = permissions;
    this.message = "None of the required permissions were satisfied.";
  }

  /**
   * Create an Or permission from permission classes
   */
  static of(...classes: PermissionClass[]): Or {
    return new Or(...classes.map((cls) => new cls()));
  }

  async hasPermission(context: ViewSetContext): Promise<boolean> {
    for (const permission of this.permissions) {
      const result = await permission.hasPermission(context);
      if (result) {
        return true;
      }
    }
    return false;
  }

  override async hasObjectPermission(
    context: ViewSetContext,
    obj: unknown,
  ): Promise<boolean> {
    for (const permission of this.permissions) {
      const result = await permission.hasObjectPermission(context, obj);
      if (result) {
        return true;
      }
    }
    return false;
  }
}

/**
 * Negate a permission
 *
 * Inverts the result of another permission.
 *
 * @example
 * ```ts
 * // Only allow non-admin users (e.g., for self-service endpoints)
 * class UserViewSet extends ModelViewSet {
 *   permission_classes = [Not.of(IsAdminUser)];
 * }
 * ```
 */
export class Not extends BasePermission {
  private permission: BasePermission;

  constructor(permission: BasePermission) {
    super();
    this.permission = permission;
    this.message = "Access denied.";
  }

  /**
   * Create a Not permission from a permission class
   */
  static of(cls: PermissionClass): Not {
    return new Not(new cls());
  }

  async hasPermission(context: ViewSetContext): Promise<boolean> {
    const result = await this.permission.hasPermission(context);
    return !result;
  }

  override async hasObjectPermission(
    context: ViewSetContext,
    obj: unknown,
  ): Promise<boolean> {
    const result = await this.permission.hasObjectPermission(context, obj);
    return !result;
  }
}
