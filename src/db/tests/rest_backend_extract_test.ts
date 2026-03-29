/**
 * Tests for RestBackend extractData method
 *
 * Tests that ForeignKey fields are correctly serialized using .id
 * instead of .get() which throws when the relation is not loaded.
 *
 * Also covers Issue #453: FK column names must be reverse-translated back to
 * field names when building URL query parameters for REST requests.
 *
 * @module
 */

import { assertEquals } from "jsr:@std/assert@1";
import {
  AutoField,
  BooleanField,
  CharField,
  IntegerField,
  Manager,
  Model,
} from "../mod.ts";
import { ForeignKey, OnDelete } from "../fields/relations.ts";
import { ModelEndpoint, RestBackend } from "../backends/rest/mod.ts";
import { createQueryState } from "../query/types.ts";

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

class ProjectRole extends Model {
  id = new AutoField({ primaryKey: true });
  name = new CharField({ maxLength: 100 });
  description = new CharField({ maxLength: 500, blank: true, default: "" });
  project = new ForeignKey<Project>(Project, {
    onDelete: OnDelete.CASCADE,
  });

  static objects = new Manager(ProjectRole);
  static override meta = {
    dbTable: "project_roles",
  };
}

// ============================================================================
// Test Helper: Intercept fetch calls (Fix #453)
// ============================================================================

type FetchCall = { url: string; options?: RequestInit };

class ProjectEndpoint extends ModelEndpoint {
  model = Project;
  path = "/projects/";
}

class TrackingRestBackend extends RestBackend {
  fetchCalls: FetchCall[] = [];

  constructor(apiUrl = "http://test.local/api") {
    super({ apiUrl, endpoints: [ProjectEndpoint] });
  }

  // deno-lint-ignore require-await
  protected override async request<T>(
    path: string,
    options?: RequestInit,
  ): Promise<T> {
    this.fetchCalls.push({ url: path, options });
    return [] as unknown as T;
  }
}

// ============================================================================
// Test Helper: Expose protected extractData method
// ============================================================================

class TestableRestBackend extends RestBackend {
  public testExtractData<T extends Model>(
    instance: T,
  ): Record<string, unknown> {
    return this.extractData(instance);
  }
}

// ============================================================================
// Tests
// ============================================================================

Deno.test({
  name: "RestBackend extractData - ForeignKey with ID only (not loaded)",
  fn() {
    const backend = new TestableRestBackend({
      apiUrl: "http://test.local/api",
    });

    // Create a ProjectRole with FK set to raw ID (not a loaded instance)
    const role = new ProjectRole();
    role.name.set("Developer");
    role.description.set("Develops software");
    role.project.set(42 as unknown as Project); // Set raw ID

    const data = backend.testExtractData(role);

    // Should include the FK ID, not throw an error
    assertEquals(data.name, "Developer");
    assertEquals(data.description, "Develops software");
    assertEquals(data.project, 42);
  },
});

Deno.test({
  name: "RestBackend extractData - ForeignKey with loaded instance",
  fn() {
    const backend = new TestableRestBackend({
      apiUrl: "http://test.local/api",
    });

    // Create an Organisation
    const org = new Organisation();
    org.id.set(1);
    org.name.set("Acme Inc");

    // Create a Project with loaded Organisation
    const project = new Project();
    project.name.set("Website");
    project.organisation.set(org);
    project.isPublished.set(true);

    const data = backend.testExtractData(project);

    // Should extract the FK ID from the loaded instance
    assertEquals(data.name, "Website");
    assertEquals(data.organisation, 1);
    assertEquals(data.isPublished, true);
  },
});

Deno.test({
  name: "RestBackend extractData - ForeignKey with null value",
  fn() {
    const backend = new TestableRestBackend({
      apiUrl: "http://test.local/api",
    });

    // Create a ProjectRole without setting the FK
    const role = new ProjectRole();
    role.name.set("Tester");

    const data = backend.testExtractData(role);

    // Should include name but not the null FK
    assertEquals(data.name, "Tester");
    assertEquals("project" in data, false, "Null FK should not be included");
  },
});

