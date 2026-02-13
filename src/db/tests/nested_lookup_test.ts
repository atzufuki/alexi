/**
 * Tests for nested lookup support in filter() for DenoKV and IndexedDB backends
 *
 * Tests for:
 * - Issue #50: Add nested lookup support for filter() in DenoKV backend
 * - Issue #51: Add nested lookup support for filter() in IndexedDB backend
 *
 * Nested lookups allow filtering by ForeignKey chains:
 * - `filter({ projectRole__project: 123 })` - filter by FK field's related object
 * - `filter({ projectRole__project__organisation: 456 })` - multi-level FK chain
 *
 * @module
 */

import { assertEquals } from "jsr:@std/assert@1";
import { AutoField, CharField, IntegerField, Manager, Model } from "../mod.ts";
import { ForeignKey, OnDelete } from "../fields/relations.ts";
import { reset, setup } from "../setup.ts";
import { DenoKVBackend } from "../backends/denokv/mod.ts";

// ============================================================================
// Test Models
// ============================================================================

class Organisation extends Model {
  id = new AutoField({ primaryKey: true });
  name = new CharField({ maxLength: 100 });

  static objects = new Manager(Organisation);
  static override meta = {
    dbTable: "test_organisations",
  };
}

class Project extends Model {
  id = new AutoField({ primaryKey: true });
  name = new CharField({ maxLength: 100 });
  organisation = new ForeignKey<Organisation>(Organisation, {
    onDelete: OnDelete.CASCADE,
  });

  static objects = new Manager(Project);
  static override meta = {
    dbTable: "test_projects",
  };
}

class ProjectRole extends Model {
  id = new AutoField({ primaryKey: true });
  name = new CharField({ maxLength: 100 });
  project = new ForeignKey<Project>(Project, {
    onDelete: OnDelete.CASCADE,
  });

  static objects = new Manager(ProjectRole);
  static override meta = {
    dbTable: "test_project_roles",
  };
}

class ProjectRoleCompetence extends Model {
  id = new AutoField({ primaryKey: true });
  level = new IntegerField({ default: 1 });
  projectRole = new ForeignKey<ProjectRole>(ProjectRole, {
    onDelete: OnDelete.CASCADE,
  });

  static objects = new Manager(ProjectRoleCompetence);
  static override meta = {
    dbTable: "test_project_role_competences",
  };
}

class ProjectPosition extends Model {
  id = new AutoField({ primaryKey: true });
  title = new CharField({ maxLength: 100 });
  projectRole = new ForeignKey<ProjectRole>(ProjectRole, {
    onDelete: OnDelete.CASCADE,
  });

  static objects = new Manager(ProjectPosition);
  static override meta = {
    dbTable: "test_project_positions",
  };
}

// ============================================================================
// DenoKV Backend Tests
// ============================================================================

