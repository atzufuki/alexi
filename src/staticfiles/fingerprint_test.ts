/**
 * Tests for content-hash fingerprinting utilities.
 *
 * @module @alexi/staticfiles/fingerprint_test
 */

import { assertEquals, assertMatch, assertNotEquals } from "jsr:@std/assert@1";
import {
  buildHashedFilename,
  cleanStaleHashedFiles,
  computeFileHash,
  fingerprintEntryBundle,
  fingerprintFile,
  isHashedEntryFile,
  readManifest,
  resolveStaticUrl,
  rewriteHtmlAssetRefs,
  writeManifest,
} from "./fingerprint.ts";
import { join } from "@std/path";

// =============================================================================
// buildHashedFilename
// =============================================================================

Deno.test("buildHashedFilename: .js file", () => {
  assertEquals(
    buildHashedFilename("worker.js", "a1b2c3d4"),
    "worker.a1b2c3d4.js",
  );
  assertEquals(
    buildHashedFilename("document.js", "deadbeef"),
    "document.deadbeef.js",
  );
  assertEquals(
    buildHashedFilename("my-app.js", "12345678"),
    "my-app.12345678.js",
  );
});

Deno.test("buildHashedFilename: .js.map file", () => {
  assertEquals(
    buildHashedFilename("worker.js.map", "a1b2c3d4"),
    "worker.a1b2c3d4.js.map",
  );
});

Deno.test("buildHashedFilename: other extension (fallback)", () => {
  assertEquals(
    buildHashedFilename("style.css", "a1b2c3d4"),
    "style.a1b2c3d4.css",
  );
});

Deno.test("buildHashedFilename: no extension", () => {
  assertEquals(buildHashedFilename("noext", "a1b2c3d4"), "noext.a1b2c3d4");
});

// =============================================================================
// isHashedEntryFile
// =============================================================================

Deno.test("isHashedEntryFile: correctly identifies hashed entry files", () => {
  // Valid hashed files
  assertEquals(isHashedEntryFile("worker.a1b2c3d4.js"), true);
  assertEquals(isHashedEntryFile("document.deadbeef.js"), true);
  assertEquals(isHashedEntryFile("my-app.12345678.js"), true);
  assertEquals(isHashedEntryFile("worker.a1b2c3d4.js.map"), true);
});

Deno.test("isHashedEntryFile: correctly rejects non-hashed files", () => {
  // Plain files
  assertEquals(isHashedEntryFile("worker.js"), false);
  assertEquals(isHashedEntryFile("document.js"), false);
  // Chunk files (esbuild style with dash)
  assertEquals(isHashedEntryFile("chunk-a1b2c3d4.js"), false);
  assertEquals(isHashedEntryFile("main-a1b2c3d4.js"), false);
  // Hash too short
  assertEquals(isHashedEntryFile("worker.abc.js"), false);
  // Hash with uppercase (not matching [a-f0-9])
  assertEquals(isHashedEntryFile("worker.A1B2C3D4.js"), false);
  // Path separators not allowed
  assertEquals(isHashedEntryFile("chunks/worker.a1b2c3d4.js"), false);
});

// =============================================================================
// computeFileHash
// =============================================================================

