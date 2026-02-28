/**
 * In-process HTTP server for Admin E2E tests
 *
 * Starts a real Deno.serve() server backed by a DenoKV database with
 * PostModel registered in AdminSite. Used by admin_e2e_test.ts.
 *
 * @module
 */

import { reset } from "@alexi/db";
import { DenoKVBackend } from "@alexi/db/backends/denokv";
import { setup } from "@alexi/core";
import { AutoField, CharField, IntegerField, Manager, Model } from "@alexi/db";
import { AdminRouter, AdminSite } from "@alexi/admin";
import { ModelAdmin } from "@alexi/admin";

// =============================================================================
// Test model
// =============================================================================

export class PostModel extends Model {
  id = new AutoField({ primaryKey: true });
  title = new CharField({ maxLength: 200 });
  body = new CharField({ maxLength: 1000, blank: true, default: "" });
  priority = new IntegerField({ default: 0 });

  static objects = new Manager(PostModel);
  static override meta = {
    dbTable: "e2e_posts",
    verboseName: "Post",
    verboseNamePlural: "Posts",
  };
}

// =============================================================================
// Server state
// =============================================================================

export interface AdminE2EServer {
  port: number;
  backend: DenoKVBackend;
  adminSite: AdminSite;
  stop(): Promise<void>;
}

// =============================================================================
// Start server
// =============================================================================

/**
 * Start an in-process admin server for E2E tests.
 *
 * @param port - TCP port to listen on (default 9300)
 */
export async function startAdminE2EServer(
  port = 9300,
): Promise<AdminE2EServer> {
  // Setup database
  const backend = new DenoKVBackend({ name: "admin_e2e", path: ":memory:" });
  await backend.connect();
  await setup({ DATABASES: { default: backend } });

  // Setup admin site
  const adminSite = new AdminSite({
    title: "E2E Admin",
    header: "E2E Administration",
    urlPrefix: "/admin",
  });
  adminSite.register(PostModel, ModelAdmin);

  // Build router
  const router = new AdminRouter(adminSite, backend);

  // Start server
  const controller = new AbortController();
  const server = Deno.serve(
    { port, signal: controller.signal, onListen: () => {} },
    (req) => router.handle(req),
  );

  return {
    port,
    backend,
    adminSite,
    async stop() {
      controller.abort();
      await server.finished;
      await reset();
      await backend.disconnect();
    },
  };
}

// =============================================================================
// JWT helper (unsigned dev token — works when SECRET_KEY is not set)
// =============================================================================

export function makeAdminToken(): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    userId: 1,
    email: "admin@example.com",
    isAdmin: true,
    iat: now,
    exp: now + 3600,
  };
  const encode = (obj: Record<string, unknown>) => {
    const json = JSON.stringify(obj);
    return btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(
      /=+$/,
      "",
    );
  };
  const header = encode({ alg: "none", typ: "JWT" });
  const body = encode(payload);
  return `${header}.${body}.`;
}
