/**
 * Content-hash fingerprinting for static entry bundles.
 *
 * Provides utilities to:
 * - Compute a short content hash (8 hex chars of SHA-256) for a file
 * - Rename entry bundles to include the hash in the filename
 * - Write/read a `staticfiles.json` manifest that maps logical names → hashed names
 * - Clean up stale hashed files from previous builds
 * - Rewrite HTML files to use hashed bundle URLs
 *
 * The manifest format is compatible with Django's ManifestStaticFilesStorage
 * concept, adapted for Alexi's needs.
 *
 * @example Manifest file (`staticfiles.json`)
 * ```json
 * {
 *   "version": 1,
 *   "files": {
 *     "myapp/myapp.js": "myapp/myapp.a1b2c3d4.js",
 *     "myapp/worker.js": "myapp/worker.e5f6a7b8.js"
 *   }
 * }
 * ```
 *
 * @module @alexi/staticfiles/fingerprint
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Staticfiles manifest structure.
 */
export interface StaticfilesManifest {
  version: 1;
  files: Record<string, string>;
}

// =============================================================================
// Hash computation
// =============================================================================

/**
 * Compute a short 8-character hex content hash of a file using SHA-256.
 *
 * @param filePath Absolute path to the file
 * @returns 8-character hex string (first 4 bytes of SHA-256)
 *
 * @internal Exported for testing only.
 */
