/**
 * Tests for ForeignKey reverse relations (RelatedManager)
 *
 * Tests for Issue #39: Add reverse relations support (Django-style RelatedManager)
 *
 * @module
 */

import {
  assertEquals,
  assertExists,
  assertInstanceOf,
} from "jsr:@std/assert@1";
import {
  AutoField,
  CharField,
  IntegerField,
  Manager,
  Model,
  ModelRegistry,
  RelatedManager,
  TextField,
} from "../mod.ts";
import { ForeignKey, OnDelete } from "../fields/relations.ts";
import { reset, setup } from "../setup.ts";
import { DenoKVBackend } from "../backends/denokv/mod.ts";

// ============================================================================
// Test Models
// ============================================================================

class ProjectRole extends Model {
  id = new AutoField({ primaryKey: true });
  name = new CharField({ maxLength: 255 });
  description = new TextField({ blank: true, default: "" });

  // TypeScript type declaration for reverse relation
  // Runtime populates this based on relatedName in ProjectRoleCompetence
  declare roleCompetences: RelatedManager<ProjectRoleCompetence>;

  static objects = new Manager(ProjectRole);
  static override meta = {
    dbTable: "project_roles",
  };
}

class Competence extends Model {
  id = new AutoField({ primaryKey: true });
  name = new CharField({ maxLength: 100 });

  // Reverse relation from ProjectRoleCompetence
  declare roleCompetences: RelatedManager<ProjectRoleCompetence>;

  static objects = new Manager(Competence);
  static override meta = {
    dbTable: "competences",
  };
}

class ProjectRoleCompetence extends Model {
  id = new AutoField({ primaryKey: true });
  projectRole = new ForeignKey<ProjectRole>("ProjectRole", {
    onDelete: OnDelete.CASCADE,
    relatedName: "roleCompetences",
  });
  competence = new ForeignKey<Competence>("Competence", {
    onDelete: OnDelete.CASCADE,
    relatedName: "roleCompetences",
  });
  level = new IntegerField({ default: 1 });

  static objects = new Manager(ProjectRoleCompetence);
  static override meta = {
    dbTable: "project_role_competences",
  };
}

// Additional test models for edge cases
class Author extends Model {
  id = new AutoField({ primaryKey: true });
  name = new CharField({ maxLength: 100 });

  declare articles: RelatedManager<Article>;
  declare books: RelatedManager<Book>;

  static objects = new Manager(Author);
  static override meta = {
    dbTable: "authors",
  };
}

class Article extends Model {
  id = new AutoField({ primaryKey: true });
  title = new CharField({ maxLength: 200 });
  author = new ForeignKey<Author>("Author", {
    onDelete: OnDelete.CASCADE,
    relatedName: "articles",
  });

  static objects = new Manager(Article);
  static override meta = {
    dbTable: "articles",
  };
}

class Book extends Model {
  id = new AutoField({ primaryKey: true });
  title = new CharField({ maxLength: 200 });
  pages = new IntegerField({ default: 0 });
  author = new ForeignKey<Author>("Author", {
    onDelete: OnDelete.CASCADE,
    relatedName: "books",
  });

  static objects = new Manager(Book);
  static override meta = {
    dbTable: "books",
  };
}

// ============================================================================
// Test Setup/Teardown Helpers
// ============================================================================

async function setupTestBackend(): Promise<DenoKVBackend> {
  const backend = new DenoKVBackend({
    name: "reverse-relations-test",
    path: ":memory:",
  });
  await backend.connect();
  await setup({ backend });
  return backend;
}

async function teardown(backend: DenoKVBackend): Promise<void> {
  await reset();
  await backend.disconnect();
}

// ============================================================================
// Registry Tests
// ============================================================================