Deno.test({
  name: "RestBackend extractData - regular fields work correctly",
  fn() {
    const backend = new TestableRestBackend({
      apiUrl: "http://test.local/api",
    });

    const org = new Organisation();
    org.name.set("Test Corp");
    org.country.set("Finland");

    const data = backend.testExtractData(org);

    assertEquals(data.name, "Test Corp");
    assertEquals(data.country, "Finland");
  },
});

Deno.test({
  name: "RestBackend extractData - does not include null values",
  fn() {
    const backend = new TestableRestBackend({
      apiUrl: "http://test.local/api",
    });

    const org = new Organisation();
    org.name.set("Test Corp");
    // country is not set, should be null

    const data = backend.testExtractData(org);

    assertEquals(data.name, "Test Corp");
    // Null values should not be included
    assertEquals(
      "country" in data,
      false,
      "Null fields should not be included",
    );
  },
});

Deno.test({
  name: "RestBackend extractData - excludes meta and objects",
  fn() {
    const backend = new TestableRestBackend({
      apiUrl: "http://test.local/api",
    });

    const org = new Organisation();
    org.name.set("Test Corp");

    const data = backend.testExtractData(org);

    assertEquals("meta" in data, false, "meta should be excluded");
    assertEquals("objects" in data, false, "objects should be excluded");
  },
});

Deno.test({
  name: "RestBackend extractData - nested ForeignKey chain",
  fn() {
    const backend = new TestableRestBackend({
      apiUrl: "http://test.local/api",
    });

    // Simulate a role with project FK set to raw ID
    const role = new ProjectRole();
    role.name.set("Lead Developer");
    role.description.set("Leads the dev team");
    role.project.set(99 as unknown as Project);

    const data = backend.testExtractData(role);

    assertEquals(data.name, "Lead Developer");
    assertEquals(data.description, "Leads the dev team");
    assertEquals(data.project, 99);
  },
});

// ============================================================================
// RestBackend execute() — FK column name reverse-translation (Issue #453)
// ============================================================================

Deno.test({
  name:
    "RestBackend execute() — FK filter emitted as field name, not column name (Issue #453)",
  async fn() {
    // When a queryset has filter({ organisation: 1 }), the queryset pre-translates
    // it to { field: "organisation_id", value: 1 } in state.filters.
    // The REST backend must reverse-translate "organisation_id" back to
    // "organisation" when building the URL, so the server receives ?organisation=1
    // instead of ?organisation_id=1.
    const backend = new TrackingRestBackend();
    await backend.connect();

    const state = createQueryState(Project);
    // Simulate the translated filter that queryset produces for filter({ organisation: 1 })
    state.filters = [{
      field: "organisation_id",
      lookup: "exact",
      value: 1,
      negated: false,
    }];

    await backend.execute(state);

    assertEquals(backend.fetchCalls.length, 1);
    const requestedUrl = backend.fetchCalls[0].url;

    // Must use field name "organisation", not column name "organisation_id"
    assertEquals(
      requestedUrl.includes("organisation=1"),
      true,
      `Expected ?organisation=1 in URL but got: ${requestedUrl}`,
    );
    assertEquals(
      requestedUrl.includes("organisation_id=1"),
      false,
      `URL must not contain organisation_id=1: ${requestedUrl}`,
    );

    await backend.disconnect();
  },
});

Deno.test({
  name:
    "RestBackend execute() — non-FK filter field name unchanged (Issue #453)",
  async fn() {
    // Plain (non-FK) field names must pass through unchanged.
    const backend = new TrackingRestBackend();
    await backend.connect();

    const state = createQueryState(Project);
    state.filters = [{
      field: "name",
      lookup: "exact",
      value: "Test",
      negated: false,
    }];

    await backend.execute(state);

    assertEquals(backend.fetchCalls.length, 1);
    const requestedUrl = backend.fetchCalls[0].url;
    assertEquals(
      requestedUrl.includes("name=Test"),
      true,
      `Expected ?name=Test in URL but got: ${requestedUrl}`,
    );

    await backend.disconnect();
  },
});