Deno.test("computeFileHash: returns 8 hex chars", async () => {
  const dir = await Deno.makeTempDir();
  try {
    const filePath = join(dir, "test.js");
    await Deno.writeTextFile(filePath, "console.log('hello');");
    const hash = await computeFileHash(filePath);
    assertEquals(hash.length, 8);
    assertMatch(hash, /^[a-f0-9]{8}$/);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("computeFileHash: same content → same hash", async () => {
  const dir = await Deno.makeTempDir();
  try {
    const content = "const x = 1;";
    const file1 = join(dir, "a.js");
    const file2 = join(dir, "b.js");
    await Deno.writeTextFile(file1, content);
    await Deno.writeTextFile(file2, content);
    const hash1 = await computeFileHash(file1);
    const hash2 = await computeFileHash(file2);
    assertEquals(hash1, hash2);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("computeFileHash: different content → different hash", async () => {
  const dir = await Deno.makeTempDir();
  try {
    const file1 = join(dir, "a.js");
    const file2 = join(dir, "b.js");
    await Deno.writeTextFile(file1, "const x = 1;");
    await Deno.writeTextFile(file2, "const x = 2;");
    const hash1 = await computeFileHash(file1);
    const hash2 = await computeFileHash(file2);
    assertNotEquals(hash1, hash2);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

// =============================================================================
// cleanStaleHashedFiles
// =============================================================================

Deno.test("cleanStaleHashedFiles: removes hashed entry files for matching stem", async () => {
  const dir = await Deno.makeTempDir();
  try {
    // Create some files
    await Deno.writeTextFile(join(dir, "worker.a1b2c3d4.js"), "");
    await Deno.writeTextFile(join(dir, "worker.deadbeef.js"), "");
    await Deno.writeTextFile(join(dir, "document.12345678.js"), ""); // different stem
    await Deno.writeTextFile(join(dir, "worker.js"), ""); // unhashed, should survive
    await Deno.writeTextFile(join(dir, "chunk-a1b2c3d4.js"), ""); // chunk, should survive

    await cleanStaleHashedFiles(dir, "worker");

    // worker hashed files should be gone
    try {
      await Deno.stat(join(dir, "worker.a1b2c3d4.js"));
      throw new Error("File should have been deleted");
    } catch (e) {
      if (!(e instanceof Deno.errors.NotFound)) throw e;
    }
    try {
      await Deno.stat(join(dir, "worker.deadbeef.js"));
      throw new Error("File should have been deleted");
    } catch (e) {
      if (!(e instanceof Deno.errors.NotFound)) throw e;
    }

    // document hashed file should remain (different stem)
    await Deno.stat(join(dir, "document.12345678.js"));
    // unhashed worker.js should remain
    await Deno.stat(join(dir, "worker.js"));
    // chunk file should remain (doesn't match isHashedEntryFile)
    await Deno.stat(join(dir, "chunk-a1b2c3d4.js"));
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("cleanStaleHashedFiles: no stem → cleans all hashed entry files", async () => {
  const dir = await Deno.makeTempDir();
  try {
    await Deno.writeTextFile(join(dir, "worker.a1b2c3d4.js"), "");
    await Deno.writeTextFile(join(dir, "document.deadbeef.js"), "");
    await Deno.writeTextFile(join(dir, "worker.js"), ""); // unhashed, should survive

    await cleanStaleHashedFiles(dir);

    // Both hashed files should be gone
    for (const name of ["worker.a1b2c3d4.js", "document.deadbeef.js"]) {
      try {
        await Deno.stat(join(dir, name));
        throw new Error(`File ${name} should have been deleted`);
      } catch (e) {
        if (!(e instanceof Deno.errors.NotFound)) throw e;
      }
    }
    // Unhashed file survives
    await Deno.stat(join(dir, "worker.js"));
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("cleanStaleHashedFiles: non-existent dir is a no-op", async () => {
  // Should not throw
  await cleanStaleHashedFiles("/tmp/__alexi_does_not_exist__");
});

// =============================================================================
// fingerprintFile
// =============================================================================

Deno.test("fingerprintFile: renames file with hash", async () => {
  const dir = await Deno.makeTempDir();
  try {
    const filePath = join(dir, "worker.js").replace(/\\/g, "/");
    await Deno.writeTextFile(
      filePath,
      "self.addEventListener('install', () => {});",
    );

    const hashedPath = await fingerprintFile(filePath);

    // New path should contain the hash pattern
    assertMatch(hashedPath.split("/").pop() ?? "", /^worker\.[a-f0-9]{8}\.js$/);
    // Original file should no longer exist
    try {
      await Deno.stat(filePath);
      throw new Error("Original file should be gone after rename");
    } catch (e) {
      if (!(e instanceof Deno.errors.NotFound)) throw e;
    }
    // New file should exist
    await Deno.stat(hashedPath);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

// =============================================================================
// readManifest / writeManifest
// =============================================================================

Deno.test("readManifest: returns empty manifest when file does not exist", async () => {
  const dir = await Deno.makeTempDir();
  try {
    const manifest = await readManifest(dir);
    assertEquals(manifest.version, 1);
    assertEquals(manifest.files, {});
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("readManifest / writeManifest: round-trip", async () => {
  const dir = await Deno.makeTempDir();
  try {
    const manifest = {
      version: 1 as const,
      files: {
        "myapp/myapp.js": "myapp/myapp.a1b2c3d4.js",
        "myapp/worker.js": "myapp/worker.js",
      },
    };
    await writeManifest(dir, manifest);
    const read = await readManifest(dir);
    assertEquals(read, manifest);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("readManifest: returns empty manifest for invalid JSON", async () => {
  const dir = await Deno.makeTempDir();
  try {
    await Deno.writeTextFile(join(dir, "staticfiles.json"), "{ invalid json }");
    const manifest = await readManifest(dir);
    assertEquals(manifest.version, 1);
    assertEquals(manifest.files, {});
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

// =============================================================================
// resolveStaticUrl
// =============================================================================

Deno.test("resolveStaticUrl: resolves to hashed URL when in manifest", async () => {
  const dir = await Deno.makeTempDir();
  try {
    await writeManifest(dir, {
      version: 1,
      files: { "myapp/myapp.js": "myapp/myapp.a1b2c3d4.js" },
    });
    const url = await resolveStaticUrl("/static/", "myapp/myapp.js", dir);
    assertEquals(url, "/static/myapp/myapp.a1b2c3d4.js");
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("resolveStaticUrl: falls back to logical path when not in manifest", async () => {
  const dir = await Deno.makeTempDir();
  try {
    const url = await resolveStaticUrl("/static/", "myapp/worker.js", dir);
    assertEquals(url, "/static/myapp/worker.js");
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("resolveStaticUrl: handles staticUrl without trailing slash", async () => {
  const dir = await Deno.makeTempDir();
  try {
    await writeManifest(dir, {
      version: 1,
      files: { "myapp/myapp.js": "myapp/myapp.a1b2c3d4.js" },
    });
    const url = await resolveStaticUrl("/static", "myapp/myapp.js", dir);
    assertEquals(url, "/static/myapp/myapp.a1b2c3d4.js");
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

// =============================================================================
// rewriteHtmlAssetRefs
// =============================================================================

Deno.test("rewriteHtmlAssetRefs: rewrites script src", async () => {
  const dir = await Deno.makeTempDir();
  try {
    const htmlPath = join(dir, "index.html").replace(/\\/g, "/");
    await Deno.writeTextFile(
      htmlPath,
      `<html><head><script type="module" src="/static/myapp/myapp.js"></script></head></html>`,
    );
    await rewriteHtmlAssetRefs(htmlPath, "/static/", {
      version: 1,
      files: { "myapp/myapp.js": "myapp/myapp.a1b2c3d4.js" },
    });
    const result = await Deno.readTextFile(htmlPath);
    assertEquals(
      result,
      `<html><head><script type="module" src="/static/myapp/myapp.a1b2c3d4.js"></script></head></html>`,
    );
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("rewriteHtmlAssetRefs: rewrites SW registration string literal", async () => {
  const dir = await Deno.makeTempDir();
  try {
    const htmlPath = join(dir, "index.html").replace(/\\/g, "/");
    await Deno.writeTextFile(
      htmlPath,
      `<script>navigator.serviceWorker.register("/static/myapp/worker.js");</script>`,
    );
    // worker.js is not fingerprinted — mapping same → same is a no-op
    await rewriteHtmlAssetRefs(htmlPath, "/static/", {
      version: 1,
      files: {
        "myapp/myapp.js": "myapp/myapp.a1b2c3d4.js",
        // worker.js intentionally absent — no mapping
      },
    });
    // Should be unchanged (no mapping for worker.js)
    const result = await Deno.readTextFile(htmlPath);
    assertEquals(
      result,
      `<script>navigator.serviceWorker.register("/static/myapp/worker.js");</script>`,
    );
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("rewriteHtmlAssetRefs: no-op when file does not exist", async () => {
  // Should not throw
  await rewriteHtmlAssetRefs("/tmp/__nonexistent__.html", "/static/", {
    version: 1,
    files: {},
  });
});

Deno.test("rewriteHtmlAssetRefs: no-op when no matching URLs in HTML", async () => {
  const dir = await Deno.makeTempDir();
  try {
    const htmlPath = join(dir, "index.html").replace(/\\/g, "/");
    const original = `<html><body>No static refs here.</body></html>`;
    await Deno.writeTextFile(htmlPath, original);
    await rewriteHtmlAssetRefs(htmlPath, "/static/", {
      version: 1,
      files: { "myapp/myapp.js": "myapp/myapp.a1b2c3d4.js" },
    });
    const result = await Deno.readTextFile(htmlPath);
    assertEquals(result, original);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

// =============================================================================
// fingerprintEntryBundle (integration)
// =============================================================================

Deno.test("fingerprintEntryBundle: renames file and writes manifest", async () => {
  const staticRoot = await Deno.makeTempDir();
  try {
    const appDir = join(staticRoot, "myapp");
    await Deno.mkdir(appDir, { recursive: true });
    const outputPath = join(appDir, "myapp.js").replace(/\\/g, "/");
    const staticRootNorm = staticRoot.replace(/\\/g, "/");
    await Deno.writeTextFile(outputPath, "console.log('myapp');");

    const hashedPath = await fingerprintEntryBundle(outputPath, staticRootNorm);

    // Should return a hashed path
    const hashedBasename = hashedPath.split("/").pop() ?? "";
    assertMatch(hashedBasename, /^myapp\.[a-f0-9]{8}\.js$/);

    // Manifest should be written in the output dir (myapp/)
    const manifest = await readManifest(join(appDir).replace(/\\/g, "/"));
    assertEquals(Object.keys(manifest.files).length, 1);
    // Key should be relative to staticRoot
    const key = "myapp/myapp.js";
    assertEquals(key in manifest.files, true);
    assertMatch(manifest.files[key], /^myapp\/myapp\.[a-f0-9]{8}\.js$/);
  } finally {
    await Deno.remove(staticRoot, { recursive: true });
  }
});

Deno.test("fingerprintEntryBundle: cleans stale hashed files before rebuild", async () => {
  const staticRoot = await Deno.makeTempDir();
  try {
    const appDir = join(staticRoot, "myapp");
    await Deno.mkdir(appDir, { recursive: true });

    // Pre-existing stale hashed file
    const stale = join(appDir, "myapp.00000000.js").replace(/\\/g, "/");
    await Deno.writeTextFile(stale, "stale content");

    const outputPath = join(appDir, "myapp.js").replace(/\\/g, "/");
    const staticRootNorm = staticRoot.replace(/\\/g, "/");
    await Deno.writeTextFile(outputPath, "console.log('fresh');");

    await fingerprintEntryBundle(outputPath, staticRootNorm);

    // Stale file should be gone
    try {
      await Deno.stat(stale);
      throw new Error("Stale file should have been cleaned up");
    } catch (e) {
      if (!(e instanceof Deno.errors.NotFound)) throw e;
    }
  } finally {
    await Deno.remove(staticRoot, { recursive: true });
  }
});
