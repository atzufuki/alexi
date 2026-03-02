/**
 * Project generator for @alexi/create CLI
 *
 * Generates a unified Posts application with a single app directory
 * containing server-side code, frontend assets, and Service Worker.
 *
 * @module @alexi/create/project
 */

// Template imports - Root files
import { generateDenoJsonc } from "./templates/root/deno_jsonc.ts";
import { generateHttpTs } from "./templates/root/http_ts.ts";
import { generateManageTs } from "./templates/root/manage_ts.ts";
import { generateGitignore } from "./templates/root/gitignore.ts";
import { generateReadme } from "./templates/root/readme.ts";

// Template imports - Project settings
import { generateSettings } from "./templates/project/settings_ts.ts";

// Template imports - Unified app (server-side)
import { generateAppTs } from "./templates/unified/app_ts.ts";
import { generateModTs } from "./templates/unified/mod_ts.ts";
import { generateModelsTs } from "./templates/unified/models_ts.ts";
import { generateSerializersTs } from "./templates/unified/serializers_ts.ts";
import { generateViewsetsTs } from "./templates/unified/viewsets_ts.ts";
import { generateUrlsTs } from "./templates/unified/urls_ts.ts";
import { generateViewsTs } from "./templates/unified/views_ts.ts";
import { generatePostTestTs } from "./templates/unified/test_ts.ts";
import { generateInitMigration } from "./templates/unified/migration_ts.ts";

// Template imports - Unified app (assets - frontend)
import { generateAssetModTs } from "./templates/unified/assets/mod_ts.ts";

// Template imports - Unified app (workers - Service Worker)
import { generateWorkerModTs } from "./templates/unified/workers/mod_ts.ts";
import { generateWorkerModelsTs } from "./templates/unified/workers/models_ts.ts";
import { generateWorkerEndpointsTs } from "./templates/unified/workers/endpoints_ts.ts";
import { generateWorkerSettingsTs } from "./templates/unified/workers/settings_ts.ts";
import { generateWorkerUrlsTs } from "./templates/unified/workers/urls_ts.ts";
import { generateWorkerViewsTs } from "./templates/unified/workers/views_ts.ts";
import { generateWorkerBaseHtml } from "./templates/unified/workers/base_html.ts";
import { generateWorkerIndexHtml } from "./templates/unified/workers/index_html.ts";
import { generateWorkerPostListHtml } from "./templates/unified/workers/post_list_html.ts";
import { generateWorkerPostFormHtml } from "./templates/unified/workers/post_form_html.ts";

// Template imports - Skills (Agent Skills for AI coding assistants)
import { generateAlexiAdminSkillMd } from "./templates/skills/alexi_admin_skill_md.ts";
import { generateAlexiAuthSkillMd } from "./templates/skills/alexi_auth_skill_md.ts";
import { generateAlexiCapacitorSkillMd } from "./templates/skills/alexi_capacitor_skill_md.ts";
import { generateAlexiCoreSkillMd } from "./templates/skills/alexi_core_skill_md.ts";
import { generateAlexiDbSkillMd } from "./templates/skills/alexi_db_skill_md.ts";
import { generateAlexiMiddlewareSkillMd } from "./templates/skills/alexi_middleware_skill_md.ts";
import { generateAlexiRestframeworkSkillMd } from "./templates/skills/alexi_restframework_skill_md.ts";
import { generateAlexiStaticfilesSkillMd } from "./templates/skills/alexi_staticfiles_skill_md.ts";
import { generateAlexiUrlsSkillMd } from "./templates/skills/alexi_urls_skill_md.ts";
import { generateAlexiViewsSkillMd } from "./templates/skills/alexi_views_skill_md.ts";
import { generateAlexiWebSkillMd } from "./templates/skills/alexi_web_skill_md.ts";
import { generateAlexiWebuiSkillMd } from "./templates/skills/alexi_webui_skill_md.ts";

import { VERSION } from "./version.ts";

export interface ProjectOptions {
  name: string;
}

export interface InstallSkillsOptions {
  /** Target directory (defaults to current working directory) */
  targetDir?: string;
}

