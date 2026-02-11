/**
 * Tests for named database backends feature
 *
 * Tests the Django-style DATABASES configuration and .using('name') syntax.
 *
 * @module
 */

import { assertEquals, assertExists, assertRejects } from "jsr:@std/assert@1";
import {
  getBackend,
  getBackendByName,
  getBackendNames,
  hasBackend,
  registerBackend,
  reset,
  setup,
} from "../setup.ts";
import { DenoKVBackend } from "../backends/denokv/mod.ts";
import { AutoField, CharField, IntegerField } from "../fields/mod.ts";
import { Manager, Model } from "../models/mod.ts";

// ============================================================================
// Test Model
// ============================================================================

class Article extends Model {
  id = new AutoField({ primaryKey: true });
  title = new CharField({ maxLength: 200 });
  views = new IntegerField({ default: 0 });

  static objects = new Manager(Article);
  static override meta = {
    dbTable: "articles",
  };
}

// ============================================================================
// Tests
// ============================================================================

Deno.test({
  name: "Named Backends: setup with databases config",
  async fn() {
    await reset();

    const backend1 = new DenoKVBackend({ name: "test1", path: ":memory:" });
    const backend2 = new DenoKVBackend({ name: "test2", path: ":memory:" });

    await setup({
      databases: {
        default: backend1,
        secondary: backend2,
      },
    });

    try {
      // Check backends are registered
      assertEquals(hasBackend("default"), true);
      assertEquals(hasBackend("secondary"), true);
      assertEquals(hasBackend("nonexistent"), false);

      // Check getBackendByName
      assertExists(getBackendByName("default"));
      assertExists(getBackendByName("secondary"));
      assertEquals(getBackendByName("nonexistent"), undefined);

      // Check getBackendNames
      const names = getBackendNames();
      assertEquals(names.includes("default"), true);
      assertEquals(names.includes("secondary"), true);

      // Check default backend is set
      const defaultBackend = getBackend();
      assertEquals(defaultBackend, backend1);
    } finally {
      await reset();
    }
  },
});

Deno.test({
  name: "Named Backends: default backend fallback to first",
  async fn() {
    await reset();

    const backend1 = new DenoKVBackend({ name: "test1", path: ":memory:" });
    const backend2 = new DenoKVBackend({ name: "test2", path: ":memory:" });

    // No 'default' key - should use first backend
    await setup({
      databases: {
        primary: backend1,
        secondary: backend2,
      },
    });

    try {
      const defaultBackend = getBackend();
      // Should be the first one (primary)
      assertExists(defaultBackend);
    } finally {
      await reset();
    }
  },
});

Deno.test({
  name: "Named Backends: registerBackend function",
  async fn() {
    await reset();

    const backend1 = new DenoKVBackend({ name: "test1", path: ":memory:" });
    await backend1.connect();

    await setup({
      backend: backend1,
    });

    try {
      // Register additional backend
      const backend2 = new DenoKVBackend({ name: "test2", path: ":memory:" });
      await backend2.connect();
      registerBackend("extra", backend2);

      assertEquals(hasBackend("extra"), true);
      assertEquals(getBackendByName("extra"), backend2);
    } finally {
      await reset();
    }
  },
});

Deno.test({
  name: "Named Backends: Manager.using() with string",
  async fn() {
    await reset();

    const backend1 = new DenoKVBackend({ name: "test1", path: ":memory:" });
    const backend2 = new DenoKVBackend({ name: "test2", path: ":memory:" });

    await setup({
      databases: {
        default: backend1,
        secondary: backend2,
      },
    });

    try {
      // Create article using named backend
      const article = await Article.objects.using("default").create({
        title: "Test Article",
        views: 100,
      });

      assertExists(article.id.get());
      assertEquals(article.title.get(), "Test Article");

      // Query using named backend
      const found = await Article.objects
        .using("default")
        .filter({ id: article.id.get() })
        .first();

      assertExists(found);
      assertEquals(found.title.get(), "Test Article");
    } finally {
      await reset();
    }
  },
});

