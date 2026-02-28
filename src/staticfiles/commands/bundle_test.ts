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
  collectAllTemplates,
  generateTemplatesModule,
  resolveTemplatesDir,
  scanTemplatesDir,
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
// collectAllTemplates
// =============================================================================

Deno.test(
  "collectAllTemplates: collects templates from multiple apps",
  async () => {
    const tmpDir = await Deno.makeTempDir();
    try {
      // Set up two apps with template dirs
      const app1Templates = join(tmpDir, "app1", "templates");
      const app2Templates = join(tmpDir, "app2", "templates");
      await Deno.mkdir(join(app1Templates, "app1"), { recursive: true });
      await Deno.mkdir(join(app2Templates, "app2"), { recursive: true });

      await Deno.writeTextFile(
        join(app1Templates, "app1", "page.html"),
        "<p>App1</p>",
      );
      await Deno.writeTextFile(
        join(app2Templates, "app2", "home.html"),
        "<p>App2</p>",
      );

      // Create mock import functions that return AppConfig-like objects.
      // Use file:// URLs so resolveTemplatesDir handles them as absolute paths
      // on all platforms (avoids the relative-path branch).
      const app1Url =
        new URL(`file://${app1Templates.replace(/\\/g, "/")}`).href;
      const app2Url =
        new URL(`file://${app2Templates.replace(/\\/g, "/")}`).href;

      const importFunctions = [
        () =>
          Promise.resolve({
            default: {
              name: "app1",
              templatesDir: app1Url,
            },
          }),
        () =>
          Promise.resolve({
            default: {
              name: "app2",
              templatesDir: app2Url,
            },
          }),
      ];

      const results = await collectAllTemplates(
        importFunctions as never,
        tmpDir,
      );

      assertEquals(results.length, 2);
      const names = results.map((r) => r.name).sort();
      assertEquals(names, ["app1/page.html", "app2/home.html"]);
    } finally {
      await Deno.remove(tmpDir, { recursive: true });
    }
  },
);

Deno.test(
  "collectAllTemplates: skips apps without templatesDir",
  async () => {
    const tmpDir = await Deno.makeTempDir();
    try {
      const importFunctions = [
        () =>
          Promise.resolve({
            default: { name: "no-templates" }, // no templatesDir
          }),
      ];

      const results = await collectAllTemplates(
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
  "collectAllTemplates: skips apps that fail to import",
  async () => {
    const tmpDir = await Deno.makeTempDir();
    try {
      const importFunctions = [
        () => Promise.reject(new Error("import failed")),
      ];

      const results = await collectAllTemplates(
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