export async function computeFileHash(filePath: string): Promise<string> {
  const content = await Deno.readFile(filePath);
  const hashBuffer = await crypto.subtle.digest("SHA-256", content);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  // Take first 4 bytes = 8 hex chars
  return hashArray
    .slice(0, 4)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// =============================================================================
// Filename helpers
// =============================================================================

/**
 * Given a base filename (e.g. `worker.js`) and a hash, return the hashed
 * filename (e.g. `worker.a1b2c3d4.js`).
 *
 * Supports `.js` and `.js.map` extensions.
 *
 * @internal Exported for testing only.
 */
export function buildHashedFilename(basename: string, hash: string): string {
  // Handle .js.map double-extension
  if (basename.endsWith(".js.map")) {
    const stem = basename.slice(0, -7); // remove ".js.map"
    return `${stem}.${hash}.js.map`;
  }
  // Standard .js
  if (basename.endsWith(".js")) {
    const stem = basename.slice(0, -3);
    return `${stem}.${hash}.js`;
  }
  // Fallback: append before last dot
  const lastDot = basename.lastIndexOf(".");
  if (lastDot === -1) return `${basename}.${hash}`;
  return `${basename.slice(0, lastDot)}.${hash}${basename.slice(lastDot)}`;
}

/**
 * Return true if a filename looks like a hashed entry bundle.
 * Pattern: `<stem>.<8hexchars>.<ext>`
 *
 * Excludes chunk files (already handled by esbuild, e.g. `chunk-abc12345.js`).
 *
 * @internal Exported for testing only.
 */
export function isHashedEntryFile(filename: string): boolean {
  return /^[^/]+\.[a-f0-9]{8}\.(js|js\.map)$/.test(filename);
}

// =============================================================================
// Filesystem operations
// =============================================================================

/**
 * Remove stale hashed entry files in a directory.
 *
 * Deletes files matching `<stem>.<8hexchars>.js` (but not chunk files like
 * `chunk-<hash>.js` which are handled separately).
 *
 * @param dir Absolute path to the output directory
 * @param stem The logical basename stem to clean (e.g. `worker` or `myapp`)
 *   If omitted, cleans all hashed entry files.
 *
 * @internal Exported for testing only.
 */
export async function cleanStaleHashedFiles(
  dir: string,
  stem?: string,
): Promise<void> {
  try {
    for await (const entry of Deno.readDir(dir)) {
      if (!entry.isFile) continue;
      if (!isHashedEntryFile(entry.name)) continue;

      // If a stem is given, only clean files for that stem
      if (stem) {
        const expectedPrefix = `${stem}.`;
        if (!entry.name.startsWith(expectedPrefix)) continue;
      }

      await Deno.remove(`${dir}/${entry.name}`).catch(() => {});
    }
  } catch {
    // Directory doesn't exist yet — nothing to clean
  }
}

/**
 * Rename an entry bundle to include its content hash.
 *
 * Returns the new absolute path.
 *
 * @internal Exported for testing only.
 */
export async function fingerprintFile(filePath: string): Promise<string> {
  const hash = await computeFileHash(filePath);
  const dir = filePath.substring(0, filePath.lastIndexOf("/"));
  const basename = filePath.substring(filePath.lastIndexOf("/") + 1);
  const hashedBasename = buildHashedFilename(basename, hash);
  const hashedPath = `${dir}/${hashedBasename}`;
  await Deno.rename(filePath, hashedPath);
  return hashedPath;
}

// =============================================================================
// Manifest
// =============================================================================

const MANIFEST_FILENAME = "staticfiles.json";

/**
 * Read the existing manifest from a directory, or return an empty one.
 *
 * @internal Exported for testing only.
 */
export async function readManifest(dir: string): Promise<StaticfilesManifest> {
  const manifestPath = `${dir}/${MANIFEST_FILENAME}`;
  try {
    const raw = await Deno.readTextFile(manifestPath);
    const parsed = JSON.parse(raw) as Partial<StaticfilesManifest>;
    if (parsed.version === 1 && typeof parsed.files === "object") {
      return parsed as StaticfilesManifest;
    }
  } catch {
    // File missing or invalid JSON — return a fresh manifest
  }
  return { version: 1, files: {} };
}

/**
 * Write a manifest to a directory.
 *
 * @internal Exported for testing only.
 */
export async function writeManifest(
  dir: string,
  manifest: StaticfilesManifest,
): Promise<void> {
  const manifestPath = `${dir}/${MANIFEST_FILENAME}`;
  await Deno.writeTextFile(manifestPath, JSON.stringify(manifest, null, 2));
}

/**
 * Resolve a logical static file name to its hashed counterpart using the
 * manifest.
 *
 * Falls back to the logical name if no mapping exists (e.g. in development
 * when fingerprinting is disabled, or for files not in the manifest).
 *
 * @param staticUrl The STATIC_URL prefix (e.g. "/static/")
 * @param logicalPath The logical path relative to STATIC_URL (e.g. "myapp/myapp.js")
 * @param manifestDir Absolute path to the directory containing staticfiles.json
 * @returns Full URL path (e.g. "/static/myapp/myapp.a1b2c3d4.js")
 *
 * @internal Exported for testing only.
 */
export async function resolveStaticUrl(
  staticUrl: string,
  logicalPath: string,
  manifestDir: string,
): Promise<string> {
  const manifest = await readManifest(manifestDir);
  const hashed = manifest.files[logicalPath] ?? logicalPath;
  const base = staticUrl.endsWith("/") ? staticUrl : `${staticUrl}/`;
  return `${base}${hashed}`;
}

// =============================================================================
// HTML rewriting
// =============================================================================

/**
 * Rewrite an HTML file in-place, replacing static asset references with their
 * hashed counterparts as recorded in the manifest.
 *
 * Only replaces occurrences of the exact logical paths in `src="..."`,
 * `href="..."`, and JS string literals (for SW registration calls).
 *
 * @param htmlPath Absolute path to the HTML file to rewrite
 * @param staticUrl The STATIC_URL prefix (e.g. "/static/")
 * @param manifest The manifest to use for resolving hashed names
 *
 * @internal Exported for testing only.
 */
export async function rewriteHtmlAssetRefs(
  htmlPath: string,
  staticUrl: string,
  manifest: StaticfilesManifest,
): Promise<void> {
  let html: string;
  try {
    html = await Deno.readTextFile(htmlPath);
  } catch {
    // File doesn't exist — nothing to rewrite
    return;
  }

  const base = staticUrl.endsWith("/") ? staticUrl : `${staticUrl}/`;
  let modified = false;

  for (const [logical, hashed] of Object.entries(manifest.files)) {
    if (logical === hashed) continue;

    const logicalUrl = `${base}${logical}`;
    const hashedUrl = `${base}${hashed}`;

    if (html.includes(logicalUrl)) {
      html = html.replaceAll(logicalUrl, hashedUrl);
      modified = true;
    }
  }

  if (modified) {
    await Deno.writeTextFile(htmlPath, html);
  }
}

// =============================================================================
// High-level: fingerprint entry bundle + update manifest
// =============================================================================

/**
 * Fingerprint a built entry bundle file:
 * 1. Remove stale hashed files for this stem
 * 2. Rename to `<stem>.<hash>.js`
 * 3. Update/write the manifest in the output directory
 *
 * The manifest uses paths relative to the static root, e.g.
 * `myapp/myapp.js` → `myapp/myapp.a1b2c3d4.js`.
 *
 * @param outputPath Absolute path to the built entry file (e.g. `.../static/myapp/myapp.js`)
 * @param staticRoot Absolute path to the static root (e.g. `.../static`)
 *   Used to compute the logical name relative path for the manifest key.
 * @returns The hashed absolute path
 *
 * @internal Exported for testing only.
 */
export async function fingerprintEntryBundle(
  outputPath: string,
  staticRoot: string,
): Promise<string> {
  const outputDir = outputPath.substring(0, outputPath.lastIndexOf("/"));
  const basename = outputPath.substring(outputPath.lastIndexOf("/") + 1);
  const stem = basename.endsWith(".js") ? basename.slice(0, -3) : basename;

  // Compute logical path (relative to staticRoot)
  // e.g. "/abs/static/myapp/myapp.js" with staticRoot="/abs/static" → "myapp/myapp.js"
  const normalizedOutputPath = outputPath.replace(/\\/g, "/");
  const normalizedStaticRoot = staticRoot.replace(/\\/g, "/").replace(
    /\/$/,
    "",
  );
  const logicalPath = normalizedOutputPath.startsWith(normalizedStaticRoot)
    ? normalizedOutputPath.slice(normalizedStaticRoot.length + 1)
    : basename;

  // Step 1: Clean stale hashed files for this stem
  await cleanStaleHashedFiles(outputDir, stem);

  // Step 2: Rename file to include hash
  const hashedPath = await fingerprintFile(outputPath);
  const hashedBasename = hashedPath.substring(hashedPath.lastIndexOf("/") + 1);

  // Compute hashed logical path
  const logicalDir = logicalPath.includes("/")
    ? logicalPath.substring(0, logicalPath.lastIndexOf("/"))
    : "";
  const hashedLogicalPath = logicalDir
    ? `${logicalDir}/${hashedBasename}`
    : hashedBasename;

  // Step 3: Read + update manifest in the output dir
  const manifest = await readManifest(outputDir);
  manifest.files[logicalPath] = hashedLogicalPath;
  await writeManifest(outputDir, manifest);

  return hashedPath;
}