/**
 * Create a new Alexi full-stack project
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

  // Read the framework version for import map generation
  const version = VERSION;

  // Create directory structure
  await createDirectories(name);

  // Generate files
  await generateFiles(name, version);

  console.log("✓ Created project structure");
}

/**
 * Install Agent Skills to an existing project
 *
 * This installs Alexi's Agent Skills for AI coding assistants
 * (OpenCode, Claude Code, Cursor) into the current project.
 */
export async function installSkills(
  options: InstallSkillsOptions = {},
): Promise<void> {
  const targetDir = options.targetDir ?? ".";

  console.log("Installing Alexi Agent Skills...");
  console.log("");

  // All skills to install
  const skills = [
    { name: "alexi-admin", generator: generateAlexiAdminSkillMd },
    { name: "alexi-auth", generator: generateAlexiAuthSkillMd },
    { name: "alexi-capacitor", generator: generateAlexiCapacitorSkillMd },
    { name: "alexi-core", generator: generateAlexiCoreSkillMd },
    { name: "alexi-db", generator: generateAlexiDbSkillMd },
    { name: "alexi-middleware", generator: generateAlexiMiddlewareSkillMd },
    {
      name: "alexi-restframework",
      generator: generateAlexiRestframeworkSkillMd,
    },
    { name: "alexi-staticfiles", generator: generateAlexiStaticfilesSkillMd },
    { name: "alexi-urls", generator: generateAlexiUrlsSkillMd },
    { name: "alexi-views", generator: generateAlexiViewsSkillMd },
    { name: "alexi-web", generator: generateAlexiWebSkillMd },
    { name: "alexi-webui", generator: generateAlexiWebuiSkillMd },
  ];

  for (const skill of skills) {
    const skillDir = `${targetDir}/.opencode/skills/${skill.name}`;
    await Deno.mkdir(skillDir, { recursive: true });

    const skillPath = `${skillDir}/SKILL.md`;
    await Deno.writeTextFile(skillPath, skill.generator());
    console.log(`  Created ${skillPath}`);
  }

  console.log("");
  console.log("✓ Agent Skills installed");
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
    // Root
    name,
    // Project settings
    `${name}/project`,
    // Source — unified app
    `${name}/src`,
    `${name}/src/${name}`,
    `${name}/src/${name}/tests`,
    `${name}/src/${name}/migrations`,
    `${name}/src/${name}/static/${name}`,
    `${name}/src/${name}/assets/${name}`,
    `${name}/src/${name}/workers/${name}`,
    `${name}/src/${name}/templates/${name}`,
    // Agent Skills (for AI coding assistants)
    `${name}/.opencode/skills/alexi-admin`,
    `${name}/.opencode/skills/alexi-auth`,
    `${name}/.opencode/skills/alexi-capacitor`,
    `${name}/.opencode/skills/alexi-core`,
    `${name}/.opencode/skills/alexi-db`,
    `${name}/.opencode/skills/alexi-middleware`,
    `${name}/.opencode/skills/alexi-restframework`,
    `${name}/.opencode/skills/alexi-staticfiles`,
    `${name}/.opencode/skills/alexi-urls`,
    `${name}/.opencode/skills/alexi-views`,
    `${name}/.opencode/skills/alexi-web`,
    `${name}/.opencode/skills/alexi-webui`,
  ];

  for (const dir of dirs) {
    await Deno.mkdir(dir, { recursive: true });
    console.log(`  Created ${dir}/`);
  }
}

/**
 * Generate all project files
 */