Deno.test({
  name: "Named Backends: QuerySet.using() with string",
  async fn() {
    await reset();

    const backend = new DenoKVBackend({ name: "test", path: ":memory:" });

    await setup({
      databases: {
        default: backend,
        main: backend, // Same backend, different name for testing
      },
    });

    try {
      // Create article
      await Article.objects.using("default").create({
        title: "Article 1",
        views: 50,
      });

      await Article.objects.using("default").create({
        title: "Article 2",
        views: 150,
      });

      // Query using named backend via QuerySet.using()
      const articles = (await Article.objects
        .all()
        .using("main")
        .filter({ views__gte: 100 })
        .fetch()).array();

      assertEquals(articles.length, 1);
      assertEquals(articles[0].title.get(), "Article 2");
    } finally {
      await reset();
    }
  },
});

Deno.test({
  name: "Named Backends: using() with unknown name throws error",
  async fn() {
    await reset();

    const backend = new DenoKVBackend({ name: "test", path: ":memory:" });

    await setup({
      databases: {
        default: backend,
      },
    });

    try {
      // Manager.using() with unknown name
      await assertRejects(
        async () => {
          await Article.objects.using("nonexistent").all().fetch();
        },
        Error,
        "Unknown database backend: 'nonexistent'",
      );

      // QuerySet.using() with unknown name
      await assertRejects(
        async () => {
          await Article.objects.all().using("nonexistent").fetch();
        },
        Error,
        "Unknown database backend: 'nonexistent'",
      );
    } finally {
      await reset();
    }
  },
});

Deno.test({
  name: "Named Backends: using() still works with backend instance",
  async fn() {
    await reset();

    const backend = new DenoKVBackend({ name: "test", path: ":memory:" });

    await setup({
      databases: {
        default: backend,
      },
    });

    try {
      // Pass backend instance directly (existing behavior)
      const article = await Article.objects.using(backend).create({
        title: "Direct Backend",
        views: 200,
      });

      assertExists(article.id.get());
      assertEquals(article.title.get(), "Direct Backend");

      // QuerySet with direct backend
      const found = await Article.objects
        .all()
        .using(backend)
        .filter({ title: "Direct Backend" })
        .first();

      assertExists(found);
    } finally {
      await reset();
    }
  },
});

Deno.test({
  name: "Named Backends: isolation between backends",
  async fn() {
    await reset();

    const backend1 = new DenoKVBackend({ name: "db1", path: ":memory:" });
    const backend2 = new DenoKVBackend({ name: "db2", path: ":memory:" });

    await setup({
      databases: {
        db1: backend1,
        db2: backend2,
      },
    });

    try {
      // Create article in db1
      await Article.objects.using("db1").create({
        title: "DB1 Article",
        views: 100,
      });

      // Create article in db2
      await Article.objects.using("db2").create({
        title: "DB2 Article",
        views: 200,
      });

      // Query db1 - should only find db1 article
      const db1Articles = (await Article.objects.using("db1").all().fetch())
        .array();
      assertEquals(db1Articles.length, 1);
      assertEquals(db1Articles[0].title.get(), "DB1 Article");

      const db2Articles = (await Article.objects.using("db2").all().fetch())
        .array();
      assertEquals(db2Articles.length, 1);
      assertEquals(db2Articles[0].title.get(), "DB2 Article");
    } finally {
      await reset();
    }
  },
});

Deno.test({
  name: "Named Backends: shutdown disconnects all backends",
  async fn() {
    await reset();

    const backend1 = new DenoKVBackend({ name: "test1", path: ":memory:" });
    const backend2 = new DenoKVBackend({ name: "test2", path: ":memory:" });

    await setup({
      databases: {
        default: backend1,
        secondary: backend2,
      },
    });

    // Verify connected
    assertEquals(backend1.isConnected, true);
    assertEquals(backend2.isConnected, true);

    // Shutdown should disconnect all
    await reset();

    assertEquals(backend1.isConnected, false);
    assertEquals(backend2.isConnected, false);

    // Registry should be cleared
    assertEquals(hasBackend("default"), false);
    assertEquals(hasBackend("secondary"), false);
  },
});
