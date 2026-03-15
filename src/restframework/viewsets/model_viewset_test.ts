/**
 * ModelViewSet Tests
 *
 * Tests for `ModelViewSet.getQueryset(context)` — verifying that the context
 * is correctly passed to overrides so that user-scoped filtering works.
 *
 * @module @alexi/restframework/viewsets/model_viewset_test
 */

import { assertEquals } from "jsr:@std/assert@1";
import { setup } from "@alexi/core";
import {
  AutoField,
  CharField,
  IntegerField,
  Manager,
  Model,
  reset,
} from "@alexi/db";
import { DenoKVBackend } from "@alexi/db/backends/denokv";
import { Serializer } from "../serializers/serializer.ts";
import type { SerializerClass } from "./model_viewset.ts";
import type { ViewSetContext } from "./viewset.ts";
import { ModelViewSet } from "./model_viewset.ts";

// =============================================================================
// Test model
// =============================================================================

class NoteModel extends Model {
  id = new AutoField({ primaryKey: true });
  body = new CharField({ maxLength: 500 });
  authorId = new IntegerField({ default: 0 });

  static objects = new Manager(NoteModel);
  static override meta = {
    dbTable: "mvs_notes",
    ordering: ["id"],
  };
}

// Minimal stub serializer — satisfies the abstract `serializer_class` requirement
// without needing a full ModelSerializer configuration.
class NoteSerializer extends Serializer {}

// =============================================================================
// Helpers
// =============================================================================

async function makeBackend() {
  const backend = new DenoKVBackend({ name: "mvs_test", path: ":memory:" });
  await backend.connect();
  await setup({ DATABASES: { default: backend } });
  return backend;
}

async function teardown(backend: DenoKVBackend) {
  await reset();
  await backend.disconnect();
}

function makeContext(userId?: number): ViewSetContext {
  return {
    request: new Request("http://localhost/api/notes/"),
    params: {},
    action: "list",
    user: userId !== undefined
      ? { id: userId, email: `user${userId}@example.com`, isAdmin: false }
      : undefined,
  };
}

// =============================================================================
// Tests
// =============================================================================

Deno.test({
  name: "ModelViewSet.getQueryset: returns all records by default",
  async fn() {
    const backend = await makeBackend();
    try {
      await NoteModel.objects.create({ body: "Hello", authorId: 1 });
      await NoteModel.objects.create({ body: "World", authorId: 2 });

      class NoteViewSet extends ModelViewSet {
        override model = NoteModel as never;
        override serializer_class: SerializerClass = NoteSerializer;
      }

      const viewset = new NoteViewSet();
      const qs = await viewset.getQueryset(makeContext());
      const records = (await qs.fetch()).array();

      assertEquals(records.length, 2);
    } finally {
      await teardown(backend);
    }
  },
});

Deno.test({
  name:
    "ModelViewSet.getQueryset: override with context enables user-scoped filtering",
  async fn() {
    const backend = await makeBackend();
    try {
      await NoteModel.objects.create({ body: "User 1 note", authorId: 1 });
      await NoteModel.objects.create({ body: "User 2 note", authorId: 2 });
      await NoteModel.objects.create({
        body: "Another user 1 note",
        authorId: 1,
      });

      class UserScopedNoteViewSet extends ModelViewSet {
        override model = NoteModel as never;
        override serializer_class: SerializerClass = NoteSerializer;

        /** Filter notes to those belonging to the authenticated user. */
        override async getQueryset(context: ViewSetContext) {
          if (!context.user) {
            // Return empty queryset for unauthenticated requests
            return NoteModel.objects.filter({ authorId: -1 });
          }
          return NoteModel.objects.filter({
            authorId: context.user.id as number,
          });
        }
      }

      const viewset = new UserScopedNoteViewSet();

      // User 1 sees only their own notes
      const user1Qs = await viewset.getQueryset(makeContext(1));
      const user1Notes = (await user1Qs.fetch()).array();
      assertEquals(user1Notes.length, 2);
      for (const note of user1Notes) {
        assertEquals(note.authorId.get(), 1);
      }

      // User 2 sees only their own note
      const user2Qs = await viewset.getQueryset(makeContext(2));
      const user2Notes = (await user2Qs.fetch()).array();
      assertEquals(user2Notes.length, 1);
      assertEquals(user2Notes[0].body.get(), "User 2 note");

      // Unauthenticated returns empty queryset
      const anonQs = await viewset.getQueryset(makeContext());
      const anonNotes = (await anonQs.fetch()).array();
      assertEquals(anonNotes.length, 0);
    } finally {
      await teardown(backend);
    }
  },
});

Deno.test({
  name: "ModelViewSet.getQueryset: context.user is available in list() handler",
  async fn() {
    const backend = await makeBackend();
    try {
      await NoteModel.objects.create({ body: "Note A", authorId: 42 });
      await NoteModel.objects.create({ body: "Note B", authorId: 99 });

      class FilteredNoteViewSet extends ModelViewSet {
        override model = NoteModel as never;
        override serializer_class: SerializerClass = NoteSerializer;

        override async getQueryset(context: ViewSetContext) {
          const userId = context.user?.id as number | undefined;
          if (userId === undefined) {
            return NoteModel.objects.all();
          }
          return NoteModel.objects.filter({ authorId: userId });
        }
      }

      // Simulate list() calling getQueryset() with context
      const viewset = new FilteredNoteViewSet();
      const context = makeContext(42);
      const qs = await viewset.getQueryset(context);
      const items = (await qs.fetch()).array();

      assertEquals(items.length, 1);
      assertEquals(items[0].body.get(), "Note A");
    } finally {
      await teardown(backend);
    }
  },
});
