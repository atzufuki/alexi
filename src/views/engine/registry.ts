/**
 * Alexi Template Engine - Template Registry
 *
 * Provides two `TemplateLoader` implementations:
 *
 * 1. `MemoryTemplateLoader` — in-memory map, used in Service Workers and tests.
 *    Templates are registered programmatically (populated at bundle time).
 *
 * 2. `FilesystemTemplateLoader` — reads files from configured template
 *    directories.  Server-only (uses Deno.readTextFile).
 *
 * Additionally, a global singleton registry (`templateRegistry`) is exposed
 * so that `AppConfig.templatesDir` entries can be registered during
 * Application startup.
 */

import type { TemplateLoader } from "./renderer.ts";

// =============================================================================
// MemoryTemplateLoader
// =============================================================================

/**
 * In-memory template loader.
 *
 * Register templates programmatically:
 * ```ts
 * loader.register("my-app/note_list.html", "<html>...</html>");
 * ```
 *
 * Compatible with Service Workers and browsers (no filesystem access).
 */
export class MemoryTemplateLoader implements TemplateLoader {
  private readonly templates = new Map<string, string>();

  /**
   * Register a template by name.
   *
   * @param name    - Template name, e.g. `"my-app/note_list.html"`
   * @param source  - Template source string
   */
  register(name: string, source: string): void {
    this.templates.set(name, source);
  }

  /**
   * Register multiple templates at once.
   */
  registerAll(entries: Record<string, string>): void {
    for (const [name, source] of Object.entries(entries)) {
      this.templates.set(name, source);
    }
  }

  async load(name: string): Promise<string> {
    const source = this.templates.get(name);
    if (source === undefined) {
      throw new TemplateNotFoundError(name);
    }
    // async signature for interface compatibility
    return await Promise.resolve(source);
  }

  /** Remove all registered templates. */
  clear(): void {
    this.templates.clear();
  }

  /** Check whether a template is registered. */
  has(name: string): boolean {
    return this.templates.has(name);
  }
}

// =============================================================================
// FilesystemTemplateLoader  (server / Deno only)
// =============================================================================

/**
 * Template loader that reads `.html` files from a list of template
 * directories.
 *
 * Template directories are searched in order — first match wins.
 * Django-style namespacing is supported: a template named
 * `"my-app/note_list.html"` is looked up at
 * `<templateDir>/my-app/note_list.html`.
 *
 * **Server-only** — uses `Deno.readTextFile`.
 */
export class FilesystemTemplateLoader implements TemplateLoader {
  private readonly dirs: string[];

  /**
   * @param dirs - Ordered list of template root directories.
   *               Each entry may be an absolute path or a `file://` URL string.
   */
  constructor(dirs: string[]) {
    this.dirs = dirs.map(normalizeDir);
  }

  /**
   * Add a template directory at the end of the search path.
   */
  addDir(dir: string): void {
    this.dirs.push(normalizeDir(dir));
  }

  async load(name: string): Promise<string> {
    for (const dir of this.dirs) {
      const fullPath = `${dir}/${name}`;
      try {
        return await Deno.readTextFile(fullPath);
      } catch {
        // Not found in this directory — try next
      }
    }
    throw new TemplateNotFoundError(name, this.dirs);
  }
}

// =============================================================================
// ChainTemplateLoader
// =============================================================================

/**
 * Chains multiple loaders together — tries each in order.
 * Useful for combining an in-memory override layer with a filesystem layer.
 */
export class ChainTemplateLoader implements TemplateLoader {
  constructor(private readonly loaders: TemplateLoader[]) {}

  async load(name: string): Promise<string> {
    for (const loader of this.loaders) {
      try {
        return await loader.load(name);
      } catch (err) {
        if (!(err instanceof TemplateNotFoundError)) throw err;
      }
    }
    throw new TemplateNotFoundError(name);
  }
}

// =============================================================================
// Global Registry Singleton
// =============================================================================

/**
 * Global in-memory template registry.
 *
 * On the server, the `Application` populates this from each installed app's
 * `templatesDir` at startup.  In a Service Worker, the bundle populates it
 * during the install event.
 *
 * `templateView` uses this registry by default when `templateName` is given.
 */
export const templateRegistry = new MemoryTemplateLoader();

// =============================================================================
// TemplateNotFoundError
// =============================================================================

export class TemplateNotFoundError extends Error {
  constructor(name: string, dirs?: string[]) {
    const extra = dirs ? ` (searched: ${dirs.join(", ")})` : "";
    super(`Template not found: "${name}"${extra}`);
    this.name = "TemplateNotFoundError";
  }
}

// =============================================================================
// Helpers
// =============================================================================

function normalizeDir(dir: string): string {
  // Convert file:// URLs to OS paths
  if (dir.startsWith("file://")) {
    return new URL(dir).pathname.replace(/\/$/, "");
  }
  return dir.replace(/\/$/, "");
}
