/// <reference lib="deno.unstable" />

/**
 * E2E Test Utilities for @alexi/create
 *
 * Provides utilities for Playwright E2E tests including:
 * - Project scaffolding (creates temp project via @alexi/create)
 * - Server management (start/stop)
 * - Test data generation
 * - Common test helpers
 *
 * @module @alexi/create/tests/e2e_utils
 */

// =============================================================================
// Types
// =============================================================================

export interface ServerProcess {
  process: Deno.ChildProcess;
  port: number;
  baseUrl: string;
  _stderrReader?: Promise<void>;
  _stdoutReader?: Promise<void>;
}

export interface ScaffoldedProject {
  name: string;
  path: string;
}

// =============================================================================
// Constants
// =============================================================================

// Use unique test ports to avoid conflicts with dev servers (8000/5173)
// The API URL is injected into the browser via page.addInitScript
export const DEFAULT_API_PORT = 9200;
export const DEFAULT_UI_PORT = 9201;
export const DEFAULT_TIMEOUT = 30000;

// Increased timeout for CI environments where dependencies
// need to be downloaded and compiled on first run
export const SERVER_STARTUP_TIMEOUT = 120000;

// Test options to disable resource sanitizers for async tests
export const TEST_OPTIONS = {
  sanitizeOps: false,
  sanitizeResources: false,
};

// =============================================================================
// Project Scaffolding
// =============================================================================

/**
 * Generate a unique project name for testing
 */
export function generateProjectName(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `test-project-${timestamp}-${random}`;
}

/**
 * Create a new project using @alexi/create
 *
 * @param projectName - Name of the project to create
 * @param tempDir - Directory to create the project in
 * @returns ScaffoldedProject with name and path
 */
export async function createTestProject(
  projectName: string,
  tempDir: string,
): Promise<ScaffoldedProject> {
  console.log(`[e2e] Creating test project "${projectName}" in ${tempDir}`);

  const denoPath = Deno.execPath();

  // Get the path to the create package main.ts
  // We're running from alexi/src/create/tests, so main.ts is at ../main.ts
  const createMainPath = new URL("../main.ts", import.meta.url).pathname;

  // On Windows, remove leading slash from path
  const normalizedPath = Deno.build.os === "windows"
    ? createMainPath.replace(/^\//, "")
    : createMainPath;

  const command = new Deno.Command(denoPath, {
    args: [
      "run",
      "-A",
      normalizedPath,
      projectName,
    ],
    cwd: tempDir,
    stdout: "piped",
    stderr: "piped",
  });

  const result = await command.output();

  if (!result.success) {
    const stderr = new TextDecoder().decode(result.stderr);
    throw new Error(`Failed to create project: ${stderr}`);
  }

  const projectPath = `${tempDir}/${projectName}`;
  console.log(`[e2e] Project created at ${projectPath}`);

  // Patch the project to use local Alexi instead of JSR
  await patchProjectForLocalAlexi(projectPath);

  return {
    name: projectName,
    path: projectPath,
  };
}

/**
 * Patch a generated project to use local Alexi packages instead of JSR.
 *
 * This allows E2E tests to run against the current codebase without
 * requiring the packages to be published to JSR first.
 *
 * @param projectPath - Path to the generated project
 */
async function patchProjectForLocalAlexi(projectPath: string): Promise<void> {
  console.log(`[e2e] Patching project to use local Alexi...`);

  const denoJsonPath = `${projectPath}/deno.jsonc`;

  // Read the generated deno.jsonc
  const content = await Deno.readTextFile(denoJsonPath);
  const config = JSON.parse(content);

  // Get the path to the alexi repo root as a file:// URL
  // We're at: alexi/src/create/tests/e2e_utils.ts
  // Alexi root is at: alexi/
  const alexiRootUrl = new URL("../../../", import.meta.url);
  // Use href to get the full file:// URL (works cross-platform)
  const alexiRoot = alexiRootUrl.href;

  // Replace JSR imports with local file:// URLs
  const localImports: Record<string, string> = {
    // Alexi framework modules
    "@alexi/core": `${alexiRoot}src/core/mod.ts`,
    "@alexi/db": `${alexiRoot}src/db/mod.ts`,
    "@alexi/db/backends/denokv": `${alexiRoot}src/db/backends/denokv/mod.ts`,
    "@alexi/db/backends/indexeddb":
      `${alexiRoot}src/db/backends/indexeddb/mod.ts`,
    "@alexi/db/backends/rest": `${alexiRoot}src/db/backends/rest/mod.ts`,
    "@alexi/db/migrations": `${alexiRoot}src/db/migrations/mod.ts`,
    "@alexi/db/migrations/schema":
      `${alexiRoot}src/db/migrations/schema/mod.ts`,
    "@alexi/urls": `${alexiRoot}src/urls/mod.ts`,
    "@alexi/http": `${alexiRoot}src/http/mod.ts`,
    "@alexi/middleware": `${alexiRoot}src/middleware/mod.ts`,
    "@alexi/views": `${alexiRoot}src/views/mod.ts`,
    "@alexi/web": `${alexiRoot}src/web/mod.ts`,
    "@alexi/webui": `${alexiRoot}src/webui/mod.ts`,
    "@alexi/webui/launcher": `${alexiRoot}src/webui/launcher.ts`,
    "@alexi/webui/bindings": `${alexiRoot}src/webui/bindings.ts`,
    "@alexi/staticfiles": `${alexiRoot}src/staticfiles/mod.ts`,
    "@alexi/restframework": `${alexiRoot}src/restframework/mod.ts`,
    "@alexi/restframework/authentication":
      `${alexiRoot}src/restframework/authentication/mod.ts`,
    "@alexi/auth": `${alexiRoot}src/auth/mod.ts`,
    "@alexi/admin": `${alexiRoot}src/admin/mod.ts`,
    "@alexi/capacitor": `${alexiRoot}src/capacitor/mod.ts`,
    "@alexi/types": `${alexiRoot}src/types/mod.ts`,
  };

  // Transitive dependencies required by local Alexi modules
  // These are defined in the Alexi repo's deno.json and must be available
  // for the local file:// imports to resolve their dependencies
  const transitiveDependencies: Record<string, string> = {
    "@std/assert": "jsr:@std/assert@1",
    "@std/path": "jsr:@std/path@1",
    "esbuild": "npm:esbuild@^0.24.0",
    "esbuild-deno-loader": "jsr:@luca/esbuild-deno-loader@^0.11.1",
    "fake-indexeddb": "npm:fake-indexeddb@^6.0.0",
  };

  // Update Alexi imports to use local paths
  for (const [key, localPath] of Object.entries(localImports)) {
    config.imports[key] = localPath;
  }

  // Add transitive dependencies that Alexi modules need
  for (const [key, value] of Object.entries(transitiveDependencies)) {
    if (!config.imports[key]) {
      config.imports[key] = value;
    }
  }

  // Write back the patched config
  await Deno.writeTextFile(
    denoJsonPath,
    JSON.stringify(config, null, 2) + "\n",
  );

  console.log(`[e2e] Project patched to use local Alexi from ${alexiRoot}`);
}

/**
 * Clean up a scaffolded project
 *
 * @param project - ScaffoldedProject to clean up
 */
export async function cleanupTestProject(
  project: ScaffoldedProject,
): Promise<void> {
  console.log(`[e2e] Cleaning up test project at ${project.path}`);
  try {
    await Deno.remove(project.path, { recursive: true });
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      console.warn(`[e2e] Failed to clean up project: ${error}`);
    }
  }
}

