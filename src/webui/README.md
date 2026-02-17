# @alexi/webui

Desktop application support via [WebUI](https://webui.me/).

## Overview

Wraps your Alexi SPA in a native desktop window using WebUI, providing a
lightweight alternative to Electron.

## Installation

```bash
deno add jsr:@alexi/webui
```

## Usage

```typescript
import { WebUILauncher } from "@alexi/webui";

const launcher = new WebUILauncher({
  title: "My App",
  width: 1200,
  height: 800,
});

await launcher.start();
```

## Requirements

- `--unstable-ffi` flag for WebUI bindings

## Documentation

See [WebUI Documentation](../../docs/webui/webui.md) for details.
