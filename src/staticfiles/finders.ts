/**
 * Static File Finders
 *
 * Django-style finders that locate static files in app directories
 * or other configured locations.
 *
 * Finders are used by:
 * - Development server to serve static files
 * - collectstatic command to gather files for production
 *
 * @module alexi_staticfiles/finders
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Result of finding a static file
 */
export interface FinderResult {
  /**
   * Absolute path to the file on disk
   */
  path: string;

  /**
   * The app or source that owns this file
   */
  source: string;
}

/**
 * Static file finder interface
 */
export interface StaticFileFinder {
  /**
   * Find a static file by its URL path
   *
   * @param path - URL path relative to STATIC_URL (e.g., "comachine-ui/bundle.js")
   * @returns FinderResult if found, null otherwise
   */
  find(path: string): Promise<FinderResult | null>;

  /**
   * List all static files from this finder
   *
   * Used by collectstatic to gather all files.
   *
   * @returns AsyncGenerator of [urlPath, absolutePath, source] tuples
   */
  list(): AsyncGenerator<[string, string, string]>;
}

/**
 * Options for AppDirectoriesFinder
 */
export interface AppDirectoriesFinderOptions {
  /**
   * Installed apps list
   */
  installedApps: string[];

  /**
   * Map of app names to their paths
   */
  appPaths: Record<string, string>;

  /**
   * Project root directory
   */
  projectRoot: string;
}

/**
 * Options for FileSystemFinder
 */
export interface FileSystemFinderOptions {
  /**
   * Additional directories to search for static files
   * Similar to Django's STATICFILES_DIRS
   */
  directories: string[];

  /**
   * Project root directory
   */
  projectRoot: string;
}

// =============================================================================
// AppDirectoriesFinder
// =============================================================================

/**
 * Find static files in app directories
 *
 * Looks for files in: src/<app>/static/<app>/
 *
 * This is the Django-style convention where each app's static files
 * are namespaced under the app name to avoid conflicts.
 *
 * @example
 * ```ts
 * const finder = new AppDirectoriesFinder({
 *   installedApps: ["comachine-ui", "alexi_admin"],
 *   appPaths: {
 *     "comachine-ui": "./src/comachine-ui",
 *     "alexi_admin": "./src/alexi_admin",
 *   },
 *   projectRoot: Deno.cwd(),
 * });
 *
 * // Find: /static/comachine-ui/bundle.js
 * const result = await finder.find("comachine-ui/bundle.js");
 * // → { path: "/abs/path/src/comachine-ui/static/comachine-ui/bundle.js", source: "comachine-ui" }
 * ```
 */
export class AppDirectoriesFinder implements StaticFileFinder {
  private readonly installedApps: string[];
  private readonly appPaths: Record<string, string>;
  private readonly projectRoot: string;

  constructor(options: AppDirectoriesFinderOptions) {
    this.installedApps = options.installedApps;
    this.appPaths = options.appPaths;
    this.projectRoot = options.projectRoot;
  }

  /**
   * Find a static file by URL path
   */
  async find(urlPath: string): Promise<FinderResult | null> {
    // URL path is like "comachine-ui/bundle.js"
    // We need to find it in src/comachine-ui/static/comachine-ui/bundle.js

    for (const appName of this.installedApps) {
      const appPath = this.appPaths[appName];
      if (!appPath) continue;

      const appDir = this.resolvePath(appPath);
      const staticDir = `${appDir}/static`;

      // Try to find the file
      const filePath = `${staticDir}/${urlPath}`;

      if (await this.fileExists(filePath)) {
        return {
          path: filePath,
          source: appName,
        };
      }
    }

    return null;
  }

  /**
   * List all static files from all apps
   */
  async *list(): AsyncGenerator<[string, string, string]> {
    for (const appName of this.installedApps) {
      const appPath = this.appPaths[appName];
      if (!appPath) continue;

      const appDir = this.resolvePath(appPath);
      const staticDir = `${appDir}/static`;

      // Check if static directory exists
      if (!await this.directoryExists(staticDir)) {
        continue;
      }

      // Recursively list all files
      for await (const [urlPath, absPath] of this.walkDir(staticDir, "")) {
        yield [urlPath, absPath, appName];
      }
    }
  }

  /**
   * Resolve a path relative to project root
   */
  private resolvePath(path: string): string {
    if (path.startsWith("./")) {
      return `${this.projectRoot}/${path.slice(2)}`;
    }
    if (path.startsWith("/")) {
      return path;
    }
    return `${this.projectRoot}/${path}`;
  }

  /**
   * Check if a file exists
   */
  private async fileExists(path: string): Promise<boolean> {
    try {
      const stat = await Deno.stat(path);
      return stat.isFile;
    } catch {
      return false;
    }
  }

  /**
   * Check if a directory exists
   */
  private async directoryExists(path: string): Promise<boolean> {
    try {
      const stat = await Deno.stat(path);
      return stat.isDirectory;
    } catch {
      return false;
    }
  }

  /**
   * Recursively walk a directory and yield [urlPath, absolutePath] pairs
   */
  private async *walkDir(
    baseDir: string,
    relativePath: string,
  ): AsyncGenerator<[string, string]> {
    const currentDir = relativePath ? `${baseDir}/${relativePath}` : baseDir;

    try {
      for await (const entry of Deno.readDir(currentDir)) {
        const entryRelativePath = relativePath
          ? `${relativePath}/${entry.name}`
          : entry.name;

        if (entry.isFile) {
          yield [entryRelativePath, `${currentDir}/${entry.name}`];
        } else if (entry.isDirectory) {
          yield* this.walkDir(baseDir, entryRelativePath);
        }
      }
    } catch {
      // Directory not readable, skip
    }
  }
}

