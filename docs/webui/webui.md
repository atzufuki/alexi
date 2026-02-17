# WebUI (Desktop Apps)

Alexi provides desktop application support using [WebUI](https://webui.me/), a
lightweight library that uses the system's installed browser as a GUI engine.
This creates portable, small-footprint desktop applications.

## Overview

WebUI allows you to:

- Create native desktop windows that display your web app
- Call native Deno functions from JavaScript in the browser
- Access system features like clipboard, file dialogs, and notifications
- Build cross-platform desktop apps (Windows, macOS, Linux)

---

## Quick Start

### 1. Create a Desktop App

```bash
deno run -A manage.ts startapp myapp-desktop --type desktop
```

### 2. Configure Settings

```ts
// project/desktop.settings.ts
export const INSTALLED_APPS = [
  () => import("@alexi/webui"),
  () => import("@myproject/ui"),
];

export const UI_APP = "myproject-ui";
export const API_URL = "http://localhost:8000/api";

export const WEBUI = {
  title: "My App",
  width: 1400,
  height: 900,
};
```

### 3. Run the Desktop App

```bash
# Requires --unstable-ffi for WebUI
deno run -A --unstable-kv --unstable-ffi manage.ts runserver --settings desktop
```

---

## WebUI Configuration

Configure the desktop window in your settings:

```ts
export const WEBUI = {
  // Window title (required)
  title: "My Application",

  // Window dimensions
  width: 1400, // default: 1400
  height: 900, // default: 900

  // Browser selection
  browser: "any", // "any", "chrome", "firefox", "edge", "safari", "chromium"

  // Fullscreen mode
  kiosk: false,

  // Open DevTools on startup
  devTools: false,
};
```

| Option     | Type      | Default    | Description              |
| ---------- | --------- | ---------- | ------------------------ |
| `title`    | `string`  | (required) | Window title             |
| `width`    | `number`  | `1400`     | Window width in pixels   |
| `height`   | `number`  | `900`      | Window height in pixels  |
| `browser`  | `string`  | `"any"`    | Browser to use           |
| `kiosk`    | `boolean` | `false`    | Enable fullscreen mode   |
| `devTools` | `boolean` | `false`    | Open DevTools on startup |

---

## WebUI Launcher

Use `WebUILauncher` to programmatically open desktop windows:

```ts
import { WebUILauncher } from "@alexi/webui";

const launcher = new WebUILauncher({
  config: {
    title: "My App",
    width: 1200,
    height: 800,
  },
  url: "http://localhost:8000/",
  bindings: {
    getSystemInfo: () => ({
      platform: Deno.build.os,
      arch: Deno.build.arch,
    }),
  },
  onOpen: () => console.log("Window opened"),
  onClose: () => console.log("Window closed"),
});

await launcher.launch();
```

### Launcher Options

| Option     | Type                       | Description                       |
| ---------- | -------------------------- | --------------------------------- |
| `config`   | `WebUIConfig`              | Window configuration              |
| `url`      | `string`                   | URL to load in the window         |
| `bindings` | `Record<string, Function>` | Native functions callable from JS |
| `onOpen`   | `() => void`               | Callback when window opens        |
| `onClose`  | `() => void`               | Callback when window closes       |
| `logger`   | `Logger`                   | Custom logger for status messages |

---

## Native Bindings

Bindings allow JavaScript code in the browser to call Deno functions.

### Default Bindings

Alexi provides default bindings for common operations:

```ts
import { createDefaultBindings } from "@alexi/webui";

const bindings = createDefaultBindings();
// Includes: getSystemInfo, openFileDialog, saveFileDialog,
//           showNotification, openExternal, readClipboard,
//           writeClipboard, getEnv
```

### Using Bindings in the Browser

```ts
// In your frontend code (runs in the browser)

// Get system information
const info = await webui.call("getSystemInfo");
console.log(info.platform); // "windows", "darwin", "linux"
console.log(info.arch); // "x86_64", "aarch64"

// Open a URL in the default browser
await webui.call("openExternal", "https://example.com");

// Read from clipboard
const text = await webui.call("readClipboard");

// Write to clipboard
await webui.call("writeClipboard", "Hello, clipboard!");

// Close the window
webui.call("closeWindow");
```

### Custom Bindings

Create custom bindings for your application:

```ts
// src/myapp-desktop/bindings.ts
import { createDefaultBindings } from "@alexi/webui";
import type { WebUIBindings } from "@alexi/webui";

export function createBindings(): WebUIBindings & CustomBindings {
  return {
    ...createDefaultBindings(),

    // Custom binding: read a local file
    readLocalFile: async (path: string): Promise<string> => {
      return await Deno.readTextFile(path);
    },

    // Custom binding: write a local file
    writeLocalFile: async (path: string, content: string): Promise<boolean> => {
      try {
        await Deno.writeTextFile(path, content);
        return true;
      } catch {
        return false;
      }
    },

    // Custom binding: get app version
    getAppVersion: () => {
      return "1.0.0";
    },
  };
}
```

Use in launcher:

```ts
import { createBindings } from "./bindings.ts";

const launcher = new WebUILauncher({
  config: { title: "My App" },
  url: "http://localhost:8000/",
  bindings: createBindings(),
});
```

---

## Built-in Bindings Reference

### getSystemInfo

Returns system information:

```ts
interface SystemInfo {
  platform: "windows" | "darwin" | "linux";
  arch: string;
  hostname: string;
  homeDir: string | null;
  denoVersion: string;
}
```

### openExternal

Opens a URL or file with the default system application:

```ts
await webui.call("openExternal", "https://example.com");
await webui.call("openExternal", "/path/to/document.pdf");
```

### readClipboard / writeClipboard

Read and write system clipboard:

```ts
const text = await webui.call("readClipboard");
await webui.call("writeClipboard", "New clipboard content");
```

### getEnv

Get environment variable:

```ts
const apiKey = await webui.call("getEnv", "API_KEY");
```

### showNotification

Show a system notification (placeholder implementation):

```ts
await webui.call("showNotification", {
  title: "Hello",
  body: "This is a notification",
});
```

### openFileDialog / saveFileDialog

File dialogs (placeholder implementation):

```ts
const file = await webui.call("openFileDialog", {
  title: "Select a file",
  filters: [{ name: "Images", extensions: ["png", "jpg"] }],
});
```

---

## Detecting Desktop Mode

Check if your app is running in a desktop context:

```ts
// In your frontend code
const isDesktop = typeof globalThis.__ALEXI_DESKTOP__ !== "undefined";

if (isDesktop) {
  // Show desktop-specific features
  showNativeMenus();
} else {
  // Running in browser
  showWebVersion();
}
```

---

## Development Workflow

### Running with Hot Reload

Start the web server and desktop app together:

```bash
# Terminal 1: Start the web/UI server
deno task web

# Terminal 2: Start the desktop window
deno run -A --unstable-ffi manage.ts runserver --settings desktop
```

Or use a combined task:

```bash
deno task dev
```

The desktop window will:

1. Wait for the web server to be available
2. Open the WebUI window
3. Connect to the running server

### Debugging

Enable DevTools in the WebUI config:

```ts
export const WEBUI = {
  title: "My App (Dev)",
  devTools: true, // Opens DevTools on startup
};
```

---

## Production Builds

> ⚠️ **Note:** Production builds are not yet fully implemented.

### Planned Features

```bash
# Build for specific platform
deno run -A manage.ts build --settings desktop --target windows
deno run -A manage.ts build --settings desktop --target macos
deno run -A manage.ts build --settings desktop --target linux
```

### Current Workaround

For production, you can:

1. Build your web app as a static bundle
2. Use `deno compile` to create a standalone executable
3. Bundle the web assets with the executable

---

## Requirements

### Deno Flags

WebUI requires the `--unstable-ffi` flag:

```bash
deno run -A --unstable-ffi manage.ts runserver --settings desktop
```

### System Requirements

WebUI uses the system's installed browser. Ensure one of these is available:

- Google Chrome
- Microsoft Edge
- Mozilla Firefox
- Chromium
- Safari (macOS only)

---

## API Reference

### WebUILauncher

```ts
class WebUILauncher {
  constructor(options: WebUILauncherOptions);

  // Launch the desktop window
  launch(): Promise<void>;

  // Close the window programmatically
  close(): void;
}

interface WebUILauncherOptions {
  config: WebUIConfig;
  url: string;
  bindings?: Record<string, (...args: unknown[]) => unknown>;
  onOpen?: () => void;
  onClose?: () => void;
  logger?: Logger;
}

interface WebUIConfig {
  title: string;
  width?: number;
  height?: number;
  browser?: "any" | "chrome" | "firefox" | "edge" | "safari" | "chromium";
  kiosk?: boolean;
  devTools?: boolean;
}
```

### Bindings

```ts
interface WebUIBindings {
  getSystemInfo: () => SystemInfo;
  openFileDialog: (
    options?: FileDialogOptions,
  ) => Promise<string | string[] | null>;
  saveFileDialog: (options?: FileDialogOptions) => Promise<string | null>;
  showNotification: (options: NotificationOptions) => Promise<boolean>;
  openExternal: (url: string) => Promise<boolean>;
  readClipboard: () => Promise<string>;
  writeClipboard: (text: string) => Promise<boolean>;
  getEnv: (key: string) => string | undefined;
}

function createDefaultBindings(): WebUIBindings;
```

---

## Troubleshooting

### "WebUI could not be loaded"

Ensure you're using the `--unstable-ffi` flag:

```bash
deno run -A --unstable-ffi manage.ts runserver --settings desktop
```

### "Could not connect to server"

The desktop window waits for the web server. Make sure:

1. The web server is running
2. The URL in settings is correct
3. No firewall is blocking the connection

### Window opens then closes immediately

Check the console for errors. Common causes:

- Server crashed after window opened
- Binding error in JavaScript code
- Browser compatibility issue

### Browser not found

WebUI tries to use any available browser. If it fails:

1. Install Chrome, Edge, or Firefox
2. Specify a browser in settings: `browser: "chrome"`
