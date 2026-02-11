/**
 * Tests for ForeignKey improvements and QuerySet chainable fetch
 *
 * Tests for:
 * - Issue #24: ForeignKey improvements - related object access
 * - Issue #25: QuerySet.fetch() returns QuerySet for chainable in-memory filtering
 *
 * @module
 */

import { assertEquals, assertExists, assertRejects } from "jsr:@std/assert@1";
import {
  AutoField,
  BooleanField,
  CharField,
  IntegerField,
  Manager,
  Model,
} from "../mod.ts";
import { ForeignKey, OnDelete } from "../fields/relations.ts";
import { reset, setup } from "../setup.ts";
import { DenoKVBackend } from "../backends/denokv/mod.ts";

// ============================================================================
// Test Models
// ============================================================================

class Organisation extends Model {
  id = new AutoField({ primaryKey: true });
  name = new CharField({ maxLength: 100 });
  country = new CharField({ maxLength: 100, blank: true, default: "" });

  static objects = new Manager(Organisation);
  static override meta = {
    dbTable: "organisations",
  };
}

class Project extends Model {
  id = new AutoField({ primaryKey: true });
  name = new CharField({ maxLength: 100 });
  organisation = new ForeignKey<Organisation>(Organisation, {
    onDelete: OnDelete.CASCADE,
  });
  isPublished = new BooleanField({ default: false });
  views = new IntegerField({ default: 0 });

  static objects = new Manager(Project);
  static override meta = {
    dbTable: "projects",
  };
}

class Employee extends Model {
  id = new AutoField({ primaryKey: true });
  firstName = new CharField({ maxLength: 100 });
  lastName = new CharField({ maxLength: 100 });
  organisation = new ForeignKey<Organisation>(Organisation, {
    onDelete: OnDelete.CASCADE,
  });

  static objects = new Manager(Employee);
  static override meta = {
    dbTable: "employees",
  };
}

// ============================================================================
// ForeignKey Tests (Issue #24)
// ============================================================================

