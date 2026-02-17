/**
 * Template for alexi-webui SKILL.md
 *
 * Generates the Agent Skills file for @alexi/webui desktop app support.
 */

export function generateAlexiWebuiSkillMd(): string {
  return `---
name: alexi-webui
description: Use when working with @alexi/webui - creating desktop applications, setting up WebUI windows, native bindings, and building cross-platform desktop apps with Alexi.
license: MIT
metadata:
  author: atzufuki
  version: "1.0"
  package: "@alexi/webui"
---

# Alexi WebUI

## Overview

\`@alexi/webui\` enables building desktop applications with Alexi using WebUI.
It wraps web content in a native window, allowing you to create cross-platform
desktop apps with your existing web frontend.

## When to Use This Skill

- Creating desktop applications
- Wrapping web apps in native windows
- Adding native functionality to web apps
- Building cross-platform desktop apps
- Creating native bindings for JavaScript

## Installation

\`\`\`bash
deno add jsr:@alexi/webui
\`\`\`

**Note:** Requires \`--unstable-ffi\` flag for native bindings.

## Desktop App Setup

### Project Structure

\`\`\`
my-project/
├── src/
│   ├── myapp-web/        # Backend API
│   ├── myapp-ui/         # Frontend SPA
│   └── myapp-desktop/    # Desktop app
│       ├── app.ts        # AppConfig
│       ├── mod.ts        # Module exports
│       └── bindings.ts   # Native bindings
└── project/
    └── desktop.settings.ts
\`\`\`

### Desktop Settings

\`\`\`typescript
// project/desktop.settings.ts
export const DEBUG = true;

export const INSTALLED_APPS = [
  () => import("@alexi/webui"),
  () => import("@myapp-desktop"),
];

// Window configuration
export const WEBUI_CONFIG = {
  title: "My App",
  width: 1200,
  height: 800,
  resizable: true,
  
  // URL to load (typically the UI server)
  url: "http://localhost:5173",
};
\`\`\`

### Desktop App Module

\`\`\`typescript
// src/myapp-desktop/app.ts
import { AppConfig } from "@alexi/core";

export default class DesktopAppConfig extends AppConfig {
  name = "myapp-desktop";
  verbose_name = "My Desktop App";
}
\`\`\`

\`\`\`typescript
// src/myapp-desktop/mod.ts
export { default } from "./app.ts";
export * from "./bindings.ts";
\`\`\`

## Running Desktop App

\`\`\`bash
# Run with desktop settings
deno run -A --unstable-kv --unstable-ffi manage.ts rundesktop --settings desktop

# Or using deno task
deno task desktop
\`\`\`

### deno.jsonc Tasks

\`\`\`jsonc
{
  "tasks": {
    "dev": "deno run -A --unstable-kv manage.ts runserver --settings web",
    "ui": "deno run -A --unstable-kv manage.ts runserver --settings ui",
    "desktop": "deno run -A --unstable-kv --unstable-ffi manage.ts rundesktop --settings desktop"
  }
}
\`\`\`

## WebUI Launcher

### Basic Usage

\`\`\`typescript
import { WebUILauncher } from "@alexi/webui/launcher";

const launcher = new WebUILauncher({
  title: "My App",
  width: 1200,
  height: 800,
  url: "http://localhost:5173",
});

await launcher.start();
\`\`\`

### Window Options

\`\`\`typescript
const launcher = new WebUILauncher({
  // Window properties
  title: "My App",
  width: 1200,
  height: 800,
  x: 100,        // Initial X position
  y: 100,        // Initial Y position
  
  // Behavior
  resizable: true,
  fullscreen: false,
  alwaysOnTop: false,
  frameless: false,
  transparent: false,
  
  // Content
  url: "http://localhost:5173",
  // Or load HTML directly:
  // html: "<h1>Hello Desktop!</h1>",
});
\`\`\`

## Native Bindings

### Defining Bindings

\`\`\`typescript
// src/myapp-desktop/bindings.ts
import { createDefaultBindings } from "@alexi/webui/bindings";

export const bindings = {
  ...createDefaultBindings(),
  
  // Custom bindings
  showNotification: (title: string, body: string) => {
    // Use Deno APIs for native functionality
    new Notification(title, { body });
    return { success: true };
  },
  
  readFile: async (path: string) => {
    const content = await Deno.readTextFile(path);
    return { content };
  },
  
  writeFile: async (path: string, content: string) => {
    await Deno.writeTextFile(path, content);
    return { success: true };
  },
  
  openExternal: (url: string) => {
    // Open URL in default browser
    const cmd = Deno.build.os === "windows" 
      ? ["cmd", "/c", "start", url]
      : ["open", url];
    new Deno.Command(cmd[0], { args: cmd.slice(1) }).spawn();
    return { success: true };
  },
};
\`\`\`

### Using Bindings in Frontend

\`\`\`typescript
// In your frontend code (myapp-ui)
declare global {
  interface Window {
    webui: {
      call: (name: string, ...args: unknown[]) => Promise<unknown>;
    };
  }
}

// Call native function
async function saveFile(content: string) {
  const result = await window.webui.call("writeFile", "/tmp/data.txt", content);
  console.log("File saved:", result);
}

async function showNotification() {
  await window.webui.call("showNotification", "Hello", "From desktop app!");
}
\`\`\`

### Registering Bindings

\`\`\`typescript
// In desktop app setup
import { WebUILauncher } from "@alexi/webui/launcher";
import { bindings } from "./bindings.ts";

const launcher = new WebUILauncher({
  title: "My App",
  url: "http://localhost:5173",
  bindings,
});

await launcher.start();
\`\`\`

## Default Bindings

\`createDefaultBindings()\` provides common functionality:

| Binding | Description |
|---------|-------------|
| \`getAppVersion\` | Get app version |
| \`getPlatform\` | Get OS platform |
| \`minimize\` | Minimize window |
| \`maximize\` | Maximize window |
| \`close\` | Close window |
| \`setTitle\` | Set window title |

## Development Workflow

### 1. Start Backend

\`\`\`bash
deno task dev  # Starts web server on :8000
\`\`\`

### 2. Start Frontend

\`\`\`bash
deno task ui   # Starts UI server on :5173
\`\`\`

### 3. Start Desktop

\`\`\`bash
deno task desktop  # Opens WebUI window pointing to :5173
\`\`\`

## Production Build

### Bundle Frontend

\`\`\`bash
DEBUG=false deno run -A --unstable-kv manage.ts bundle --settings ui
\`\`\`

### Compile Desktop Binary

\`\`\`bash
deno compile -A --unstable-kv --unstable-ffi \\
  --output dist/myapp \\
  manage.ts
\`\`\`

### Distribution

The compiled binary includes Deno runtime but needs WebUI library:

\`\`\`
dist/
├── myapp (or myapp.exe on Windows)
└── webui.dll (or libwebui.so / libwebui.dylib)
\`\`\`

## Common Mistakes

**Missing --unstable-ffi flag**

\`\`\`bash
# ❌ Wrong - FFI not enabled
deno run -A --unstable-kv manage.ts rundesktop

# ✅ Correct - include --unstable-ffi
deno run -A --unstable-kv --unstable-ffi manage.ts rundesktop
\`\`\`

**UI server not running**

\`\`\`bash
# ❌ Desktop shows blank - UI server not started
deno task desktop

# ✅ Start UI server first, then desktop
deno task ui &
deno task desktop
\`\`\`

**Bindings not registered**

\`\`\`typescript
// ❌ Wrong - bindings not passed to launcher
const launcher = new WebUILauncher({ url: "..." });

// ✅ Correct - pass bindings
const launcher = new WebUILauncher({ url: "...", bindings });
\`\`\`

## Import Reference

\`\`\`typescript
// Launcher
import { WebUILauncher } from "@alexi/webui/launcher";

// Default bindings
import { createDefaultBindings } from "@alexi/webui/bindings";

// Types
import type { WebUIConfig, WebUIBindings } from "@alexi/webui";
\`\`\`
`;
}