// =============================================================================
// FileSystemFinder
// =============================================================================

/**
 * Find static files in configured directories
 *
 * Similar to Django's STATICFILES_DIRS setting.
 * Useful for project-wide static files not associated with a specific app.
 *
 * @example
 * ```ts
 * const finder = new FileSystemFinder({
 *   directories: ["./assets", "./vendor/static"],
 *   projectRoot: Deno.cwd(),
 * });
 * ```
 */
export class FileSystemFinder implements StaticFileFinder {
  private readonly directories: string[];
  private readonly projectRoot: string;

  constructor(options: FileSystemFinderOptions) {
    this.directories = options.directories;
    this.projectRoot = options.projectRoot;
  }

  /**
   * Find a static file by URL path
   */
  async find(urlPath: string): Promise<FinderResult | null> {
    for (const dir of this.directories) {
      const baseDir = this.resolvePath(dir);
      const filePath = `${baseDir}/${urlPath}`;

      if (await this.fileExists(filePath)) {
        return {
          path: filePath,
          source: dir,
        };
      }
    }

    return null;
  }

  /**
   * List all static files from configured directories
   */
  async *list(): AsyncGenerator<[string, string, string]> {
    for (const dir of this.directories) {
      const baseDir = this.resolvePath(dir);

      if (!await this.directoryExists(baseDir)) {
        continue;
      }

      for await (const [urlPath, absPath] of this.walkDir(baseDir, "")) {
        yield [urlPath, absPath, dir];
      }
    }
  }

  /**
   * Resolve a path relative to project root
   */
  private resolvePath(path: string): string {
    if (path.startsWith("./")) {
      return `${this.projectRoot}/${path.slice(2)}`;
    }
    if (path.startsWith("/")) {
      return path;
    }
    return `${this.projectRoot}/${path}`;
  }

  /**
   * Check if a file exists
   */
  private async fileExists(path: string): Promise<boolean> {
    try {
      const stat = await Deno.stat(path);
      return stat.isFile;
    } catch {
      return false;
    }
  }

  /**
   * Check if a directory exists
   */
  private async directoryExists(path: string): Promise<boolean> {
    try {
      const stat = await Deno.stat(path);
      return stat.isDirectory;
    } catch {
      return false;
    }
  }

  /**
   * Recursively walk a directory
   */
  private async *walkDir(
    baseDir: string,
    relativePath: string,
  ): AsyncGenerator<[string, string]> {
    const currentDir = relativePath ? `${baseDir}/${relativePath}` : baseDir;

    try {
      for await (const entry of Deno.readDir(currentDir)) {
        const entryRelativePath = relativePath
          ? `${relativePath}/${entry.name}`
          : entry.name;

        if (entry.isFile) {
          yield [entryRelativePath, `${currentDir}/${entry.name}`];
        } else if (entry.isDirectory) {
          yield* this.walkDir(baseDir, entryRelativePath);
        }
      }
    } catch {
      // Directory not readable, skip
    }
  }
}

// =============================================================================
// StaticFileFinders (Registry)
// =============================================================================

/**
 * Combined static file finder that searches multiple finders
 *
 * This is the main entry point for finding static files.
 * It searches finders in order and returns the first match.
 */
export class StaticFileFinders implements StaticFileFinder {
  private readonly finders: StaticFileFinder[];

  constructor(finders: StaticFileFinder[]) {
    this.finders = finders;
  }

  /**
   * Create finders from settings
   */
  static fromSettings(settings: {
    installedApps: string[];
    appPaths: Record<string, string>;
    staticFilesDirs?: string[];
    projectRoot?: string;
  }): StaticFileFinders {
    const projectRoot = settings.projectRoot ?? Deno.cwd();
    const finders: StaticFileFinder[] = [];

    // FileSystemFinder for STATICFILES_DIRS (searched first)
    if (settings.staticFilesDirs && settings.staticFilesDirs.length > 0) {
      finders.push(
        new FileSystemFinder({
          directories: settings.staticFilesDirs,
          projectRoot,
        }),
      );
    }

    // AppDirectoriesFinder for app static directories
    finders.push(
      new AppDirectoriesFinder({
        installedApps: settings.installedApps,
        appPaths: settings.appPaths,
        projectRoot,
      }),
    );

    return new StaticFileFinders(finders);
  }

  /**
   * Find a static file by URL path
   */
  async find(urlPath: string): Promise<FinderResult | null> {
    for (const finder of this.finders) {
      const result = await finder.find(urlPath);
      if (result) {
        return result;
      }
    }
    return null;
  }

  /**
   * List all static files from all finders
   */
  async *list(): AsyncGenerator<[string, string, string]> {
    // Track seen paths to avoid duplicates
    const seen = new Set<string>();

    for (const finder of this.finders) {
      for await (const [urlPath, absPath, source] of finder.list()) {
        if (!seen.has(urlPath)) {
          seen.add(urlPath);
          yield [urlPath, absPath, source];
        }
      }
    }
  }
}
