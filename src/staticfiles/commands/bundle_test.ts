/**
 * Bundle Command Tests — Template Scanning & Embedding
 *
 * Tests for the template-embedding helpers used by the bundle command to
 * embed `.html` template files into Service Worker bundles via a virtual
 * esbuild module.
 */

import { assertEquals, assertMatch, assertStringIncludes } from "@std/assert";
import { join, toFileUrl } from "@std/path";
import {
  buildSWBundle,
  collectTemplatesFromConfig,
  generateTemplatesModule,
  isServiceWorkerFilename,
  resolveTemplatesDir,
  rewriteHtmlReferences,
  scanTemplatesDir,
  writeManifest,
} from "./bundle.ts";

// =============================================================================
// resolveTemplatesDir
// =============================================================================

Deno.test("resolveTemplatesDir: returns null for empty string", () => {
  const result = resolveTemplatesDir("", "/project");
  assertEquals(result, null);
});

Deno.test("resolveTemplatesDir: resolves relative path against projectRoot", () => {
  const result = resolveTemplatesDir("src/my-app/templates", "/project");
  assertEquals(result, "/project/src/my-app/templates");
});

Deno.test(
  "resolveTemplatesDir: strips leading ./ from relative path",
  () => {
    const result = resolveTemplatesDir("./src/my-app/templates", "/project");
    assertEquals(result, "/project/src/my-app/templates");
  },
);

Deno.test("resolveTemplatesDir: resolves file:// URL on Unix-style path", () => {
  const result = resolveTemplatesDir(
    "file:///project/src/my-app/templates",
    "/ignored",
  );
  assertEquals(result, "/project/src/my-app/templates");
});

// =============================================================================
// scanTemplatesDir
// =============================================================================

Deno.test("scanTemplatesDir: returns empty array for nonexistent directory", async () => {
  const tmpDir = await Deno.makeTempDir();
  try {
    const results = await scanTemplatesDir(join(tmpDir, "does-not-exist"));
    assertEquals(results, []);
  } finally {
    await Deno.remove(tmpDir, { recursive: true });
  }
});

Deno.test(
  "scanTemplatesDir: discovers html files with Django-style names",
  async () => {
    const tmpDir = await Deno.makeTempDir();
    try {
      // Create template files:  templates/my-app/index.html
      //                         templates/my-app/base.html
      const appTemplateDir = join(tmpDir, "my-app");
      await Deno.mkdir(appTemplateDir, { recursive: true });
      await Deno.writeTextFile(
        join(appTemplateDir, "index.html"),
        "<h1>Index</h1>",
      );
      await Deno.writeTextFile(
        join(appTemplateDir, "base.html"),
        "<html>Base</html>",
      );

      const results = await scanTemplatesDir(tmpDir);

      assertEquals(results.length, 2);

      const names = results.map((r) => r.name).sort();
      assertEquals(names, ["my-app/base.html", "my-app/index.html"]);

      const index = results.find((r) => r.name === "my-app/index.html")!;
      assertEquals(index.source, "<h1>Index</h1>");
    } finally {
      await Deno.remove(tmpDir, { recursive: true });
    }
  },
);

Deno.test(
  "scanTemplatesDir: ignores non-html files",
  async () => {
    const tmpDir = await Deno.makeTempDir();
    try {
      await Deno.writeTextFile(join(tmpDir, "styles.css"), "body {}");
      await Deno.writeTextFile(join(tmpDir, "script.ts"), "export {};");
      await Deno.writeTextFile(join(tmpDir, "page.html"), "<p>Page</p>");

      const results = await scanTemplatesDir(tmpDir);

      assertEquals(results.length, 1);
      assertEquals(results[0].name, "page.html");
    } finally {
      await Deno.remove(tmpDir, { recursive: true });
    }
  },
);

Deno.test(
  "scanTemplatesDir: recursively scans nested directories",
  async () => {
    const tmpDir = await Deno.makeTempDir();
    try {
      const deepDir = join(tmpDir, "a", "b", "c");
      await Deno.mkdir(deepDir, { recursive: true });
      await Deno.writeTextFile(join(deepDir, "deep.html"), "deep");
      await Deno.writeTextFile(join(tmpDir, "root.html"), "root");

      const results = await scanTemplatesDir(tmpDir);
      const names = results.map((r) => r.name).sort();

      assertEquals(names, ["a/b/c/deep.html", "root.html"]);
    } finally {
      await Deno.remove(tmpDir, { recursive: true });
    }
  },
);

