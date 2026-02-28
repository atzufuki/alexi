/**
 * Project generator for @alexi/create CLI
 *
 * Generates a full-stack Todo application with web, ui, and desktop apps.
 *
 * @module @alexi/create/project
 */

// Template imports - Root files
import { generateDenoJsonc } from "./templates/root/deno_jsonc.ts";
import { generateManageTs } from "./templates/root/manage_ts.ts";
import { generateGitignore } from "./templates/root/gitignore.ts";
import { generateReadme } from "./templates/root/readme.ts";

// Template imports - Project settings
import { generateSharedSettings } from "./templates/project/settings_ts.ts";
import { generateWebSettings } from "./templates/project/web_settings_ts.ts";
import { generateUiSettings } from "./templates/project/ui_settings_ts.ts";
import { generateDesktopSettings } from "./templates/project/desktop_settings_ts.ts";

// Template imports - Web app
import { generateWebAppTs } from "./templates/web/app_ts.ts";
import { generateWebModTs } from "./templates/web/mod_ts.ts";
import { generateWebModelsTs } from "./templates/web/models_ts.ts";
import { generateWebSerializersTs } from "./templates/web/serializers_ts.ts";
import { generateWebViewsetsTs } from "./templates/web/viewsets_ts.ts";
import { generateWebUrlsTs } from "./templates/web/urls_ts.ts";

// Template imports - UI app
import { generateUiAppTs } from "./templates/ui/app_ts.ts";
import { generateUiModTs } from "./templates/ui/mod_ts.ts";
import { generateUiModelsTs } from "./templates/ui/models_ts.ts";
import { generateUiEndpointsTs } from "./templates/ui/endpoints_ts.ts";
import { generateUiSettingsTs } from "./templates/ui/settings_ts.ts";
import { generateUiSessionTs } from "./templates/ui/session_ts.ts";
import { generateUiUtilsTs } from "./templates/ui/utils_ts.ts";
import { generateUiViewsTs } from "./templates/ui/views_ts.ts";
import { generateUiUrlsTs } from "./templates/ui/urls_ts.ts";
import { generateUiMainTs } from "./templates/ui/main_ts.ts";
import { generateUiHomeTs } from "./templates/ui/templates/home_ts.ts";
import { generateUiComponentsModTs } from "./templates/ui/components/mod_ts.ts";
import { generateDSButtonTs } from "./templates/ui/components/ds_button_ts.ts";
import { generateDSInputTs } from "./templates/ui/components/ds_input_ts.ts";
import { generateDSCheckboxTs } from "./templates/ui/components/ds_checkbox_ts.ts";
import { generateDSIconTs } from "./templates/ui/components/ds_icon_ts.ts";
import { generateDSTextTs } from "./templates/ui/components/ds_text_ts.ts";
import { generateDSCardTs } from "./templates/ui/components/ds_card_ts.ts";
import { generateDSThemeToggleTs } from "./templates/ui/components/ds_theme_toggle_ts.ts";
import { generateGlobalCss } from "./templates/ui/styles_css.ts";

