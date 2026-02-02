/**
 * Project generator for @alexi/create CLI
 *
 * @module @alexi/create/project
 */

import type { DatabaseBackend } from "./args.ts";
import { generateDenoJson } from "./templates/deno_json.ts";
import { generateManageTs } from "./templates/manage_ts.ts";
import { generateSettings } from "./templates/settings.ts";
import { generateAppTs } from "./templates/app_ts.ts";
import { generateModelsTs } from "./templates/models_ts.ts";
import { generateUrlsTs } from "./templates/urls_ts.ts";
import { generateViewsTs } from "./templates/views_ts.ts";
import { generateGitignore } from "./templates/gitignore.ts";
import { generateReadme } from "./templates/readme.ts";

export interface ProjectOptions {
  name: string;
  withRest: boolean;
  withAdmin: boolean;
  withAuth: boolean;
  database: DatabaseBackend;
  noInput: boolean;
}

/**
 * Create a new Alexi project
 */
export async function createProject(options: ProjectOptions): Promise<void> {
  const { name } = options;

  // Validate project name
  if (!isValidProjectName(name)) {
    throw new Error(
      `Invalid project name "${name}". Use lowercase letters, numbers, and hyphens only.`,
    );
  }

  // Check if directory already exists
  try {
    const stat = await Deno.stat(name);
    if (stat.isDirectory) {
      throw new Error(`Directory "${name}" already exists.`);
    }
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      throw error;
    }
  }

  console.log(`Creating project "${name}"...`);
  console.log("");

  // Create directory structure
  await createDirectories(name);

  // Generate files
  await generateFiles(name, options);

  console.log("✓ Created project structure");
}

/**
 * Validate project name
 */
function isValidProjectName(name: string): boolean {
  return /^[a-z][a-z0-9-]*$/.test(name);
}

/**
 * Create project directories
 */
async function createDirectories(name: string): Promise<void> {
  const dirs = [
    name,
    `${name}/project`,
    `${name}/src`,
    `${name}/src/${name}`,
    `${name}/src/${name}/tests`,
  ];

  for (const dir of dirs) {
    await Deno.mkdir(dir, { recursive: true });
    console.log(`  Created ${dir}/`);
  }
}

/**
 * Generate all project files
 */
async function generateFiles(
  name: string,
  options: ProjectOptions,
): Promise<void> {
  const files: Array<{ path: string; content: string }> = [
    // Root files
    {
      path: `${name}/deno.json`,
      content: generateDenoJson(name, options),
    },
    {
      path: `${name}/manage.ts`,
      content: generateManageTs(),
    },
    {
      path: `${name}/.gitignore`,
      content: generateGitignore(),
    },
    {
      path: `${name}/README.md`,
      content: generateReadme(name),
    },
    // Project settings
    {
      path: `${name}/project/settings.ts`,
      content: generateSettings(name, options),
    },
    // Default app
    {
      path: `${name}/src/${name}/app.ts`,
      content: generateAppTs(name),
    },
    {
      path: `${name}/src/${name}/models.ts`,
      content: generateModelsTs(name),
    },
    {
      path: `${name}/src/${name}/urls.ts`,
      content: generateUrlsTs(name),
    },
    {
      path: `${name}/src/${name}/views.ts`,
      content: generateViewsTs(name),
    },
    {
      path: `${name}/src/${name}/tests/basic_test.ts`,
      content: generateBasicTest(name),
    },
  ];

  for (const file of files) {
    await Deno.writeTextFile(file.path, file.content);
    console.log(`  Created ${file.path}`);
  }
}

/**
 * Generate basic test file
 */
function generateBasicTest(name: string): string {
  return `/**
 * Basic tests for ${name}
 */

import { assertEquals } from "jsr:@std/assert@1";

Deno.test("${name}: basic test", () => {
  assertEquals(1 + 1, 2);
});
`;
}