// =============================================================================
// generateTemplatesModule
// =============================================================================

Deno.test(
  "generateTemplatesModule: generates import statement",
  () => {
    const source = generateTemplatesModule([]);
    assertStringIncludes(
      source,
      'import { templateRegistry } from "@alexi/views";',
    );
  },
);

Deno.test(
  "generateTemplatesModule: generates register calls for each template",
  () => {
    const source = generateTemplatesModule([
      { name: "my-app/index.html", source: "<h1>Hello</h1>" },
      { name: "my-app/base.html", source: "<html></html>" },
    ]);

    assertStringIncludes(
      source,
      `templateRegistry.register("my-app/index.html"`,
    );
    assertStringIncludes(
      source,
      `templateRegistry.register("my-app/base.html"`,
    );
    assertStringIncludes(source, "<h1>Hello</h1>");
    assertStringIncludes(source, "<html></html>");
  },
);

Deno.test(
  "generateTemplatesModule: escapes backticks in template source",
  () => {
    const source = generateTemplatesModule([
      { name: "tpl.html", source: "Hello `world`" },
    ]);
    assertStringIncludes(source, "Hello \\`world\\`");
  },
);

Deno.test(
  "generateTemplatesModule: escapes backslashes in template source",
  () => {
    const source = generateTemplatesModule([
      { name: "tpl.html", source: "C:\\Users\\test" },
    ]);
    assertStringIncludes(source, "C:\\\\Users\\\\test");
  },
);

Deno.test(
  "generateTemplatesModule: escapes template literal interpolations",
  () => {
    const source = generateTemplatesModule([
      { name: "tpl.html", source: "Price: ${price}" },
    ]);
    assertStringIncludes(source, "Price: \\${price}");
  },
);

Deno.test(
  "generateTemplatesModule: returns empty-register module for no templates",
  () => {
    const source = generateTemplatesModule([]);
    assertMatch(
      source,
      /import \{ templateRegistry \} from "@alexi\/views";/,
    );
    // No register calls
    assertEquals(source.includes("templateRegistry.register"), false);
  },
);

// =============================================================================
// collectTemplatesFromConfig — APP_DIRS multi-app tests
// =============================================================================

Deno.test(
  "collectTemplatesFromConfig: APP_DIRS collects templates from multiple apps",
  async () => {
    const tmpDir = await Deno.makeTempDir();
    try {
      // Set up two apps each with a convention-based templates/ directory
      const app1Dir = join(tmpDir, "src", "app1");
      const app2Dir = join(tmpDir, "src", "app2");
      await Deno.mkdir(join(app1Dir, "templates", "app1"), {
        recursive: true,
      });
      await Deno.mkdir(join(app2Dir, "templates", "app2"), {
        recursive: true,
      });

      await Deno.writeTextFile(
        join(app1Dir, "templates", "app1", "page.html"),
        "<p>App1</p>",
      );
      await Deno.writeTextFile(
        join(app2Dir, "templates", "app2", "home.html"),
        "<p>App2</p>",
      );

      const importFunctions = [
        () =>
          Promise.resolve({
            default: { name: "app1", appPath: "src/app1" },
          }),
        () =>
          Promise.resolve({
            default: { name: "app2", appPath: "src/app2" },
          }),
      ];

      const results = await collectTemplatesFromConfig(
        [{ APP_DIRS: true, DIRS: [] }],
        importFunctions as never,
        tmpDir,
      );

      assertEquals(results.length, 2);
      const names = results.map((r: { name: string }) => r.name).sort();
      assertEquals(names, ["app1/page.html", "app2/home.html"]);
    } finally {
      await Deno.remove(tmpDir, { recursive: true });
    }
  },
);

Deno.test(
  "collectTemplatesFromConfig: APP_DIRS skips apps without templates/ dir",
  async () => {
    const tmpDir = await Deno.makeTempDir();
    try {
      const importFunctions = [
        () =>
          Promise.resolve({
            default: { name: "no-templates", appPath: "src/no-templates" },
          }),
      ];

      const results = await collectTemplatesFromConfig(
        [{ APP_DIRS: true, DIRS: [] }],
        importFunctions as never,
        tmpDir,
      );
      assertEquals(results, []);
    } finally {
      await Deno.remove(tmpDir, { recursive: true });
    }
  },
);

