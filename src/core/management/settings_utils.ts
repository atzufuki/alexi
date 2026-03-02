/**
 * Shared settings path resolution utilities.
 *
 * These helpers are used by all management commands that accept a `--settings`
 * argument so that every command resolves the path identically.
 *
 * Supported argument formats:
 *   - Short name:      "web"              → <projectRoot>/project/web.settings.ts
 *   - Dotted module:   "project.web"      → <projectRoot>/project/web.ts
 *   - Relative path:   "./project/settings.ts" → <projectRoot>/project/settings.ts
 *   - Absolute path:   "/home/user/settings.ts" → /home/user/settings.ts
 *
 * @module @alexi/core/management/settings_utils
 * @internal
 */

// =============================================================================
// toImportUrl
// =============================================================================

/**
 * Convert a file system path to a `file://` URL string suitable for dynamic
 * `import()`.  Handles Windows (`C:\`, `C:/`) and Unix paths.
 *
 * @param filePath - Absolute file system path
 * @returns `file://` URL string
 * @internal
 */
export function toImportUrl(filePath: string): string {
  // Normalize backslashes to forward slashes
  let normalized = filePath.replace(/\\/g, "/");

  // Remove leading ./ if present (shouldn't normally reach here as an absolute
  // path, but guard just in case)
  if (normalized.startsWith("./")) {
    normalized = normalized.slice(2);
  }

  // Windows absolute path: C:/...
  if (/^[a-zA-Z]:\//.test(normalized)) {
    return `file:///${normalized}`;
  }

  // Windows path without leading slash: C:... (shouldn't normally happen)
  if (/^[a-zA-Z]:/.test(normalized)) {
    return `file:///${normalized}`;
  }

  // Unix absolute path
  if (normalized.startsWith("/")) {
    return `file://${normalized}`;
  }

  // Relative path — resolve against cwd
  const cwd = Deno.cwd().replace(/\\/g, "/");
  if (/^[a-zA-Z]:\//.test(cwd)) {
    return `file:///${cwd}/${normalized}`;
  }
  return `file://${cwd}/${normalized}`;
}

// =============================================================================
// resolveSettingsPath
// =============================================================================

/**
 * Resolve the `--settings` CLI argument to an absolute file system path.
 *
 * Rules (checked in order):
 * 1. Ends with `.ts`  → treat as a direct file path.
 *    - Relative (`./` / `../`) → prepend `projectRoot`.
 *    - Otherwise → prepend `projectRoot` as-is.
 * 2. Contains a `.`   → dotted module name (e.g. `project.web`)
 *    → replace `.` with `/`, append `.ts`, prepend `projectRoot`.
 * 3. Plain short name (e.g. `web`)
 *    → `<projectRoot>/project/<name>.settings.ts`.
 *
 * @param settingsArg - Raw value of the `--settings` flag
 * @param projectRoot - Absolute path to the project root (defaults to `Deno.cwd()`)
 * @returns Absolute path to the settings file
 */
export function resolveSettingsPath(
  settingsArg: string,
  projectRoot: string = Deno.cwd(),
): string {
  if (settingsArg.endsWith(".ts")) {
    // Full file path — make absolute if relative
    if (settingsArg.startsWith("./") || settingsArg.startsWith("../")) {
      return `${projectRoot}/${settingsArg.slice(2)}`;
    }
    // Already absolute, or bare path without ./ prefix
    if (
      settingsArg.startsWith("/") || /^[a-zA-Z]:/.test(settingsArg)
    ) {
      return settingsArg;
    }
    return `${projectRoot}/${settingsArg}`;
  }

  if (settingsArg.includes(".")) {
    // Dotted module name: project.web → project/web.ts
    const modulePath = settingsArg.replace(/\./g, "/");
    return `${projectRoot}/${modulePath}.ts`;
  }

  // Short name: web → <projectRoot>/project/web.settings.ts
  return `${projectRoot}/project/${settingsArg}.settings.ts`;
}