Deno.test({
  name: "ForeignKey - .id returns foreign key ID without loading",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const backend = new DenoKVBackend({ name: "fk-test-1", path: ":memory:" });
    await backend.connect();
    await setup({ backend });

    try {
      // Create organisation
      const org = await Organisation.objects.create({
        name: "Acme Inc",
        country: "Finland",
      });

      // Create project with organisation
      const project = await Project.objects.create({
        name: "Website Redesign",
        organisation: org,
        isPublished: true,
      });

      // Reload project from database
      const loadedProject = await Project.objects.get({ id: project.id.get() });

      // .id should return the FK ID without fetching the related object
      assertEquals(loadedProject.organisation.id, org.id.get());

      // Related object should NOT be loaded yet
      assertEquals(loadedProject.organisation.isLoaded(), false);
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
});

Deno.test({
  name: "ForeignKey - .get() throws if not loaded",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const backend = new DenoKVBackend({ name: "fk-test-2", path: ":memory:" });
    await backend.connect();
    await setup({ backend });

    try {
      const org = await Organisation.objects.create({
        name: "Test Org",
        country: "Sweden",
      });

      const project = await Project.objects.create({
        name: "Test Project",
        organisation: org,
      });

      const loadedProject = await Project.objects.get({ id: project.id.get() });

      // .get() should throw because related object is not loaded
      try {
        loadedProject.organisation.get();
        throw new Error("Expected error was not thrown");
      } catch (error) {
        assertEquals(
          (error as Error).message.includes("not fetched"),
          true,
          "Error message should mention object not fetched",
        );
      }
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
});

Deno.test({
  name: "ForeignKey - .fetch() lazy loads related object",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const backend = new DenoKVBackend({ name: "fk-test-3", path: ":memory:" });
    await backend.connect();
    await setup({ backend });

    try {
      const org = await Organisation.objects.create({
        name: "Lazy Load Corp",
        country: "Norway",
      });

      const project = await Project.objects.create({
        name: "Lazy Project",
        organisation: org,
      });

      const loadedProject = await Project.objects.get({ id: project.id.get() });

      // Before fetch
      assertEquals(loadedProject.organisation.isLoaded(), false);

      // Fetch the related object
      const fetchedOrg = await loadedProject.organisation.fetch();

      // After fetch
      assertEquals(loadedProject.organisation.isLoaded(), true);
      assertExists(fetchedOrg);
      assertEquals(fetchedOrg!.name.get(), "Lazy Load Corp");
      assertEquals(fetchedOrg!.country.get(), "Norway");

      // Now .get() should work
      const gotOrg = loadedProject.organisation.get();
      assertEquals(gotOrg.name.get(), "Lazy Load Corp");
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
});

Deno.test({
  name: "ForeignKey - .fetch() returns null for null FK",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const backend = new DenoKVBackend({ name: "fk-test-4", path: ":memory:" });
    await backend.connect();
    await setup({ backend });

    try {
      // Create project without organisation (null FK)
      const project = new Project();
      project.getFields();
      project.name.set("Orphan Project");
      // organisation is null by default

      const result = await project.organisation.fetch();
      assertEquals(result, null);
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
});

Deno.test({
  name: "ForeignKey - .set() with model instance",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const backend = new DenoKVBackend({ name: "fk-test-5", path: ":memory:" });
    await backend.connect();
    await setup({ backend });

    try {
      const org = await Organisation.objects.create({
        name: "Set Test Org",
        country: "Denmark",
      });

      const project = new Project();
      project.getFields();
      project.name.set("Set Test Project");

      // Set with model instance
      project.organisation.set(org);

      // ID should be available
      assertEquals(project.organisation.id, org.id.get());

      // Instance should be loaded
      assertEquals(project.organisation.isLoaded(), true);

      // .get() should return the instance
      assertEquals(project.organisation.get().name.get(), "Set Test Org");

      // Save and verify
      const savedData = await backend.insert(project);
      project.fromDB(savedData);

      const loaded = await Project.objects.get({ id: project.id.get() });
      assertEquals(loaded.organisation.id, org.id.get());
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
});

Deno.test({
  name: "ForeignKey - .set() with null clears the relation",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const backend = new DenoKVBackend({ name: "fk-test-6", path: ":memory:" });
    await backend.connect();
    await setup({ backend });

    try {
      const org = await Organisation.objects.create({
        name: "Clear Test Org",
        country: "Iceland",
      });

      const project = new Project();
      project.getFields();
      project.name.set("Clear Test Project");
      project.organisation.set(org);

      // Verify set
      assertEquals(project.organisation.id, org.id.get());
      assertEquals(project.organisation.isLoaded(), true);

      // Clear with null
      project.organisation.set(null);

      // Should be cleared
      assertEquals(project.organisation.id, null);
      assertEquals(project.organisation.isLoaded(), false);
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
});

// ============================================================================
// QuerySet selectRelated Tests (Issue #24)
// ============================================================================

Deno.test({
  name: "QuerySet - selectRelated() preloads ForeignKey relations",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const backend = new DenoKVBackend({ name: "sr-test-1", path: ":memory:" });
    await backend.connect();
    await setup({ backend });

    try {
      // Create organisations
      const org1 = await Organisation.objects.create({
        name: "Org One",
        country: "Finland",
      });
      const org2 = await Organisation.objects.create({
        name: "Org Two",
        country: "Sweden",
      });

      // Create projects
      await Project.objects.create({
        name: "Project A",
        organisation: org1,
        isPublished: true,
      });
      await Project.objects.create({
        name: "Project B",
        organisation: org2,
        isPublished: true,
      });
      await Project.objects.create({
        name: "Project C",
        organisation: org1,
        isPublished: false,
      });

      // Fetch with selectRelated
      const projects = await Project.objects
        .selectRelated("organisation")
        .fetch();

      const projectArray = projects.array();
      assertEquals(projectArray.length, 3);

      // All projects should have organisation pre-loaded
      for (const project of projectArray) {
        assertEquals(
          project.organisation.isLoaded(),
          true,
          `Project ${project.name.get()} should have organisation loaded`,
        );

        // .get() should work without additional fetch
        const org = project.organisation.get();
        assertExists(org);
        assertExists(org.name.get());
      }
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
});

Deno.test({
  name: "QuerySet - selectRelated() with filter",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const backend = new DenoKVBackend({ name: "sr-test-2", path: ":memory:" });
    await backend.connect();
    await setup({ backend });

    try {
      const org = await Organisation.objects.create({
        name: "Filter Test Org",
        country: "Norway",
      });

      await Project.objects.create({
        name: "Published Project",
        organisation: org,
        isPublished: true,
      });
      await Project.objects.create({
        name: "Draft Project",
        organisation: org,
        isPublished: false,
      });

      // Fetch published projects with selectRelated
      const projects = await Project.objects
        .filter({ isPublished: true })
        .selectRelated("organisation")
        .fetch();

      const projectArray = projects.array();
      assertEquals(projectArray.length, 1);
      assertEquals(projectArray[0].name.get(), "Published Project");
      assertEquals(projectArray[0].organisation.isLoaded(), true);
      assertEquals(
        projectArray[0].organisation.get().name.get(),
        "Filter Test Org",
      );
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
});

// ============================================================================
// QuerySet Chainable Fetch Tests (Issue #25)
// ============================================================================

Deno.test({
  name: "QuerySet - fetch() returns QuerySet",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const backend = new DenoKVBackend({ name: "qs-test-1", path: ":memory:" });
    await backend.connect();
    await setup({ backend });

    try {
      await Organisation.objects.create({
        name: "Test Org",
        country: "Finland",
      });

      const result = await Organisation.objects.all().fetch();

      // Result should be a QuerySet, not an array
      assertEquals(typeof result.array, "function");
      assertEquals(typeof result.filter, "function");
      assertEquals(typeof result.isFetched, "function");

      // isFetched() should return true
      assertEquals(result.isFetched(), true);
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
});

Deno.test({
  name: "QuerySet - .array() returns model array",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const backend = new DenoKVBackend({ name: "qs-test-2", path: ":memory:" });
    await backend.connect();
    await setup({ backend });

    try {
      await Organisation.objects.create({ name: "Org A", country: "Finland" });
      await Organisation.objects.create({ name: "Org B", country: "Sweden" });

      const qs = await Organisation.objects.all().fetch();
      const arr = qs.array();

      assertEquals(Array.isArray(arr), true);
      assertEquals(arr.length, 2);
      assertExists(arr[0].name);
      assertExists(arr[1].name);
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
});

Deno.test({
  name: "QuerySet - .array() throws if not fetched",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const backend = new DenoKVBackend({ name: "qs-test-3", path: ":memory:" });
    await backend.connect();
    await setup({ backend });

    try {
      await Organisation.objects.create({ name: "Test", country: "Finland" });

      const qs = Organisation.objects.all(); // Not fetched

      try {
        qs.array();
        throw new Error("Expected error was not thrown");
      } catch (error) {
        assertEquals(
          (error as Error).message.includes("not fetched"),
          true,
          "Error should mention QuerySet not fetched",
        );
      }
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
});

Deno.test({
  name: "QuerySet - in-memory filtering after fetch()",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const backend = new DenoKVBackend({ name: "qs-test-4", path: ":memory:" });
    await backend.connect();
    await setup({ backend });

    try {
      await Project.objects.create({
        name: "Published 1",
        organisation: null as unknown as Organisation,
        isPublished: true,
        views: 100,
      });
      await Project.objects.create({
        name: "Published 2",
        organisation: null as unknown as Organisation,
        isPublished: true,
        views: 200,
      });
      await Project.objects.create({
        name: "Draft",
        organisation: null as unknown as Organisation,
        isPublished: false,
        views: 50,
      });

      // Fetch all projects
      const allProjects = await Project.objects.all().fetch();
      assertEquals(allProjects.array().length, 3);

      // In-memory filter for published
      const published = allProjects.filter({ isPublished: true });
      assertEquals(published.isFetched(), true);
      assertEquals(published.array().length, 2);

      // Further in-memory filter for high views
      const popular = published.filter({ views__gte: 150 });
      assertEquals(popular.array().length, 1);
      assertEquals(popular.array()[0].name.get(), "Published 2");
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
});

Deno.test({
  name: "QuerySet - in-memory filtering with various lookups",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const backend = new DenoKVBackend({ name: "qs-test-5", path: ":memory:" });
    await backend.connect();
    await setup({ backend });

    try {
      await Organisation.objects.create({
        name: "Acme Corp",
        country: "Finland",
      });
      await Organisation.objects.create({
        name: "Beta Industries",
        country: "Sweden",
      });
      await Organisation.objects.create({
        name: "Gamma Solutions",
        country: "Norway",
      });
      await Organisation.objects.create({
        name: "Delta Corp",
        country: "Finland",
      });

      const all = await Organisation.objects.all().fetch();

      // Test contains
      const corpOrgs = all.filter({ name__contains: "Corp" });
      assertEquals(corpOrgs.array().length, 2);

      // Test icontains (case-insensitive)
      const acmeOrgs = all.filter({ name__icontains: "ACME" });
      assertEquals(acmeOrgs.array().length, 1);

      // Test startswith
      const betaOrgs = all.filter({ name__startswith: "Beta" });
      assertEquals(betaOrgs.array().length, 1);

      // Test exact
      const finlandOrgs = all.filter({ country: "Finland" });
      assertEquals(finlandOrgs.array().length, 2);

      // Test in
      const nordicOrgs = all.filter({ country__in: ["Finland", "Sweden"] });
      assertEquals(nordicOrgs.array().length, 3);
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
});

Deno.test({
  name: "QuerySet - chained in-memory filtering",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const backend = new DenoKVBackend({ name: "qs-test-6", path: ":memory:" });
    await backend.connect();
    await setup({ backend });

    try {
      await Project.objects.create({
        name: "Alpha",
        organisation: null as unknown as Organisation,
        isPublished: true,
        views: 100,
      });
      await Project.objects.create({
        name: "Beta",
        organisation: null as unknown as Organisation,
        isPublished: true,
        views: 250,
      });
      await Project.objects.create({
        name: "Gamma",
        organisation: null as unknown as Organisation,
        isPublished: false,
        views: 300,
      });
      await Project.objects.create({
        name: "Delta",
        organisation: null as unknown as Organisation,
        isPublished: true,
        views: 50,
      });

      // Fetch all, then chain multiple filters
      const result = (await Project.objects.all().fetch())
        .filter({ isPublished: true }) // 3 results
        .filter({ views__gte: 100 }) // 2 results
        .filter({ name__startswith: "B" }); // 1 result

      assertEquals(result.array().length, 1);
      assertEquals(result.array()[0].name.get(), "Beta");
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
});

Deno.test({
  name: "QuerySet - first() works with fetched data",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const backend = new DenoKVBackend({ name: "qs-test-7", path: ":memory:" });
    await backend.connect();
    await setup({ backend });

    try {
      await Organisation.objects.create({
        name: "First Org",
        country: "Finland",
      });
      await Organisation.objects.create({
        name: "Second Org",
        country: "Sweden",
      });

      // Without fetch - hits database
      const first1 = await Organisation.objects.orderBy("name").first();
      assertEquals(first1?.name.get(), "First Org");

      // With fetch - uses in-memory data
      const fetched = await Organisation.objects.orderBy("name").fetch();
      const first2 = await fetched.first();
      assertEquals(first2?.name.get(), "First Org");
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
});

Deno.test({
  name: "QuerySet - length() returns count of fetched data",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const backend = new DenoKVBackend({ name: "qs-test-8", path: ":memory:" });
    await backend.connect();
    await setup({ backend });

    try {
      await Organisation.objects.create({ name: "Org 1", country: "Finland" });
      await Organisation.objects.create({ name: "Org 2", country: "Sweden" });
      await Organisation.objects.create({ name: "Org 3", country: "Norway" });

      // Without fetch - hits database
      const count1 = await Organisation.objects.all().count();
      assertEquals(count1, 3);

      // With fetch - uses in-memory data
      const fetched = await Organisation.objects.all().fetch();
      const count2 = await fetched.length();
      assertEquals(count2, 3);

      // After in-memory filter
      const filtered = fetched.filter({ country: "Finland" });
      const count3 = await filtered.length();
      assertEquals(count3, 1);
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
});

Deno.test({
  name: "QuerySet - exists() works with fetched data",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const backend = new DenoKVBackend({ name: "qs-test-9", path: ":memory:" });
    await backend.connect();
    await setup({ backend });

    try {
      await Organisation.objects.create({
        name: "Test Org",
        country: "Finland",
      });

      // With fetch and filter
      const fetched = await Organisation.objects.all().fetch();

      const exists1 = await fetched.filter({ country: "Finland" }).exists();
      assertEquals(exists1, true);

      const exists2 = await fetched.filter({ country: "Japan" }).exists();
      assertEquals(exists2, false);
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
});

Deno.test({
  name: "QuerySet - clearCache() resets fetched state",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const backend = new DenoKVBackend({ name: "qs-test-10", path: ":memory:" });
    await backend.connect();
    await setup({ backend });

    try {
      await Organisation.objects.create({ name: "Test", country: "Finland" });

      const qs = await Organisation.objects.all().fetch();
      assertEquals(qs.isFetched(), true);

      qs.clearCache();
      assertEquals(qs.isFetched(), false);

      // array() should throw now
      try {
        qs.array();
        throw new Error("Expected error was not thrown");
      } catch (error) {
        assertEquals(
          (error as Error).message.includes("not fetched"),
          true,
        );
      }
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
});

Deno.test({
  name: "QuerySet - async iteration works",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const backend = new DenoKVBackend({ name: "qs-test-11", path: ":memory:" });
    await backend.connect();
    await setup({ backend });

    try {
      await Organisation.objects.create({ name: "Org A", country: "Finland" });
      await Organisation.objects.create({ name: "Org B", country: "Sweden" });

      const names: string[] = [];
      for await (const org of Organisation.objects.orderBy("name")) {
        names.push(org.name.get()!);
      }

      assertEquals(names, ["Org A", "Org B"]);
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
});