Deno.test({
  name:
    "DenoKV - nested lookup: filter by single FK level (projectRole__project)",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const backend = new DenoKVBackend({
      name: "nested-lookup-1",
      path: ":memory:",
    });
    await backend.connect();
    await setup({ backend });

    try {
      // Create test data
      const org = await Organisation.objects.create({ name: "Acme Inc" });
      const project1 = await Project.objects.create({
        name: "Project Alpha",
        organisation: org,
      });
      const project2 = await Project.objects.create({
        name: "Project Beta",
        organisation: org,
      });

      const role1 = await ProjectRole.objects.create({
        name: "Developer",
        project: project1,
      });
      const role2 = await ProjectRole.objects.create({
        name: "Designer",
        project: project1,
      });
      const role3 = await ProjectRole.objects.create({
        name: "Manager",
        project: project2,
      });

      // Create competences for each role
      await ProjectRoleCompetence.objects.create({
        level: 3,
        projectRole: role1,
      });
      await ProjectRoleCompetence.objects.create({
        level: 4,
        projectRole: role2,
      });
      await ProjectRoleCompetence.objects.create({
        level: 5,
        projectRole: role3,
      });

      // Filter competences by project (nested lookup)
      const competences = await ProjectRoleCompetence.objects
        .filter({ projectRole__project: project1.id.get() })
        .fetch();

      const compArray = competences.array();

      // Should only return competences for roles in project1 (2 competences)
      assertEquals(compArray.length, 2);

      // Verify the levels match what we expect (roles 1 and 2)
      const levels = compArray.map((c) => c.level.get()).sort();
      assertEquals(levels, [3, 4]);
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
});

Deno.test({
  name:
    "DenoKV - nested lookup: filter by two FK levels (projectRole__project__organisation)",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const backend = new DenoKVBackend({
      name: "nested-lookup-2",
      path: ":memory:",
    });
    await backend.connect();
    await setup({ backend });

    try {
      // Create two organisations
      const org1 = await Organisation.objects.create({ name: "Org One" });
      const org2 = await Organisation.objects.create({ name: "Org Two" });

      // Create projects for each org
      const project1 = await Project.objects.create({
        name: "Project A",
        organisation: org1,
      });
      const project2 = await Project.objects.create({
        name: "Project B",
        organisation: org2,
      });

      // Create roles for each project
      const role1 = await ProjectRole.objects.create({
        name: "Dev",
        project: project1,
      });
      const role2 = await ProjectRole.objects.create({
        name: "QA",
        project: project2,
      });

      // Create competences
      await ProjectRoleCompetence.objects.create({
        level: 1,
        projectRole: role1,
      });
      await ProjectRoleCompetence.objects.create({
        level: 2,
        projectRole: role2,
      });

      // Filter competences by organisation (2-level nested lookup)
      const competences = await ProjectRoleCompetence.objects
        .filter({ projectRole__project__organisation: org1.id.get() })
        .fetch();

      const compArray = competences.array();

      // Should only return competences for roles in org1's projects
      assertEquals(compArray.length, 1);
      assertEquals(compArray[0].level.get(), 1);
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
});

Deno.test({
  name: "DenoKV - nested lookup: filter returns empty when no matches",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const backend = new DenoKVBackend({
      name: "nested-lookup-3",
      path: ":memory:",
    });
    await backend.connect();
    await setup({ backend });

    try {
      const org = await Organisation.objects.create({ name: "Test Org" });
      const project = await Project.objects.create({
        name: "Test Project",
        organisation: org,
      });
      const role = await ProjectRole.objects.create({
        name: "Test Role",
        project: project,
      });
      await ProjectRoleCompetence.objects.create({
        level: 3,
        projectRole: role,
      });

      // Filter with non-existent project ID
      const competences = await ProjectRoleCompetence.objects
        .filter({ projectRole__project: 99999 })
        .fetch();

      assertEquals(competences.array().length, 0);
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
});

Deno.test({
  name: "DenoKV - nested lookup: combined with regular filters",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const backend = new DenoKVBackend({
      name: "nested-lookup-4",
      path: ":memory:",
    });
    await backend.connect();
    await setup({ backend });

    try {
      const org = await Organisation.objects.create({ name: "Acme" });
      const project = await Project.objects.create({
        name: "Main Project",
        organisation: org,
      });
      const role = await ProjectRole.objects.create({
        name: "Engineer",
        project: project,
      });

      // Create competences with different levels
      await ProjectRoleCompetence.objects.create({
        level: 1,
        projectRole: role,
      });
      await ProjectRoleCompetence.objects.create({
        level: 3,
        projectRole: role,
      });
      await ProjectRoleCompetence.objects.create({
        level: 5,
        projectRole: role,
      });

      // Filter by nested lookup AND regular field
      const competences = await ProjectRoleCompetence.objects
        .filter({
          projectRole__project: project.id.get(),
          level__gte: 3,
        })
        .fetch();

      const compArray = competences.array();

      // Should only return competences with level >= 3
      assertEquals(compArray.length, 2);

      const levels = compArray.map((c) => c.level.get()).sort();
      assertEquals(levels, [3, 5]);
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
});

Deno.test({
  name: "DenoKV - nested lookup: multiple models with same FK target",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const backend = new DenoKVBackend({
      name: "nested-lookup-5",
      path: ":memory:",
    });
    await backend.connect();
    await setup({ backend });

    try {
      const org = await Organisation.objects.create({ name: "Corp" });
      const project = await Project.objects.create({
        name: "Big Project",
        organisation: org,
      });
      const role = await ProjectRole.objects.create({
        name: "Lead",
        project: project,
      });

      // Create positions for the role
      await ProjectPosition.objects.create({
        title: "Senior Dev",
        projectRole: role,
      });
      await ProjectPosition.objects.create({
        title: "Junior Dev",
        projectRole: role,
      });

      // Filter positions by project (nested lookup)
      const positions = await ProjectPosition.objects
        .filter({ projectRole__project: project.id.get() })
        .fetch();

      assertEquals(positions.array().length, 2);

      const titles = positions.array().map((p) => p.title.get()).sort();
      assertEquals(titles, ["Junior Dev", "Senior Dev"]);
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
});

Deno.test({
  name: "DenoKV - nested lookup: filter by FK field with string lookup type",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const backend = new DenoKVBackend({
      name: "nested-lookup-6",
      path: ":memory:",
    });
    await backend.connect();
    await setup({ backend });

    try {
      const org1 = await Organisation.objects.create({ name: "Alpha Corp" });
      const org2 = await Organisation.objects.create({ name: "Beta Inc" });

      const project1 = await Project.objects.create({
        name: "Project 1",
        organisation: org1,
      });
      const project2 = await Project.objects.create({
        name: "Project 2",
        organisation: org2,
      });

      const role1 = await ProjectRole.objects.create({
        name: "Role A",
        project: project1,
      });
      const role2 = await ProjectRole.objects.create({
        name: "Role B",
        project: project2,
      });

      await ProjectRoleCompetence.objects.create({
        level: 1,
        projectRole: role1,
      });
      await ProjectRoleCompetence.objects.create({
        level: 2,
        projectRole: role2,
      });

      // Filter using `in` lookup on nested FK
      const competences = await ProjectRoleCompetence.objects
        .filter({
          projectRole__project__in: [project1.id.get(), project2.id.get()],
        })
        .fetch();

      // Should return both competences
      assertEquals(competences.array().length, 2);
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
});

Deno.test({
  name: "DenoKV - nested lookup: ordering still works with nested filters",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const backend = new DenoKVBackend({
      name: "nested-lookup-7",
      path: ":memory:",
    });
    await backend.connect();
    await setup({ backend });

    try {
      const org = await Organisation.objects.create({ name: "Test" });
      const project = await Project.objects.create({
        name: "Test Project",
        organisation: org,
      });
      const role = await ProjectRole.objects.create({
        name: "Test Role",
        project: project,
      });

      await ProjectRoleCompetence.objects.create({
        level: 5,
        projectRole: role,
      });
      await ProjectRoleCompetence.objects.create({
        level: 2,
        projectRole: role,
      });
      await ProjectRoleCompetence.objects.create({
        level: 8,
        projectRole: role,
      });

      // Filter with nested lookup and order by level
      const competences = await ProjectRoleCompetence.objects
        .filter({ projectRole__project: project.id.get() })
        .orderBy("level")
        .fetch();

      const levels = competences.array().map((c) => c.level.get());
      assertEquals(levels, [2, 5, 8]);

      // Reverse order
      const competencesDesc = await ProjectRoleCompetence.objects
        .filter({ projectRole__project: project.id.get() })
        .orderBy("-level")
        .fetch();

      const levelsDesc = competencesDesc.array().map((c) => c.level.get());
      assertEquals(levelsDesc, [8, 5, 2]);
    } finally {
      await reset();
      await backend.disconnect();
    }
  },
});
