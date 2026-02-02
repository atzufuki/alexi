/**
 * manage.ts template generator
 *
 * @module @alexi/create/templates/manage_ts
 */

/**
 * Generate manage.ts content for a new project
 */
export function generateManageTs(): string {
  return `#!/usr/bin/env -S deno run -A --unstable-kv
/**
 * Project Management CLI
 *
 * Django-style CLI tool for project management.
 *
 * @example Usage
 * \`\`\`bash
 * deno task dev              # Start development server
 * deno task bundle           # Bundle frontends
 * deno task collectstatic    # Collect static files for production
 * \`\`\`
 */

import { execute } from "@alexi/core";

// Execute management command
const exitCode = await execute();
Deno.exit(exitCode);
`;
}