Deno.test(
  "collectTemplatesFromConfig: APP_DIRS skips apps that fail to import",
  async () => {
    const tmpDir = await Deno.makeTempDir();
    try {
      const importFunctions = [
        () => Promise.reject(new Error("import failed")),
      ];

      const results = await collectTemplatesFromConfig(
        [{ APP_DIRS: true, DIRS: [] }],
        importFunctions as never,
        tmpDir,
      );
      assertEquals(results, []);
    } finally {
      await Deno.remove(tmpDir, { recursive: true });
    }
  },
);

// =============================================================================
// buildSWBundle — integration tests
//
// These tests run a real esbuild bundle with the virtual entry + template
// embedding pipeline.  They verify that:
//   1. A plain bundle (no templates) succeeds and produces JS output.
//   2. A bundle WITH templates succeeds: the virtual entry re-exports the real
//      entry via an absolute file:// URL and embeds templateRegistry.register()
//      calls in the output.
//   3. absWorkingDir is set to cwd so esbuild does not walk above the project
//      root — on Windows this prevents "Access is denied" errors from system
//      directories like $Recycle.Bin and PerfLogs.
//
// Regression for https://github.com/atzufuki/alexi/issues/172
// =============================================================================

Deno.test({
  name: "buildSWBundle: bundles a plain entry point without templates",
  // esbuild spawns a subprocess that may outlive the test's async boundary.
  // Disable the sanitizers for these integration tests to avoid false positives.
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const tmpDir = await Deno.makeTempDir();
    try {
      // Write a minimal SW entry
      const entryPath = join(tmpDir, "sw.ts");
      await Deno.writeTextFile(entryPath, `export const SW_VERSION = "1";\n`);

      const outputPath = join(tmpDir, "dist", "sw.js").replace(/\\/g, "/");
      await Deno.mkdir(join(tmpDir, "dist"), { recursive: true });

      // configPath must be a native absolute path (not a file:// URL) —
      // esbuild-deno-loader passes it directly to WasmWorkspace.discover().
      const configPath = join(Deno.cwd(), "deno.json");
      const entryUrl = toFileUrl(entryPath).href;

      await buildSWBundle({
        entryPoint: entryUrl,
        outputPath,
        minify: false,
        templates: [],
        cwd: tmpDir,
        configPath,
      });

      const outFile = await Deno.readTextFile(join(tmpDir, "dist", "sw.js"));
      assertStringIncludes(outFile, "SW_VERSION");
    } finally {
      await Deno.remove(tmpDir, { recursive: true });
    }
  },
});

Deno.test({
  name:
    "buildSWBundle: bundles with templates and embeds templateRegistry calls",
  // esbuild spawns a subprocess that may outlive the test's async boundary.
  // Disable the sanitizers for these integration tests to avoid false positives.
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const tmpDir = await Deno.makeTempDir();
    try {
      // Write a minimal SW entry
      const entryPath = join(tmpDir, "sw.ts");
      await Deno.writeTextFile(entryPath, `export const SW_VERSION = "2";\n`);

      const outputPath = join(tmpDir, "dist", "sw.js").replace(/\\/g, "/");
      await Deno.mkdir(join(tmpDir, "dist"), { recursive: true });

      // configPath must be a native absolute path (not a file:// URL) —
      // esbuild-deno-loader passes it directly to WasmWorkspace.discover().
      const configPath = join(Deno.cwd(), "deno.json");
      const entryUrl = toFileUrl(entryPath).href;

      await buildSWBundle({
        entryPoint: entryUrl,
        outputPath,
        minify: false,
        templates: [
          { name: "my-app/index.html", source: "<h1>Hello</h1>" },
          { name: "my-app/base.html", source: "<html></html>" },
        ],
        cwd: tmpDir,
        configPath,
      });

      const outFile = await Deno.readTextFile(join(tmpDir, "dist", "sw.js"));
      // The template registry calls must be embedded in the bundle output
      assertStringIncludes(outFile, "my-app/index.html");
      assertStringIncludes(outFile, "my-app/base.html");
      assertStringIncludes(outFile, "Hello");
    } finally {
      await Deno.remove(tmpDir, { recursive: true });
    }
  },
});

// =============================================================================
// collectTemplatesFromConfig
// =============================================================================