Deno.test({
  name: "RelatedManager - ModelRegistry tracks reverse relations",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const backend = await setupTestBackend();

    try {
      // Force model registration by creating instances and calling getFields()
      // getFields() triggers _ensureFieldsInitialized() which registers the model
      new ProjectRole().getFields();
      new Competence().getFields();
      new ProjectRoleCompetence().getFields();

      // Check that reverse relations are registered for ProjectRole
      const projectRoleRelations = ModelRegistry.instance.getReverseRelations(
        "ProjectRole",
      );
      assertExists(projectRoleRelations);
      assertEquals(projectRoleRelations.length, 1);
      assertEquals(projectRoleRelations[0].relatedName, "roleCompetences");
      assertEquals(
        projectRoleRelations[0].relatedModelName,
        "ProjectRoleCompetence",
      );
      assertEquals(projectRoleRelations[0].fieldName, "projectRole");

      // Check that reverse relations are registered for Competence
      const competenceRelations = ModelRegistry.instance.getReverseRelations(
        "Competence",
      );
      assertExists(competenceRelations);
      assertEquals(competenceRelations.length, 1);
      assertEquals(competenceRelations[0].relatedName, "roleCompetences");
      assertEquals(
        competenceRelations[0].relatedModelName,
        "ProjectRoleCompetence",
      );
      assertEquals(competenceRelations[0].fieldName, "competence");
    } finally {
      await teardown(backend);
    }
  },
});

Deno.test({
  name: "RelatedManager - Multiple reverse relations on same model",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const backend = await setupTestBackend();

    try {
      // Force model registration by calling getFields()
      new Author().getFields();
      new Article().getFields();
      new Book().getFields();

      // Author should have two reverse relations
      const authorRelations = ModelRegistry.instance.getReverseRelations(
        "Author",
      );
      assertExists(authorRelations);
      assertEquals(authorRelations.length, 2);

      const articleRelation = authorRelations.find(
        (r) => r.relatedName === "articles",
      );
      const bookRelation = authorRelations.find(
        (r) => r.relatedName === "books",
      );

      assertExists(articleRelation);
      assertEquals(articleRelation.relatedModelName, "Article");
      assertEquals(articleRelation.fieldName, "author");

      assertExists(bookRelation);
      assertEquals(bookRelation.relatedModelName, "Book");
      assertEquals(bookRelation.fieldName, "author");
    } finally {
      await teardown(backend);
    }
  },
});

// ============================================================================
// RelatedManager Instance Tests
// ============================================================================

Deno.test({
  name: "RelatedManager - Instance has RelatedManager property",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const backend = await setupTestBackend();

    try {
      // Create a project role
      const role = await ProjectRole.objects.create({
        name: "Software Engineer",
        description: "Builds software",
      });

      // Reload from database
      const loadedRole = await ProjectRole.objects.get({ id: role.id.get() });

      // Check that roleCompetences is a RelatedManager
      assertExists(loadedRole.roleCompetences);
      assertInstanceOf(loadedRole.roleCompetences, RelatedManager);
    } finally {
      await teardown(backend);
    }
  },
});

Deno.test({
  name: "RelatedManager - all() returns QuerySet",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const backend = await setupTestBackend();

    try {
      // Create test data
      const role = await ProjectRole.objects.create({
        name: "Backend Developer",
      });

      const competence1 = await Competence.objects.create({ name: "Python" });
      const competence2 = await Competence.objects.create({
        name: "PostgreSQL",
      });

      await ProjectRoleCompetence.objects.create({
        projectRole: role,
        competence: competence1,
        level: 3,
      });

      await ProjectRoleCompetence.objects.create({
        projectRole: role,
        competence: competence2,
        level: 2,
      });

      // Reload role
      const loadedRole = await ProjectRole.objects.get({ id: role.id.get() });

      // Get all related competences
      const roleCompetences = await loadedRole.roleCompetences.all().fetch();

      assertEquals(roleCompetences.length(), 2);
    } finally {
      await teardown(backend);
    }
  },
});

