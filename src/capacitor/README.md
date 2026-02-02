# Alexi Capacitor

Mobile application support using [Capacitor](https://capacitorjs.com/).

## Status

⚠️ **This module is a placeholder.** Full implementation is planned for a future release.

## Overview

Alexi Capacitor provides native iOS and Android containers for web applications. It wraps your Alexi SPA in a native mobile app, giving you access to device features like camera, GPS, push notifications, and more.

## Planned Features

- **sync**: Copy web bundle to native iOS/Android projects
- **runserver**: Launch iOS simulator or Android emulator for development
- **build**: Create production builds for App Store (.ipa) and Play Store (.aab)
- **Plugin wrappers**: Deno-friendly wrappers for common Capacitor plugins

## Requirements

When implemented, this module will require:

- **Node.js** and **npm** (for Capacitor CLI)
- **Xcode** (for iOS development, macOS only)
- **Android Studio** (for Android development)
- **CocoaPods** (for iOS dependencies)

## Usage

### Settings Configuration

```typescript
// project/mobile.settings.ts
export const INSTALLED_APPS = [
  "alexi_capacitor",
  "comachine-ui",
];

export const UI_APP = "comachine-ui";
export const API_URL = "https://api.myapp.io";

export const CAPACITOR = {
  appId: "io.myapp.app",
  appName: "My App",
  version: "1.0.0",
};
```

### Commands

```bash
# Sync web bundle to native projects
deno run -A manage.ts sync --settings mobile

# Run on iOS simulator
deno run -A manage.ts runserver --settings mobile --target ios

# Run on Android emulator
deno run -A manage.ts runserver --settings mobile --target android

# Build for App Store
deno run -A manage.ts build --settings mobile --target ios

# Build for Play Store
deno run -A manage.ts build --settings mobile --target android
```

## Manual Workaround

Until this module is fully implemented, you can use Capacitor directly:

```bash
# Initialize Capacitor in your project
npm init -y
npm install @capacitor/cli @capacitor/core
npx cap init

# Add platforms
npm install @capacitor/ios @capacitor/android
npx cap add ios
npx cap add android

# Build your web app
deno run -A manage.ts bundle

# Copy web assets to native projects
npx cap sync

# Run on simulator/emulator
npx cap run ios
npx cap run android

# Open in IDE for production builds
npx cap open ios     # Opens Xcode
npx cap open android # Opens Android Studio
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    comachine-ui                         │
│                    (SPA bundle)                         │
└─────────────────────────────────────────────────────────┘
                           │
                     npx cap sync
                           │
         ┌─────────────────┴─────────────────┐
         │                                   │
         ▼                                   ▼
   ┌───────────┐                       ┌───────────┐
   │    iOS    │                       │  Android  │
   │  (Xcode)  │                       │ (Gradle)  │
   └─────┬─────┘                       └─────┬─────┘
         │                                   │
         ▼                                   ▼
   ┌───────────┐                       ┌───────────┐
   │   .ipa    │                       │   .aab    │
   │ App Store │                       │Play Store │
   └───────────┘                       └───────────┘
```

## Related

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Alexi WebUI](../alexi_webui/) - Desktop application support
- [Alexi HTTP](../alexi_http/) - HTTP server and static files