Deno.test({
  name: "collectTemplatesFromConfig: APP_DIRS discovers <appPath>/templates/",
  // esbuild subprocess from buildSWBundle tests may still be exiting — disable
  // resource sanitizer to avoid false positives from the prior test's cleanup.
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const tmpDir = await Deno.makeTempDir();
    try {
      // Create an app with a convention-based templates/ directory
      const appDir = join(tmpDir, "src", "my-app");
      const appTemplatesDir = join(appDir, "templates");
      await Deno.mkdir(join(appTemplatesDir, "my-app"), { recursive: true });
      await Deno.writeTextFile(
        join(appTemplatesDir, "my-app", "index.html"),
        "<h1>Hello</h1>",
      );

      const importFunctions = [
        () =>
          Promise.resolve({
            default: {
              name: "my-app",
              appPath: "src/my-app",
            },
          }),
      ];

      const results = await collectTemplatesFromConfig(
        [{ APP_DIRS: true, DIRS: [] }],
        importFunctions as never,
        tmpDir,
      );

      assertEquals(results.length, 1);
      assertEquals(results[0].name, "my-app/index.html");
    } finally {
      await Deno.remove(tmpDir, { recursive: true });
    }
  },
});

Deno.test(
  "collectTemplatesFromConfig: DIRS picks up explicit extra directories",
  async () => {
    const tmpDir = await Deno.makeTempDir();
    try {
      const extraDir = join(tmpDir, "workers", "templates");
      await Deno.mkdir(join(extraDir, "my-app"), { recursive: true });
      await Deno.writeTextFile(
        join(extraDir, "my-app", "base.html"),
        "<html></html>",
      );

      const results = await collectTemplatesFromConfig(
        [{ APP_DIRS: false, DIRS: [extraDir] }],
        [],
        tmpDir,
      );

      assertEquals(results.length, 1);
      assertEquals(results[0].name, "my-app/base.html");
    } finally {
      await Deno.remove(tmpDir, { recursive: true });
    }
  },
);

Deno.test(
  "collectTemplatesFromConfig: returns empty when no dirs match",
  async () => {
    const tmpDir = await Deno.makeTempDir();
    try {
      const results = await collectTemplatesFromConfig(
        [{ APP_DIRS: true, DIRS: [] }],
        [],
        tmpDir,
      );
      assertEquals(results, []);
    } finally {
      await Deno.remove(tmpDir, { recursive: true });
    }
  },
);

Deno.test(
  "collectTemplatesFromConfig: APP_DIRS + DIRS collects from both sources",
  async () => {
    const tmpDir = await Deno.makeTempDir();
    try {
      // App with convention-based templates dir
      const appDir = join(tmpDir, "src", "my-app");
      await Deno.mkdir(join(appDir, "templates", "my-app"), {
        recursive: true,
      });
      await Deno.writeTextFile(
        join(appDir, "templates", "my-app", "app.html"),
        "<p>App</p>",
      );

      // Explicit extra dir (simulating worker templates)
      const extraDir = join(
        tmpDir,
        "src",
        "my-app",
        "workers",
        "my-app",
        "templates",
      );
      await Deno.mkdir(join(extraDir, "my-app"), { recursive: true });
      await Deno.writeTextFile(
        join(extraDir, "my-app", "worker.html"),
        "<p>Worker</p>",
      );

      const importFunctions = [
        () =>
          Promise.resolve({
            default: {
              name: "my-app",
              appPath: "src/my-app",
            },
          }),
      ];

      const results = await collectTemplatesFromConfig(
        [{ APP_DIRS: true, DIRS: [extraDir] }],
        importFunctions as never,
        tmpDir,
      );

      assertEquals(results.length, 2);
      const names = results.map((r) => r.name).sort();
      assertEquals(names, ["my-app/app.html", "my-app/worker.html"]);
    } finally {
      await Deno.remove(tmpDir, { recursive: true });
    }
  },
);

// =============================================================================
// isServiceWorkerFilename
// =============================================================================

Deno.test("isServiceWorkerFilename: returns true for sw.js", () => {
  assertEquals(isServiceWorkerFilename("sw.js"), true);
});

Deno.test("isServiceWorkerFilename: returns true for worker.js", () => {
  assertEquals(isServiceWorkerFilename("worker.js"), true);
});