// Template imports - Desktop app
import { generateDesktopAppTs } from "./templates/desktop/app_ts.ts";
import { generateDesktopModTs } from "./templates/desktop/mod_ts.ts";
import { generateDesktopBindingsTs } from "./templates/desktop/bindings_ts.ts";

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

  console.log(`Creating full-stack project "${name}"...`);
  console.log("");

  // Create directory structure
  await createDirectories(name);

  // Generate files
  await generateFiles(name);

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
    // Source
    `${name}/src`,
    // Web app
    `${name}/src/${name}-web`,
    `${name}/src/${name}-web/tests`,
    // UI app
    `${name}/src/${name}-ui`,
    `${name}/src/${name}-ui/templates`,
    `${name}/src/${name}-ui/components`,
    `${name}/src/${name}-ui/styles`,
    `${name}/src/${name}-ui/static/${name}-ui`,
    // Desktop app
    `${name}/src/${name}-desktop`,
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
async function generateFiles(name: string): Promise<void> {
  const files: Array<{ path: string; content: string }> = [
    // ==========================================================================
    // Root files
    // ==========================================================================
    {
      path: `${name}/deno.jsonc`,
      content: generateDenoJsonc(name),
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

    // ==========================================================================
    // Project settings
    // ==========================================================================
    {
      path: `${name}/project/settings.ts`,
      content: generateSharedSettings(name),
    },
    {
      path: `${name}/project/web.settings.ts`,
      content: generateWebSettings(name),
    },
    {
      path: `${name}/project/ui.settings.ts`,
      content: generateUiSettings(name),
    },
    {
      path: `${name}/project/desktop.settings.ts`,
      content: generateDesktopSettings(name),
    },

    // ==========================================================================
    // Web app (backend API)
    // ==========================================================================
    {
      path: `${name}/src/${name}-web/app.ts`,
      content: generateWebAppTs(name),
    },
    {
      path: `${name}/src/${name}-web/mod.ts`,
      content: generateWebModTs(name),
    },
    {
      path: `${name}/src/${name}-web/models.ts`,
      content: generateWebModelsTs(name),
    },
    {
      path: `${name}/src/${name}-web/serializers.ts`,
      content: generateWebSerializersTs(name),
    },
    {
      path: `${name}/src/${name}-web/viewsets.ts`,
      content: generateWebViewsetsTs(name),
    },
    {
      path: `${name}/src/${name}-web/urls.ts`,
      content: generateWebUrlsTs(name),
    },
    {
      path: `${name}/src/${name}-web/tests/todo_test.ts`,
      content: generateWebTodoTest(name),
    },

    // ==========================================================================
    // UI app (frontend SPA)
    // ==========================================================================
    {
      path: `${name}/src/${name}-ui/app.ts`,
      content: generateUiAppTs(name),
    },
    {
      path: `${name}/src/${name}-ui/mod.ts`,
      content: generateUiModTs(name),
    },
    {
      path: `${name}/src/${name}-ui/models.ts`,
      content: generateUiModelsTs(name),
    },
    {
      path: `${name}/src/${name}-ui/endpoints.ts`,
      content: generateUiEndpointsTs(name),
    },
    {
      path: `${name}/src/${name}-ui/settings.ts`,
      content: generateUiSettingsTs(name),
    },
    {
      path: `${name}/src/${name}-ui/session.ts`,
      content: generateUiSessionTs(name),
    },
    {
      path: `${name}/src/${name}-ui/utils.ts`,
      content: generateUiUtilsTs(),
    },
    {
      path: `${name}/src/${name}-ui/views.ts`,
      content: generateUiViewsTs(name),
    },
    {
      path: `${name}/src/${name}-ui/urls.ts`,
      content: generateUiUrlsTs(name),
    },
    {
      path: `${name}/src/${name}-ui/main.ts`,
      content: generateUiMainTs(name),
    },
    {
      path: `${name}/src/${name}-ui/templates/home.ts`,
      content: generateUiHomeTs(name),
    },
    {
      path: `${name}/src/${name}-ui/components/mod.ts`,
      content: generateUiComponentsModTs(),
    },
    {
      path: `${name}/src/${name}-ui/components/ds_button.ts`,
      content: generateDSButtonTs(),
    },
    {
      path: `${name}/src/${name}-ui/components/ds_input.ts`,
      content: generateDSInputTs(),
    },
    {
      path: `${name}/src/${name}-ui/components/ds_checkbox.ts`,
      content: generateDSCheckboxTs(),
    },
    {
      path: `${name}/src/${name}-ui/components/ds_icon.ts`,
      content: generateDSIconTs(),
    },
    {
      path: `${name}/src/${name}-ui/components/ds_text.ts`,
      content: generateDSTextTs(),
    },
    {
      path: `${name}/src/${name}-ui/components/ds_card.ts`,
      content: generateDSCardTs(),
    },
    {
      path: `${name}/src/${name}-ui/components/ds_theme_toggle.ts`,
      content: generateDSThemeToggleTs(),
    },
    {
      path: `${name}/src/${name}-ui/styles/global.css`,
      content: generateGlobalCss(),
    },
    {
      path: `${name}/src/${name}-ui/static/${name}-ui/index.html`,
      content: generateIndexHtml(name),
    },

    // ==========================================================================
    // Desktop app (WebUI)
    // ==========================================================================
    {
      path: `${name}/src/${name}-desktop/app.ts`,
      content: generateDesktopAppTs(name),
    },
    {
      path: `${name}/src/${name}-desktop/mod.ts`,
      content: generateDesktopModTs(name),
    },
    {
      path: `${name}/src/${name}-desktop/bindings.ts`,
      content: generateDesktopBindingsTs(),
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

/**
 * Generate basic todo test file
 */
function generateWebTodoTest(name: string): string {
  const appName = toPascalCase(name);

  return `/**
 * Todo API tests for ${name}
 */

import { assertEquals, assertExists } from "jsr:@std/assert@1";
import { reset } from "@alexi/db";
import { DenoKVBackend } from "@alexi/db/backends/denokv";
import { setup } from "@alexi/core";
import { TodoModel } from "@${name}-web/models.ts";

Deno.test({
  name: "${appName}: TodoModel CRUD",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    // Setup in-memory database
    const backend = new DenoKVBackend({ name: "test", path: ":memory:" });
    await setup({ DATABASES: { default: backend } });

    try {
      // Create
      const todo = await TodoModel.objects.create({
        title: "Test Todo",
        completed: false,
      });

      assertExists(todo.id.get());
      assertEquals(todo.title.get(), "Test Todo");
      assertEquals(todo.completed.get(), false);

      // Update
      todo.completed.set(true);
      await todo.save();

      const updated = await TodoModel.objects.get({ id: todo.id.get() });
      assertEquals(updated.completed.get(), true);

      // Delete
      await todo.delete();
      const deleted = await TodoModel.objects
        .filter({ id: todo.id.get() })
        .first();
      assertEquals(deleted, null);
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
});
`;
}

/**
 * Generate index.html for the UI app
 */
function generateIndexHtml(name: string): string {
  const appName = toPascalCase(name);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${appName}</title>
  <link rel="stylesheet" href="/styles/global.css">
  <style>
    /* Critical reset - must load before external CSS */
    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; height: 100%; }
    body { background: #09090b; }

    /* Loading state styles (before JS loads) */
    .alexi-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      gap: 1rem;
    }

    .alexi-loading-spinner {
      width: 48px;
      height: 48px;
      border: 4px solid var(--alexi-border, #e4e4e7);
      border-top-color: var(--alexi-primary, #10b981);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    .alexi-loading-text {
      font-family: "Nunito", system-ui, sans-serif;
      font-size: 1rem;
      color: var(--alexi-text-secondary, #71717a);
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div id="app">
    <div class="alexi-loading">
      <div class="alexi-loading-spinner"></div>
      <p class="alexi-loading-text">Loading ${appName}...</p>
    </div>
  </div>
  <script type="module" src="/bundle.js"></script>
</body>
</html>
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