Deno.test({
  name: "RelatedManager - filter() works correctly",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const backend = await setupTestBackend();

    try {
      // Create test data
      const role = await ProjectRole.objects.create({
        name: "Full Stack Developer",
      });

      const competence1 = await Competence.objects.create({ name: "React" });
      const competence2 = await Competence.objects.create({ name: "Node.js" });

      await ProjectRoleCompetence.objects.create({
        projectRole: role,
        competence: competence1,
        level: 5,
      });

      await ProjectRoleCompetence.objects.create({
        projectRole: role,
        competence: competence2,
        level: 3,
      });

      // Reload role
      const loadedRole = await ProjectRole.objects.get({ id: role.id.get() });

      // Filter by level
      const highLevelCompetences = await loadedRole.roleCompetences
        .filter({ level: 5 })
        .fetch();

      assertEquals(highLevelCompetences.length(), 1);

      const first = highLevelCompetences.array()[0];
      assertEquals(first.level.get(), 5);
    } finally {
      await teardown(backend);
    }
  },
});

Deno.test({
  name: "RelatedManager - count() returns correct count",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const backend = await setupTestBackend();

    try {
      // Create test data
      const role = await ProjectRole.objects.create({
        name: "DevOps Engineer",
      });

      const comp1 = await Competence.objects.create({ name: "Docker" });
      const comp2 = await Competence.objects.create({ name: "Kubernetes" });
      const comp3 = await Competence.objects.create({ name: "AWS" });

      await ProjectRoleCompetence.objects.create({
        projectRole: role,
        competence: comp1,
      });
      await ProjectRoleCompetence.objects.create({
        projectRole: role,
        competence: comp2,
      });
      await ProjectRoleCompetence.objects.create({
        projectRole: role,
        competence: comp3,
      });

      // Reload role
      const loadedRole = await ProjectRole.objects.get({ id: role.id.get() });

      // Count related
      const count = await loadedRole.roleCompetences.count();
      assertEquals(count, 3);
    } finally {
      await teardown(backend);
    }
  },
});

Deno.test({
  name: "RelatedManager - exists() returns correct boolean",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const backend = await setupTestBackend();

    try {
      // Create role without competences
      const emptyRole = await ProjectRole.objects.create({
        name: "Empty Role",
      });

      // Create role with competences
      const filledRole = await ProjectRole.objects.create({
        name: "Filled Role",
      });

      const comp = await Competence.objects.create({ name: "Skill" });
      await ProjectRoleCompetence.objects.create({
        projectRole: filledRole,
        competence: comp,
      });

      // Reload roles
      const loadedEmptyRole = await ProjectRole.objects.get({
        id: emptyRole.id.get(),
      });
      const loadedFilledRole = await ProjectRole.objects.get({
        id: filledRole.id.get(),
      });

      // Check exists
      const emptyExists = await loadedEmptyRole.roleCompetences.exists();
      const filledExists = await loadedFilledRole.roleCompetences.exists();

      assertEquals(emptyExists, false);
      assertEquals(filledExists, true);
    } finally {
      await teardown(backend);
    }
  },
});

Deno.test({
  name: "RelatedManager - create() sets FK automatically",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const backend = await setupTestBackend();

    try {
      // Create test data
      const role = await ProjectRole.objects.create({
        name: "Data Scientist",
      });

      const comp = await Competence.objects.create({
        name: "Machine Learning",
      });

      // Reload role
      const loadedRole = await ProjectRole.objects.get({ id: role.id.get() });

      // Create via RelatedManager - FK should be set automatically
      const newRoleComp = await loadedRole.roleCompetences.create({
        competence: comp,
        level: 4,
      });

      // Verify FK was set correctly
      assertEquals(newRoleComp.projectRole.id, role.id.get());
      assertEquals(newRoleComp.level.get(), 4);

      // Verify it's in the database
      const fromDb = await ProjectRoleCompetence.objects.get({
        id: newRoleComp.id.get(),
      });
      assertEquals(fromDb.projectRole.id, role.id.get());
    } finally {
      await teardown(backend);
    }
  },
});

