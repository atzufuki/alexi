/**
 * AdminSite class for Alexi Admin
 *
 * This module defines the AdminSite class which manages model registrations
 * and provides URL routing for the admin interface.
 *
 * @module
 */

import type { Model } from "@alexi/db";
import { ModelAdmin } from "./model_admin.ts";
import type {
  AdminSiteOptions,
  ModelAdminClass,
  ModelClass,
} from "./options.ts";
import { DEFAULT_ADMIN_SITE_OPTIONS } from "./options.ts";

// =============================================================================
// AdminSite Class
// =============================================================================

/**
 * AdminSite manages model registrations and URL routing for the admin interface.
 *
 * @example
 * ```typescript
 * import { AdminSite, ModelAdmin } from "@alexi/admin";
 * import { UserModel } from "./models/mod.ts";
 *
 * const adminSite = new AdminSite({ title: "My Admin" });
 *
 * class UserAdmin extends ModelAdmin {
 *   listDisplay = ["id", "email", "isActive"];
 * }
 *
 * adminSite.register(UserModel, UserAdmin);
 *
 * export { adminSite };
 * ```
 */
export class AdminSite {
  /**
   * Site title shown in the header.
   */
  readonly title: string;

  /**
   * Header text.
   */
  readonly header: string;

  /**
   * URL prefix for admin routes.
   */
  readonly urlPrefix: string;

  /**
   * Additional CSS classes for the site.
   */
  readonly siteClasses: string[];

  /**
   * Registry of registered models and their ModelAdmin instances.
   */
  private _registry: Map<ModelClass, ModelAdmin> = new Map();

  /**
   * URL patterns cache (built lazily).
   */
  private _urlPatterns: Map<string, string> | null = null;

  constructor(options: AdminSiteOptions = {}) {
    const opts = { ...DEFAULT_ADMIN_SITE_OPTIONS, ...options };
    this.title = opts.title;
    this.header = opts.header;
    this.urlPrefix = this._normalizeUrlPrefix(opts.urlPrefix);
    this.siteClasses = opts.siteClasses;
  }

  // ===========================================================================
  // Model Registration
  // ===========================================================================

  /**
   * Register a model with the admin site.
   *
   * @param model - The model class to register
   * @param adminClass - Optional ModelAdmin class for customization
   * @throws Error if the model is already registered
   */
  register(model: ModelClass, adminClass?: ModelAdminClass): void {
    if (this._registry.has(model)) {
      throw new Error(`Model ${model.name} is already registered.`);
    }

    // Create admin instance
    let admin: ModelAdmin;
    if (adminClass) {
      admin = new adminClass();
    } else {
      admin = new ModelAdmin();
    }

    // Set model and site references
    admin.model = model;
    // deno-lint-ignore no-explicit-any
    (admin as any)._site = this;

    // Register
    this._registry.set(model, admin);

    // Invalidate URL patterns cache
    this._urlPatterns = null;
  }

  /**
   * Unregister a model from the admin site.
   *
   * @param model - The model class to unregister
   */
  unregister(model: ModelClass): void {
    this._registry.delete(model);
    this._urlPatterns = null;
  }

  /**
   * Check if a model is registered.
   */
  isRegistered(model: ModelClass): boolean {
    return this._registry.has(model);
  }

  /**
   * Get the ModelAdmin instance for a model.
   *
   * @param model - The model class
   * @returns The ModelAdmin instance or null if not registered
   */
  getModelAdmin(model: ModelClass): ModelAdmin {
    const admin = this._registry.get(model);
    if (!admin) {
      throw new Error(`Model ${model.name} is not registered.`);
    }
    return admin;
  }

  /**
   * Get the ModelAdmin instance by model name.
   *
   * @param name - The model class name
   * @returns The ModelAdmin instance or null if not found
   */
  getModelAdminByName(name: string): ModelAdmin | null {
    const lowerName = name.toLowerCase();
    for (const [model, admin] of this._registry) {
      if (model.name.toLowerCase() === lowerName) {
        return admin;
      }
    }
    return null;
  }

  /**
   * Get all registered model classes.
   */
  getRegisteredModels(): ModelClass[] {
    return Array.from(this._registry.keys());
  }

