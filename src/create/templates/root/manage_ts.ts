/**
 * manage.ts template generator
 *
 * @module @alexi/create/templates/root/manage_ts
 */

/**
 * Generate manage.ts content for a new project
 */
export function generateManageTs(): string {
  return `#!/usr/bin/env -S deno run -A --unstable-kv
/**
 * Django-style management entry point
 *
 * Run with:
 *   deno task dev     # Start the web server
 *   deno task test    # Run tests
 */

import { ManagementUtility } from "@alexi/core/management";

const management = new ManagementUtility();
await management.execute(Deno.args);
`;
}