Deno.test({
  name: "RelatedManager - first() and last() work correctly",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const backend = await setupTestBackend();

    try {
      // Create author with multiple articles
      const author = await Author.objects.create({ name: "Jane Doe" });

      await Article.objects.create({
        title: "First Article",
        author: author,
      });

      await Article.objects.create({
        title: "Second Article",
        author: author,
      });

      await Article.objects.create({
        title: "Third Article",
        author: author,
      });

      // Reload author
      const loadedAuthor = await Author.objects.get({ id: author.id.get() });

      // Test first() and last()
      const first = await loadedAuthor.articles.first();
      const last = await loadedAuthor.articles.last();

      assertExists(first);
      assertExists(last);
      // Note: Order depends on default ordering, but both should exist
    } finally {
      await teardown(backend);
    }
  },
});

Deno.test({
  name: "RelatedManager - exclude() works correctly",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const backend = await setupTestBackend();

    try {
      // Create author with multiple books
      const author = await Author.objects.create({ name: "John Smith" });

      await Book.objects.create({
        title: "Short Book",
        pages: 100,
        author: author,
      });

      await Book.objects.create({
        title: "Long Book",
        pages: 500,
        author: author,
      });

      await Book.objects.create({
        title: "Medium Book",
        pages: 250,
        author: author,
      });

      // Reload author
      const loadedAuthor = await Author.objects.get({ id: author.id.get() });

      // Exclude short books (100 pages)
      const longBooks = await loadedAuthor.books
        .exclude({ pages: 100 })
        .fetch();

      assertEquals(longBooks.length(), 2);
    } finally {
      await teardown(backend);
    }
  },
});

// ============================================================================
// Edge Cases
// ============================================================================

Deno.test({
  name: "RelatedManager - Empty result set",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const backend = await setupTestBackend();

    try {
      // Create role without any competences
      const role = await ProjectRole.objects.create({
        name: "New Role",
      });

      // Reload role
      const loadedRole = await ProjectRole.objects.get({ id: role.id.get() });

      // Should return empty queryset
      const roleCompetences = await loadedRole.roleCompetences.all().fetch();
      assertEquals(roleCompetences.length(), 0);

      const count = await loadedRole.roleCompetences.count();
      assertEquals(count, 0);
    } finally {
      await teardown(backend);
    }
  },
});

Deno.test({
  name: "RelatedManager - Only returns related objects (not all)",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const backend = await setupTestBackend();

    try {
      // Create two roles
      const role1 = await ProjectRole.objects.create({ name: "Role 1" });
      const role2 = await ProjectRole.objects.create({ name: "Role 2" });

      const comp1 = await Competence.objects.create({ name: "Skill A" });
      const comp2 = await Competence.objects.create({ name: "Skill B" });

      // Assign comp1 to role1, comp2 to role2
      await ProjectRoleCompetence.objects.create({
        projectRole: role1,
        competence: comp1,
        level: 1,
      });

      await ProjectRoleCompetence.objects.create({
        projectRole: role2,
        competence: comp2,
        level: 2,
      });

      // Reload roles
      const loadedRole1 = await ProjectRole.objects.get({ id: role1.id.get() });
      const loadedRole2 = await ProjectRole.objects.get({ id: role2.id.get() });

      // Each role should only see its own competences
      const role1Comps = await loadedRole1.roleCompetences.all().fetch();
      const role2Comps = await loadedRole2.roleCompetences.all().fetch();

      assertEquals(role1Comps.length(), 1);
      assertEquals(role2Comps.length(), 1);

      // Verify they're different
      assertEquals(role1Comps.array()[0].level.get(), 1);
      assertEquals(role2Comps.array()[0].level.get(), 2);
    } finally {
      await teardown(backend);
    }
  },
});

Deno.test({
  name: "RelatedManager - Properties return correct values",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const backend = await setupTestBackend();

    try {
      const role = await ProjectRole.objects.create({ name: "Test Role" });
      const loadedRole = await ProjectRole.objects.get({ id: role.id.get() });

      const manager = loadedRole.roleCompetences;

      // Check properties
      assertEquals(manager.sourceInstance, loadedRole);
      assertEquals(manager.relatedModel, ProjectRoleCompetence);
      assertEquals(manager.fieldName, "projectRole");
    } finally {
      await teardown(backend);
    }
  },
});
