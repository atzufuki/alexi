/**
 * Template for alexi-capacitor SKILL.md
 *
 * Generates the Agent Skills file for @alexi/capacitor mobile app support.
 * Note: This is currently a placeholder package.
 */

export function generateAlexiCapacitorSkillMd(): string {
  return `---
name: alexi-capacitor
description: Use when working with @alexi/capacitor - building mobile applications with Alexi using Capacitor for iOS and Android.
license: MIT
metadata:
  author: atzufuki
  version: "1.0"
  package: "@alexi/capacitor"
---

# Alexi Capacitor

## Overview

\`@alexi/capacitor\` provides mobile app support for Alexi applications using
Capacitor. It enables building iOS and Android apps from your existing web
frontend.

**Note:** This package is currently a placeholder and under development.

## When to Use This Skill

- Building iOS mobile applications
- Building Android mobile applications
- Wrapping web apps for mobile distribution
- Accessing native device features

## Status

This package is planned for future development. Currently, Alexi focuses on:

- **Web** (\`@alexi/web\`) - REST API backend
- **UI** (frontend SPA) - Browser-based frontend
- **Desktop** (\`@alexi/webui\`) - Desktop applications

Mobile support via Capacitor is on the roadmap.

## Planned Features

- Capacitor project scaffolding
- Native plugin integration
- iOS and Android build support
- Push notification support
- Camera, geolocation, and device APIs

## Alternative Approaches

Until \`@alexi/capacitor\` is available, you can:

1. **Use Capacitor directly** with your Alexi UI app
2. **Build a PWA** - Alexi UIs work as Progressive Web Apps
3. **Use WebUI** (\`@alexi/webui\`) for desktop apps

### Manual Capacitor Setup

\`\`\`bash
# Install Capacitor CLI
npm install -g @capacitor/cli

# Initialize in your UI app
cd src/myapp-ui
npx cap init "My App" com.myapp.app

# Add platforms
npx cap add ios
npx cap add android

# Build your UI
deno run -A --unstable-kv manage.ts bundle --settings ui

# Copy to native projects
npx cap copy

# Open in native IDE
npx cap open ios
npx cap open android
\`\`\`

## Import Reference

\`\`\`typescript
// Placeholder - not yet implemented
import { CapacitorConfig } from "@alexi/capacitor";
\`\`\`
`;
}