/**
 * Create a temporary directory for test projects
 */
export async function createTempDir(): Promise<string> {
  const tempDir = await Deno.makeTempDir({ prefix: "alexi_e2e_" });
  console.log(`[e2e] Created temp directory: ${tempDir}`);
  return tempDir;
}

/**
 * Clean up a temporary directory
 */
export async function cleanupTempDir(tempDir: string): Promise<void> {
  console.log(`[e2e] Cleaning up temp directory: ${tempDir}`);
  try {
    await Deno.remove(tempDir, { recursive: true });
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      console.warn(`[e2e] Failed to clean up temp directory: ${error}`);
    }
  }
}

// =============================================================================
// Server Management
// =============================================================================

/**
 * Start the web server (REST API) for a scaffolded project
 *
 * @param projectPath - Path to the scaffolded project
 * @param port - Port to run the server on
 */
export async function startApiServer(
  projectPath: string,
  port: number = DEFAULT_API_PORT,
): Promise<ServerProcess> {
  const denoPath = Deno.execPath();
  console.log(`[e2e] Starting API server at ${projectPath} on port ${port}`);

  // Build CORS origins that include the test UI port
  const corsOrigins = [
    `http://localhost:${port}`,
    `http://127.0.0.1:${port}`,
    `http://localhost:${DEFAULT_UI_PORT}`,
    `http://127.0.0.1:${DEFAULT_UI_PORT}`,
  ].join(",");

  const command = new Deno.Command(denoPath, {
    args: [
      "run",
      "-A",
      "--unstable-kv",
      "manage.ts",
      "runserver",
      "--settings",
      "web",
      "--port",
      String(port),
    ],
    cwd: projectPath,
    stdout: "piped",
    stderr: "piped",
    env: {
      ...Deno.env.toObject(),
      CORS_ORIGINS: corsOrigins,
    },
  });

  const process = command.spawn();
  const baseUrl = `http://localhost:${port}`;

  // Start reading stderr in background for diagnostics
  const stderrOutput: string[] = [];
  const stderrReader = (async () => {
    const decoder = new TextDecoder();
    try {
      for await (const chunk of process.stderr) {
        const text = decoder.decode(chunk);
        stderrOutput.push(text);
        console.error(`[API Server stderr] ${text}`);
      }
    } catch {
      // Process may have been killed
    }
  })();

  // Start reading stdout in background
  const stdoutReader = (async () => {
    const decoder = new TextDecoder();
    try {
      for await (const chunk of process.stdout) {
        const text = decoder.decode(chunk);
        console.log(`[API Server stdout] ${text}`);
      }
    } catch {
      // Process may have been killed
    }
  })();

  try {
    await waitForServer(baseUrl, SERVER_STARTUP_TIMEOUT);
  } catch (e) {
    console.error(`[e2e] Server failed to start. Collected stderr:`);
    console.error(stderrOutput.join(""));
    throw e;
  }

  return {
    process,
    port,
    baseUrl,
    _stderrReader: stderrReader,
    _stdoutReader: stdoutReader,
  };
}

