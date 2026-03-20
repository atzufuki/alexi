/**
 * Unified admin.ts template generator
 *
 * @module @alexi/create/templates/unified/admin_ts
 */

/**
 * Generate admin.ts content for the unified app
 */
export function generateAdminTs(name: string): string {
  const appName = toPascalCase(name);

  return `/**
 * ${appName} Admin Configuration
 *
 * Registers models with the admin panel. Visit /admin/ to manage content.
 * Log in with a superuser account created via:
 *
 *   deno run -A --unstable-kv manage.ts createsuperuser --settings ./project/settings.ts
 *
 * @module ${name}/admin
 */

import { AdminSite, ModelAdmin, register } from "@alexi/admin";
import { PostModel } from "@${name}/models.ts";

/**
 * Shared AdminSite instance.
 *
 * Imported by urls.ts to mount the admin panel at /admin/.
 */
export const adminSite = new AdminSite({
  title: "${appName} Admin",
  urlPrefix: "/admin",
});

/**
 * Admin configuration for PostModel.
 *
 * Exposes the full list of posts with search, filter, and ordering.
 */
@register(PostModel, adminSite)
export class PostAdmin extends ModelAdmin {
  listDisplay = ["id", "title", "published", "createdAt"];
  searchFields = ["title", "content"];
  listFilter = ["published"];
  ordering = ["-createdAt"];
}
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
