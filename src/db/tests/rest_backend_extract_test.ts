/**
 * Tests for RestBackend extractData method
 *
 * Tests that ForeignKey fields are correctly serialized using .id
 * instead of .get() which throws when the relation is not loaded.
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
import { RestBackend } from "../backends/rest/mod.ts";

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
