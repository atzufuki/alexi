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

import {
  alexi_management_commands,
  getCliApplication,
} from "@alexi/core/management";

const management = await getCliApplication({
  programName: "manage.ts",
  title: "Alexi Management Commands",
  usage: [
    "Usage:",
    "  deno task <command> [options]",
    "  deno run -A manage.ts <command> [options]",
  ],
  version: "Alexi Framework v0.8.0",
  commands: alexi_management_commands,
});
await management.execute(Deno.args);
`;
}
