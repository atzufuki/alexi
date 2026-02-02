#!/usr/bin/env -S deno run -A
/**
 * @alexi/create - Project scaffolding CLI for Alexi
 *
 * Creates new Alexi projects with proper structure.
 *
 * @example
 * ```bash
 * deno run -A jsr:@alexi/create myproject
 * ```
 *
 * @module @alexi/create
 */

import { parseArgs } from "./args.ts";
import { createProject } from "./project.ts";
import { printHelp, printVersion } from "./help.ts";

const VERSION = "0.6.0";

async function main(): Promise<number> {
  const args = parseArgs(Deno.args);

  if (args.help) {
    printHelp();
    return 0;
  }

  if (args.version) {
    printVersion(VERSION);
    return 0;
  }

  if (!args.projectName) {
    console.error("Error: Project name is required.");
    console.error("");
    console.error("Usage: deno run -A jsr:@alexi/create <project-name> [options]");
    console.error("");
    console.error("Run with --help for more options.");
    return 1;
  }

  try {
    await createProject({
      name: args.projectName,
      withRest: args.withRest,
      withAdmin: args.withAdmin,
      withAuth: args.withAuth,
      database: args.database,
      noInput: args.noInput,
    });

    console.log("");
    console.log(`✓ Project "${args.projectName}" created successfully!`);
    console.log("");
    console.log("Next steps:");
    console.log(`  cd ${args.projectName}`);
    console.log("  deno task dev");
    console.log("");

    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    return 1;
  }
}

Deno.exit(await main());
