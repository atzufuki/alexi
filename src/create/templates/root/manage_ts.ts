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
 *   deno task dev          # Start all servers
 *   deno task dev:web      # Web server only
 *   deno task dev:ui       # UI server only
 *   deno task dev:desktop  # Desktop app only
 *   deno task test         # Run tests
 */

import { ManagementUtility } from "@alexi/core";

const management = new ManagementUtility();
await management.execute(Deno.args);
`;
}
