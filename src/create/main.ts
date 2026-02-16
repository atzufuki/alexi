#!/usr/bin/env -S deno run -A
/**
 * @alexi/create - Project scaffolding CLI for Alexi
 *
 * Creates a full-stack Todo application with web, ui, and desktop apps.
 *
 * @example
 * ```bash
 * deno run -A jsr:@alexi/create my-project
 * cd my-project
 * deno task dev
 * ```
 *
 * @module @alexi/create
 */

import { parseArgs } from "./args.ts";
import { createProject } from "./project.ts";
import { printHelp, printVersion } from "./help.ts";

const VERSION = "0.15.0";

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
    console.error(
      "Usage: deno run -A jsr:@alexi/create <project-name>",
    );
    console.error("");
    console.error("Run with --help for more options.");
    return 1;
  }

  try {
    await createProject({
      name: args.projectName,
    });

    console.log("");
    console.log(`✓ Project "${args.projectName}" created successfully!`);
    console.log("");
    console.log("Next steps:");
    console.log(`  cd ${args.projectName}`);
    console.log("  deno task dev");
    console.log("");
    console.log("This will start:");
    console.log("  • Web server (REST API) on http://localhost:8000");
    console.log("  • UI server (frontend) on http://localhost:5173");
    console.log("  • Desktop WebUI window");
    console.log("");

    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    return 1;
  }
}

Deno.exit(await main());
