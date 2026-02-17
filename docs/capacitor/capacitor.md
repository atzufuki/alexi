# Capacitor (Mobile Apps)

Alexi provides mobile application support using
[Capacitor](https://capacitorjs.com/), a cross-platform native runtime that
wraps your web app in native iOS and Android containers.

> ⚠️ **Status:** This module is a placeholder. Full implementation is planned
> for a future release.

## Overview

Capacitor allows you to:

- Package your Alexi SPA as a native mobile app
- Access device features like camera, GPS, push notifications
- Distribute through App Store and Google Play
- Share code between web, iOS, and Android

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Your Alexi SPA                       │
│                    (bundled web app)                    │
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

---

## Planned Features

When fully implemented, this module will provide:

- **sync**: Copy web bundle to native iOS/Android projects
- **runserver**: Launch iOS simulator or Android emulator for development
- **build**: Create production builds for App Store (.ipa) and Play Store (.aab)
- **Plugin wrappers**: Deno-friendly wrappers for common Capacitor plugins

---

## Configuration

### Settings

```ts
// project/mobile.settings.ts
export const INSTALLED_APPS = [
  () => import("@alexi/capacitor"),
  () => import("@myproject/ui"),
];

export const UI_APP = "myproject-ui";
export const API_URL = "https://api.myapp.io";

export const CAPACITOR = {
  // App identifier (reverse domain notation)
  appId: "io.myapp.app",

  // Display name in app stores
  appName: "My App",

  // App version
  version: "1.0.0",

  // Build number (incremented for each release)
  buildNumber: 1,
};
```

### Planned Commands

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

---

## Manual Setup (Current Workaround)

Until the Capacitor module is fully implemented, use Capacitor directly:

### 1. Initialize Capacitor

```bash
# Create package.json if needed
npm init -y

# Install Capacitor
npm install @capacitor/cli @capacitor/core

# Initialize Capacitor
npx cap init "My App" io.myapp.app --web-dir dist
```

### 2. Add Platforms

```bash
# Install platform packages
npm install @capacitor/ios @capacitor/android

# Add native projects
npx cap add ios
npx cap add android
```

### 3. Build Your Web App

```bash
# Bundle your Alexi UI app
deno run -A manage.ts bundle --settings ui

# Output goes to dist/ or your configured static directory
```

### 4. Sync to Native Projects

```bash
# Copy web assets and sync plugins
npx cap sync
```

### 5. Run on Simulator/Emulator

```bash
# iOS (requires macOS and Xcode)
npx cap run ios

# Android (requires Android Studio)
npx cap run android
```

### 6. Open in IDE for Production

```bash
# Open in Xcode
npx cap open ios

# Open in Android Studio
npx cap open android
```

---

## Project Structure

After Capacitor initialization:

```
my-project/
├── ios/                    # Native iOS project (Xcode)
│   ├── App/
│   │   ├── App/
│   │   │   ├── public/     # Your web assets go here
│   │   │   └── Info.plist
│   │   └── App.xcodeproj
│   └── Podfile
│
├── android/                # Native Android project (Gradle)
│   ├── app/
│   │   ├── src/
│   │   │   └── main/
│   │   │       └── assets/
│   │   │           └── public/  # Your web assets go here
│   │   └── build.gradle
│   └── build.gradle
│
├── capacitor.config.ts     # Capacitor configuration
├── package.json            # Node dependencies
└── src/                    # Your Alexi source code
```

---

## Using Capacitor Plugins

### Install a Plugin

```bash
npm install @capacitor/camera
npx cap sync
```

### Use in Your App

```ts
// In your frontend code
import { Camera, CameraResultType } from "@capacitor/camera";

async function takePhoto() {
  const image = await Camera.getPhoto({
    quality: 90,
    allowEditing: true,
    resultType: CameraResultType.Uri,
  });

  return image.webPath;
}
```

### Common Plugins

| Plugin                          | Description                 |
| ------------------------------- | --------------------------- |
| `@capacitor/camera`             | Take photos, access gallery |
| `@capacitor/geolocation`        | GPS location                |
| `@capacitor/push-notifications` | Push notifications          |
| `@capacitor/filesystem`         | Read/write files            |
| `@capacitor/storage`            | Key-value storage           |
| `@capacitor/share`              | Native share dialog         |
| `@capacitor/splash-screen`      | App splash screen           |
| `@capacitor/status-bar`         | Control status bar          |

---

## Capacitor Configuration

### capacitor.config.ts

```ts
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "io.myapp.app",
  appName: "My App",
  webDir: "dist",

  server: {
    // For development - load from dev server
    url: "http://localhost:5173",
    cleartext: true,
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#ffffff",
    },
    StatusBar: {
      style: "dark",
    },
  },
};

export default config;
```

### Production Configuration

For production, remove the `server.url` to use bundled assets:

```ts
const config: CapacitorConfig = {
  appId: "io.myapp.app",
  appName: "My App",
  webDir: "dist",
  // No server.url - uses bundled web assets
};
```

---

## Requirements

### For iOS Development

- **macOS** (required for iOS development)
- **Xcode** (latest version recommended)
- **CocoaPods**: `sudo gem install cocoapods`
- **Apple Developer Account** (for App Store distribution)

### For Android Development

- **Android Studio** (any OS)
- **Java Development Kit (JDK)** 17+
- **Android SDK** (installed via Android Studio)
- **Google Play Developer Account** (for Play Store distribution)

### Node.js

Capacitor requires Node.js for its CLI tools:

```bash
# Check Node.js version
node --version  # Should be 16+ recommended

# Install if needed (via your package manager)
brew install node       # macOS
choco install nodejs    # Windows
sudo apt install nodejs # Ubuntu
```

---

## Detecting Mobile Context

Check if your app is running in a Capacitor context:

```ts
import { Capacitor } from "@capacitor/core";

if (Capacitor.isNativePlatform()) {
  // Running in iOS or Android app
  console.log("Platform:", Capacitor.getPlatform()); // "ios" or "android"
} else {
  // Running in browser
  console.log("Running in web browser");
}
```

---

## Troubleshooting

### "Capacitor CLI not found"

Install Capacitor:

```bash
npm install @capacitor/cli @capacitor/core
```

### "Pod install failed" (iOS)

Update CocoaPods and reinstall:

```bash
sudo gem install cocoapods
cd ios/App
pod install --repo-update
```

### "Build failed" (Android)

Check Gradle and SDK:

1. Open Android Studio
2. File → Sync Project with Gradle Files
3. Check SDK versions match `build.gradle`

### "Web assets not updating"

Run sync after each web build:

```bash
deno run -A manage.ts bundle
npx cap sync
```

---

## Related

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Capacitor Plugins](https://capacitorjs.com/docs/plugins)
- [WebUI](../webui/webui.md) - Desktop application support
- [Static Files](../staticfiles/staticfiles.md) - Bundling web assets
