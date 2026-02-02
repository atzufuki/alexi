/**
 * Alexi Admin SPA - Main Entry Point
 *
 * This is the main entry point for the Alexi Admin single-page application.
 * It initializes the database backend and mounts the admin app.
 *
 * @module
 */

import { setupBackend } from "../../comachine/src/backends/mod.ts";
import AdminApp from "./app.ts";

// =============================================================================
// Configuration
// =============================================================================

declare global {
  interface GlobalThis {
    __ADMIN_CONFIG__?: {
      apiUrl?: string;
      debug?: boolean;
    };
  }
}

// =============================================================================
// Initialize and Mount
// =============================================================================

async function main() {
  // Get configuration from globalThis or use defaults
  const config = globalThis.__ADMIN_CONFIG__ ?? {};
  const apiUrl = config.apiUrl ?? `${globalThis.location.origin}/api`;
  const debug = config.debug ?? true;

  if (debug) {
    console.log("[AdminApp] Initializing...");
    console.log("[AdminApp] API URL:", apiUrl);
  }

  // Initialize database backend (same as comachine frontend)
  await setupBackend({
    backendConfig: {
      backend: "sync",
      apiUrl,
      databaseName: "alexi_admin",
      debug,
      failSilently: true,
    },
    debug,
  });

  if (debug) {
    console.log("[AdminApp] Backend initialized");
  }

  // Mount admin app
  const root = document.getElementById("admin-root");
  if (!root) {
    throw new Error("Admin root element (#admin-root) not found");
  }

  root.appendChild(new AdminApp());

  if (debug) {
    console.log("[AdminApp] Mounted");
  }
}

// Run
main().catch((error) => {
  console.error("[AdminApp] Failed to initialize:", error);
});