  /**
   * Get all registered ModelAdmin instances.
   */
  getModelAdmins(): ModelAdmin[] {
    return Array.from(this._registry.values());
  }

  // ===========================================================================
  // URL Management
  // ===========================================================================

  /**
   * Reverse a URL by name.
   *
   * @param name - The URL name (e.g., "admin:testarticle_changelist")
   * @param params - URL parameters to substitute
   * @returns The resolved URL path
   */
  reverse(name: string, params?: Record<string, string>): string {
    // Build URL patterns if not cached
    if (!this._urlPatterns) {
      this._buildUrlPatterns();
    }

    // Handle dashboard URL
    if (name === "admin:index") {
      return `${this.urlPrefix}/`;
    }

    // Parse the name: "admin:modelname_action"
    const match = name.match(/^admin:(\w+)_(\w+)$/);
    if (!match) {
      throw new Error(`Invalid URL name: ${name}`);
    }

    const [, modelName, action] = match;

    // Find the model admin
    const admin = this.getModelAdminByName(
      this._findModelByLowerName(modelName),
    );
    if (!admin) {
      throw new Error(`Model not found for URL: ${name}`);
    }

    // Build URL based on action
    switch (action) {
      case "changelist":
        return admin.getListUrl();
      case "add":
        return admin.getAddUrl();
      case "change":
        if (!params?.id) {
          throw new Error(`Missing required parameter 'id' for URL: ${name}`);
        }
        return admin.getDetailUrl(params.id);
      case "delete":
        if (!params?.id) {
          throw new Error(`Missing required parameter 'id' for URL: ${name}`);
        }
        return admin.getDeleteUrl(params.id);
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  /**
   * Find the original model name from lowercase name.
   */
  private _findModelByLowerName(lowerName: string): string {
    for (const model of this._registry.keys()) {
      if (model.name.toLowerCase() === lowerName) {
        return model.name;
      }
    }
    return "";
  }

  /**
   * Build URL patterns cache.
   */
  private _buildUrlPatterns(): void {
    this._urlPatterns = new Map();

    // Dashboard
    this._urlPatterns.set("admin:index", `${this.urlPrefix}/`);

    // Per-model URLs
    for (const [model, admin] of this._registry) {
      const modelName = model.name.toLowerCase();

      this._urlPatterns.set(
        `admin:${modelName}_changelist`,
        admin.getListUrl(),
      );
      this._urlPatterns.set(`admin:${modelName}_add`, admin.getAddUrl());
      this._urlPatterns.set(
        `admin:${modelName}_change`,
        `${admin.getListUrl()}:id/`,
      );
      this._urlPatterns.set(
        `admin:${modelName}_delete`,
        `${admin.getListUrl()}:id/delete/`,
      );
    }
  }

  /**
   * Normalize the URL prefix.
   */
  private _normalizeUrlPrefix(prefix: string): string {
    // Ensure leading slash
    let normalized = prefix.startsWith("/") ? prefix : `/${prefix}`;
    // Remove trailing slash
    normalized = normalized.endsWith("/")
      ? normalized.slice(0, -1)
      : normalized;
    return normalized;
  }

  // ===========================================================================
  // Display Helpers
  // ===========================================================================

  /**
   * Get app list for the dashboard.
   * Groups models by their module/app name.
   */
  getAppList(): Array<{
    name: string;
    models: Array<{
      model: ModelClass;
      admin: ModelAdmin;
      name: string;
      url: string;
    }>;
  }> {
    // For now, return a single app with all models
    const models = Array.from(this._registry.entries()).map(
      ([model, admin]) => ({
        model,
        admin,
        name: admin.getVerboseNamePlural(),
        url: admin.getListUrl(),
      }),
    );

    return [
      {
        name: "Models",
        models,
      },
    ];
  }
}

// =============================================================================
// Register Decorator
// =============================================================================

/**
 * Decorator to register a ModelAdmin with an AdminSite.
 *
 * @example
 * ```typescript
 * const site = new AdminSite();
 *
 * @register(Article, site)
 * class ArticleAdmin extends ModelAdmin {
 *   listDisplay = ["title", "createdAt"];
 * }
 * ```
 */
export function register(
  model: ModelClass,
  site: AdminSite,
): (target: ModelAdminClass) => void {
  return (target: ModelAdminClass) => {
    site.register(model, target);
  };
}