async function generateFiles(name: string, version: string): Promise<void> {
  const files: Array<{ path: string; content: string }> = [
    // ==========================================================================
    // Root files
    // ==========================================================================
    {
      path: `${name}/deno.jsonc`,
      content: generateDenoJsonc(name, version),
    },
    {
      path: `${name}/manage.ts`,
      content: generateManageTs(),
    },
    {
      path: `${name}/project/http.ts`,
      content: generateHttpTs(name),
    },
    {
      path: `${name}/.gitignore`,
      content: generateGitignore(),
    },
    {
      path: `${name}/README.md`,
      content: generateReadme(name),
    },

    // ==========================================================================
    // Project settings
    // ==========================================================================
    {
      path: `${name}/project/settings.ts`,
      content: generateSettings(name),
    },

    // ==========================================================================
    // Unified app — server-side (root level)
    // ==========================================================================
    {
      path: `${name}/src/${name}/app.ts`,
      content: generateAppTs(name),
    },
    {
      path: `${name}/src/${name}/mod.ts`,
      content: generateModTs(name),
    },
    {
      path: `${name}/src/${name}/models.ts`,
      content: generateModelsTs(name),
    },
    {
      path: `${name}/src/${name}/serializers.ts`,
      content: generateSerializersTs(name),
    },
    {
      path: `${name}/src/${name}/viewsets.ts`,
      content: generateViewsetsTs(name),
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
      path: `${name}/src/${name}/tests/post_test.ts`,
      content: generatePostTestTs(name),
    },
    {
      path: `${name}/src/${name}/migrations/0001_init.ts`,
      content: generateInitMigration(name),
    },

    // ==========================================================================
    // Unified app — assets (frontend entry point)
    // ==========================================================================
    {
      path: `${name}/src/${name}/assets/${name}/${name}.ts`,
      content: generateAssetModTs(name),
    },

    // ==========================================================================
    // Unified app — workers (Service Worker)
    // ==========================================================================
    {
      path: `${name}/src/${name}/workers/${name}/worker.ts`,
      content: generateWorkerModTs(name),
    },
    {
      path: `${name}/src/${name}/workers/${name}/models.ts`,
      content: generateWorkerModelsTs(name),
    },
    {
      path: `${name}/src/${name}/workers/${name}/endpoints.ts`,
      content: generateWorkerEndpointsTs(name),
    },
    {
      path: `${name}/src/${name}/workers/${name}/settings.ts`,
      content: generateWorkerSettingsTs(name),
    },
    {
      path: `${name}/src/${name}/workers/${name}/urls.ts`,
      content: generateWorkerUrlsTs(name),
    },
    {
      path: `${name}/src/${name}/workers/${name}/views.ts`,
      content: generateWorkerViewsTs(name),
    },
    {
      path: `${name}/src/${name}/templates/${name}/base.html`,
      content: generateWorkerBaseHtml(name),
    },
    {
      path: `${name}/src/${name}/templates/${name}/index.html`,
      content: generateWorkerIndexHtml(name),
    },
    {
      path: `${name}/src/${name}/templates/${name}/post_list.html`,
      content: generateWorkerPostListHtml(name),
    },
    {
      path: `${name}/src/${name}/templates/${name}/post_form.html`,
      content: generateWorkerPostFormHtml(name),
    },

    // ==========================================================================
    // Agent Skills (for AI coding assistants like OpenCode, Claude, Cursor)
    // ==========================================================================
    {
      path: `${name}/.opencode/skills/alexi-admin/SKILL.md`,
      content: generateAlexiAdminSkillMd(),
    },
    {
      path: `${name}/.opencode/skills/alexi-auth/SKILL.md`,
      content: generateAlexiAuthSkillMd(),
    },
    {
      path: `${name}/.opencode/skills/alexi-capacitor/SKILL.md`,
      content: generateAlexiCapacitorSkillMd(),
    },
    {
      path: `${name}/.opencode/skills/alexi-core/SKILL.md`,
      content: generateAlexiCoreSkillMd(),
    },
    {
      path: `${name}/.opencode/skills/alexi-db/SKILL.md`,
      content: generateAlexiDbSkillMd(),
    },
    {
      path: `${name}/.opencode/skills/alexi-middleware/SKILL.md`,
      content: generateAlexiMiddlewareSkillMd(),
    },
    {
      path: `${name}/.opencode/skills/alexi-restframework/SKILL.md`,
      content: generateAlexiRestframeworkSkillMd(),
    },
    {
      path: `${name}/.opencode/skills/alexi-staticfiles/SKILL.md`,
      content: generateAlexiStaticfilesSkillMd(),
    },
    {
      path: `${name}/.opencode/skills/alexi-urls/SKILL.md`,
      content: generateAlexiUrlsSkillMd(),
    },
    {
      path: `${name}/.opencode/skills/alexi-views/SKILL.md`,
      content: generateAlexiViewsSkillMd(),
    },
    {
      path: `${name}/.opencode/skills/alexi-web/SKILL.md`,
      content: generateAlexiWebSkillMd(),
    },
    {
      path: `${name}/.opencode/skills/alexi-webui/SKILL.md`,
      content: generateAlexiWebuiSkillMd(),
    },
  ];

  for (const file of files) {
    await Deno.writeTextFile(file.path, file.content);
    console.log(`  Created ${file.path}`);
  }
}