Deno.test("isServiceWorkerFilename: returns true for service-worker.js", () => {
  assertEquals(isServiceWorkerFilename("service-worker.js"), true);
});

Deno.test("isServiceWorkerFilename: returns true for my_worker.js", () => {
  assertEquals(isServiceWorkerFilename("my_worker.js"), true);
});

Deno.test("isServiceWorkerFilename: returns true for app.worker.js", () => {
  assertEquals(isServiceWorkerFilename("app.worker.js"), true);
});

Deno.test("isServiceWorkerFilename: returns false for document.js", () => {
  assertEquals(isServiceWorkerFilename("document.js"), false);
});

Deno.test("isServiceWorkerFilename: returns false for bundle.js", () => {
  assertEquals(isServiceWorkerFilename("bundle.js"), false);
});

Deno.test("isServiceWorkerFilename: returns false for app.js", () => {
  assertEquals(isServiceWorkerFilename("app.js"), false);
});

Deno.test("isServiceWorkerFilename: SW basename without extension", () => {
  assertEquals(isServiceWorkerFilename("sw"), true);
});

// =============================================================================
// writeManifest
// =============================================================================

Deno.test("writeManifest: creates new manifest file", async () => {
  const tmpDir = await Deno.makeTempDir();
  try {
    await writeManifest(tmpDir, {
      "my-app/document.js": "my-app/document-a1b2c3d4.js",
    });

    const raw = await Deno.readTextFile(`${tmpDir}/staticfiles.json`);
    const parsed = JSON.parse(raw);
    assertEquals(parsed.version, 1);
    assertEquals(
      parsed.files["my-app/document.js"],
      "my-app/document-a1b2c3d4.js",
    );
  } finally {
    await Deno.remove(tmpDir, { recursive: true });
  }
});

Deno.test("writeManifest: merges with existing manifest", async () => {
  const tmpDir = await Deno.makeTempDir();
  try {
    // Write an initial manifest
    await Deno.writeTextFile(
      `${tmpDir}/staticfiles.json`,
      JSON.stringify({
        version: 1,
        files: { "my-app/old.js": "my-app/old-aabbccdd.js" },
      }),
    );

    // Merge a new entry
    await writeManifest(tmpDir, {
      "my-app/document.js": "my-app/document-a1b2c3d4.js",
    });

    const raw = await Deno.readTextFile(`${tmpDir}/staticfiles.json`);
    const parsed = JSON.parse(raw);
    assertEquals(parsed.version, 1);
    // Old entry preserved
    assertEquals(parsed.files["my-app/old.js"], "my-app/old-aabbccdd.js");
    // New entry added
    assertEquals(
      parsed.files["my-app/document.js"],
      "my-app/document-a1b2c3d4.js",
    );
  } finally {
    await Deno.remove(tmpDir, { recursive: true });
  }
});

Deno.test("writeManifest: overwrites stale entry for same key", async () => {
  const tmpDir = await Deno.makeTempDir();
  try {
    await writeManifest(tmpDir, {
      "my-app/document.js": "my-app/document-aaaaaaaa.js",
    });
    await writeManifest(tmpDir, {
      "my-app/document.js": "my-app/document-bbbbbbbb.js",
    });

    const raw = await Deno.readTextFile(`${tmpDir}/staticfiles.json`);
    const parsed = JSON.parse(raw);
    assertEquals(
      parsed.files["my-app/document.js"],
      "my-app/document-bbbbbbbb.js",
    );
  } finally {
    await Deno.remove(tmpDir, { recursive: true });
  }
});

// =============================================================================
// rewriteHtmlReferences
// =============================================================================

Deno.test("rewriteHtmlReferences: rewrites matching HTML files", async () => {
  const tmpDir = await Deno.makeTempDir();
  try {
    await Deno.writeTextFile(
      `${tmpDir}/index.html`,
      '<script src="/static/my-app/document.js"></script>',
    );

    await rewriteHtmlReferences(tmpDir, "document.js", "document-a1b2c3d4.js");

    const updated = await Deno.readTextFile(`${tmpDir}/index.html`);
    assertStringIncludes(updated, "document-a1b2c3d4.js");
    assertEquals(updated.includes("document.js"), false);
  } finally {
    await Deno.remove(tmpDir, { recursive: true });
  }
});