/**
 * Start the UI server (frontend SPA) for a scaffolded project
 *
 * @param projectPath - Path to the scaffolded project
 * @param port - Port to run the server on
 */
export async function startUiServer(
  projectPath: string,
  port: number = DEFAULT_UI_PORT,
): Promise<ServerProcess> {
  const denoPath = Deno.execPath();
  console.log(`[e2e] Starting UI server at ${projectPath} on port ${port}`);

  const command = new Deno.Command(denoPath, {
    args: [
      "run",
      "-A",
      "--unstable-kv",
      "manage.ts",
      "runserver",
      "--settings",
      "ui",
      "--port",
      String(port),
    ],
    cwd: projectPath,
    stdout: "piped",
    stderr: "piped",
  });

  const process = command.spawn();
  const baseUrl = `http://localhost:${port}`;

  // Start reading stderr in background
  const stderrOutput: string[] = [];
  const stderrReader = (async () => {
    const decoder = new TextDecoder();
    try {
      for await (const chunk of process.stderr) {
        const text = decoder.decode(chunk);
        stderrOutput.push(text);
        console.error(`[UI Server stderr] ${text}`);
      }
    } catch {
      // Process may have been killed
    }
  })();

  // Start reading stdout in background
  const stdoutReader = (async () => {
    const decoder = new TextDecoder();
    try {
      for await (const chunk of process.stdout) {
        const text = decoder.decode(chunk);
        console.log(`[UI Server stdout] ${text}`);
      }
    } catch {
      // Process may have been killed
    }
  })();

  try {
    await waitForServer(baseUrl, SERVER_STARTUP_TIMEOUT);
  } catch (e) {
    console.error(`[e2e] UI Server failed to start. Collected stderr:`);
    console.error(stderrOutput.join(""));
    throw e;
  }

  return {
    process,
    port,
    baseUrl,
    _stderrReader: stderrReader,
    _stdoutReader: stdoutReader,
  };
}

/**
 * Stop a server process
 */
export async function stopServer(server: ServerProcess): Promise<void> {
  console.log(`[e2e] Stopping server on port ${server.port}`);
  try {
    server.process.kill("SIGTERM");
    // Wait for process to exit with timeout
    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => reject(new Error("Server stop timeout")), 5000);
    });

    const exitPromise = server.process.status.then(() => {});

    await Promise.race([exitPromise, timeoutPromise]).catch(() => {
      // If graceful shutdown failed, force kill
      try {
        server.process.kill("SIGKILL");
      } catch {
        // Process may already be dead
      }
    });
  } catch (error) {
    console.warn(`[e2e] Error stopping server: ${error}`);
  }
}

/**
 * Wait for a server to be ready
 */
export async function waitForServer(
  baseUrl: string,
  timeoutMs: number = SERVER_STARTUP_TIMEOUT,
): Promise<void> {
  console.log(`[e2e] Waiting for server at ${baseUrl}...`);
  const startTime = Date.now();

  // Try different endpoints that might be available
  const urls = [
    `${baseUrl}/`,
    `${baseUrl}/api/health/`,
  ];

  while (Date.now() - startTime < timeoutMs) {
    for (const url of urls) {
      try {
        const response = await fetch(url);
        // Any response means server is up
        await response.body?.cancel();
        console.log(`[e2e] Server is ready at ${baseUrl}`);
        return;
      } catch {
        // Server not ready yet
      }
    }
    await sleep(500);
  }

  throw new Error(`Server at ${baseUrl} did not start within ${timeoutMs}ms`);
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry an async function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    initialDelay?: number;
    maxDelay?: number;
  } = {},
): Promise<T> {
  const { maxAttempts = 3, initialDelay = 1000, maxDelay = 10000 } = options;

  let lastError: Error | undefined;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.log(
        `[e2e] Attempt ${attempt}/${maxAttempts} failed: ${lastError.message}`,
      );

      if (attempt < maxAttempts) {
        await sleep(delay);
        delay = Math.min(delay * 2, maxDelay);
      }
    }
  }

  throw lastError;
}