Deno.test("rewriteHtmlReferences: leaves HTML unmodified when no match", async () => {
  const tmpDir = await Deno.makeTempDir();
  try {
    const original = '<script src="/static/other.js"></script>';
    await Deno.writeTextFile(`${tmpDir}/index.html`, original);

    await rewriteHtmlReferences(tmpDir, "document.js", "document-a1b2c3d4.js");

    const content = await Deno.readTextFile(`${tmpDir}/index.html`);
    assertEquals(content, original);
  } finally {
    await Deno.remove(tmpDir, { recursive: true });
  }
});

Deno.test("rewriteHtmlReferences: rewrites all occurrences in a file", async () => {
  const tmpDir = await Deno.makeTempDir();
  try {
    await Deno.writeTextFile(
      `${tmpDir}/index.html`,
      "document.js document.js",
    );

    await rewriteHtmlReferences(tmpDir, "document.js", "document-a1b2c3d4.js");

    const updated = await Deno.readTextFile(`${tmpDir}/index.html`);
    assertEquals(updated, "document-a1b2c3d4.js document-a1b2c3d4.js");
  } finally {
    await Deno.remove(tmpDir, { recursive: true });
  }
});

Deno.test("rewriteHtmlReferences: skips non-HTML files", async () => {
  const tmpDir = await Deno.makeTempDir();
  try {
    await Deno.writeTextFile(`${tmpDir}/data.json`, '{"src":"document.js"}');

    await rewriteHtmlReferences(tmpDir, "document.js", "document-a1b2c3d4.js");

    const content = await Deno.readTextFile(`${tmpDir}/data.json`);
    // JSON file must not be touched
    assertStringIncludes(content, "document.js");
  } finally {
    await Deno.remove(tmpDir, { recursive: true });
  }
});

Deno.test(
  "rewriteHtmlReferences: handles non-existent directory gracefully",
  async () => {
    // Should not throw
    await rewriteHtmlReferences(
      "/non/existent/dir",
      "document.js",
      "document-a1b2c3d4.js",
    );
  },
);

// =============================================================================
// buildSWBundle — content-hash integration tests
// =============================================================================

Deno.test({
  name:
    "buildSWBundle: writes staticfiles.json manifest when entryNames contains [hash]",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const tmpDir = await Deno.makeTempDir();
    try {
      const entryPath = join(tmpDir, "document.ts");
      await Deno.writeTextFile(
        entryPath,
        `export const VERSION = "doc";\n`,
      );

      const outputDir = join(tmpDir, "dist", "my-app");
      await Deno.mkdir(outputDir, { recursive: true });
      const outputPath = join(outputDir, "document.js").replace(/\\/g, "/");

      const configPath = join(Deno.cwd(), "deno.json");
      const entryUrl = toFileUrl(entryPath).href;

      await buildSWBundle({
        entryPoint: entryUrl,
        outputPath,
        minify: false,
        templates: [],
        cwd: tmpDir,
        configPath,
        entryNames: "[name]-[hash]",
      });

      // The manifest must have been written to the parent of outputDir
      const manifestPath = join(tmpDir, "dist", "staticfiles.json");
      const raw = await Deno.readTextFile(manifestPath);
      const parsed = JSON.parse(raw);

      assertEquals(parsed.version, 1);

      const keys = Object.keys(parsed.files);
      assertEquals(keys.length, 1);
      // Key is the un-hashed logical path
      assertEquals(keys[0], "my-app/document.js");
      // Value must contain a hash (different from the plain name)
      const hashedValue: string = parsed.files["my-app/document.js"];
      assertStringIncludes(hashedValue, "document-");
      assertStringIncludes(hashedValue, ".js");
    } finally {
      await Deno.remove(tmpDir, { recursive: true });
    }
  },
});

Deno.test({
  name:
    "buildSWBundle: does NOT write staticfiles.json when entryNames has no [hash]",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const tmpDir = await Deno.makeTempDir();
    try {
      const entryPath = join(tmpDir, "document.ts");
      await Deno.writeTextFile(
        entryPath,
        `export const VERSION = "doc2";\n`,
      );

      const outputDir = join(tmpDir, "dist", "my-app");
      await Deno.mkdir(outputDir, { recursive: true });
      const outputPath = join(outputDir, "document.js").replace(/\\/g, "/");

      const configPath = join(Deno.cwd(), "deno.json");
      const entryUrl = toFileUrl(entryPath).href;

      await buildSWBundle({
        entryPoint: entryUrl,
        outputPath,
        minify: false,
        templates: [],
        cwd: tmpDir,
        configPath,
        // No [hash] — plain name pattern
        entryNames: "[name]",
      });

      let manifestExists = false;
      try {
        await Deno.stat(join(tmpDir, "dist", "staticfiles.json"));
        manifestExists = true;
      } catch {
        // expected
      }
      assertEquals(manifestExists, false);
    } finally {
      await Deno.remove(tmpDir, { recursive: true });
    }
  },
});

Deno.test({
  name: "buildSWBundle: SW entry ignores entryNames and uses plain [name]",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const tmpDir = await Deno.makeTempDir();
    try {
      const entryPath = join(tmpDir, "worker.ts");
      await Deno.writeTextFile(
        entryPath,
        `export const SW_VERSION = "sw1";\n`,
      );

      const outputDir = join(tmpDir, "dist", "my-app");
      await Deno.mkdir(outputDir, { recursive: true });
      // Output filename contains "worker" — triggers SW detection
      const outputPath = join(outputDir, "worker.js").replace(/\\/g, "/");

      const configPath = join(Deno.cwd(), "deno.json");
      const entryUrl = toFileUrl(entryPath).href;

      await buildSWBundle({
        entryPoint: entryUrl,
        outputPath,
        minify: false,
        templates: [],
        cwd: tmpDir,
        configPath,
        // Even though [hash] is requested, SW must ignore it
        entryNames: "[name]-[hash]",
      });

      // The output file must exist with the plain name (no hash suffix)
      const outFile = await Deno.readTextFile(
        join(outputDir, "worker.js"),
      );
      assertStringIncludes(outFile, "SW_VERSION");

      // No manifest must have been written for a SW entry
      let manifestExists = false;
      try {
        await Deno.stat(join(tmpDir, "dist", "staticfiles.json"));
        manifestExists = true;
      } catch {
        // expected
      }
      assertEquals(manifestExists, false);
    } finally {
      await Deno.remove(tmpDir, { recursive: true });
    }
  },
});

// =============================================================================
// buildSWBundle — virtual entry name regression (#399)
//
// When templates are embedded, the virtual esbuild entry must be named after
// the original source file so that esbuild resolves [name] correctly in
// entryNames.  Previously the virtual entry was always called
// "__alexi_sw_entry__", causing output like `__alexi_sw_entry__-<hash>.js`
// instead of `<original>-<hash>.js`.
// =============================================================================

Deno.test({
  name:
    "buildSWBundle: [name] token resolves to original filename when templates are embedded (regression #399)",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const tmpDir = await Deno.makeTempDir();
    try {
      // Non-SW entry named "myapp.ts"
      const entryPath = join(tmpDir, "myapp.ts");
      await Deno.writeTextFile(
        entryPath,
        `export const APP_VERSION = "1";\n`,
      );

      const outputDir = join(tmpDir, "dist", "my-app");
      await Deno.mkdir(outputDir, { recursive: true });
      const outputPath = join(outputDir, "myapp.js").replace(/\\/g, "/");

      const configPath = join(Deno.cwd(), "deno.json");
      const entryUrl = toFileUrl(entryPath).href;

      await buildSWBundle({
        entryPoint: entryUrl,
        outputPath,
        minify: false,
        templates: [
          { name: "my-app/index.html", source: "<h1>Hello</h1>" },
        ],
        cwd: tmpDir,
        configPath,
        entryNames: "[name]-[hash]",
      });

      // The manifest must map the logical key to a hashed file whose stem is
      // "myapp", NOT "__alexi_sw_entry__".
      const manifestPath = join(tmpDir, "dist", "staticfiles.json");
      const raw = await Deno.readTextFile(manifestPath);
      const parsed = JSON.parse(raw);

      const hashedValue: string = parsed.files["my-app/myapp.js"];
      assertStringIncludes(
        hashedValue,
        "myapp-",
        `Expected hashed filename to start with "myapp-", got: ${hashedValue}`,
      );
      assertEquals(
        hashedValue.includes("__alexi_sw_entry__"),
        false,
        `Output filename must not contain "__alexi_sw_entry__", got: ${hashedValue}`,
      );
    } finally {
      await Deno.remove(tmpDir, { recursive: true });
    }
  },
});
