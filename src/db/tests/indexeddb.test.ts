import 'fake-indexeddb/auto';
import { assert } from '@std/assert';
import { setup } from '@alexi/web/setup';

import { IndexedDBBackend } from '../backends/indexeddb.ts';
import { Model } from '../models/model.ts';
import { CharField } from '../models/fields.ts';
import { Manager } from '../models/manager.ts';
import { ModelProps } from '../models/types.ts';

const options: Omit<Deno.TestDefinition, 'fn' | 'name'> = {
  sanitizeOps: false,
  sanitizeResources: false,
};

class TestModel extends Model<TestModel> {
  name = new CharField({ maxLength: 100 });

  constructor(props?: ModelProps<TestModel>) {
    super();
    this.init(props);
  }

  static objects: Manager<TestModel> = new Manager<TestModel>(TestModel);
  static meta = {
    dbTable: 'test_table',
  };
}

await setup({
  INSTALLED_APPS: [],
  DATABASES: {
    default: {
      NAME: 'default',
      ENGINE: IndexedDBBackend,
      VERSION: 1,
      ON_UPGRADE: (db: any) => {
        if (!db.objectStoreNames.contains(TestModel.meta.dbTable)) {
          db.createObjectStore(TestModel.meta.dbTable, {
            keyPath: 'id',
            autoIncrement: true,
          });
        }
      },
    },
  },
});

Deno.test('IndexedDBBackend create - single entry', options, async () => {
  const result = await TestModel.objects.create({ id: '1', name: 'Alice' });

  assert(result.name.get() === 'Alice');
  assert(result.id.get() === '1');

  await result.delete();
});

Deno.test('IndexedDBBackend create - multiple entries', options, async () => {
  await TestModel.objects.create({ id: '1', name: 'Alice' });
  await TestModel.objects.create({ id: '2', name: 'Bob' });
  const results = await TestModel.objects.all().fetch();
  const alice = results.first();
  const bob = results.last();

  assert(results.toArray().length === 2);
  assert(alice.name.get() === 'Alice');
  assert(alice.id.get() === '1');
  assert(bob.name.get() === 'Bob');
  assert(bob.id.get() === '2');

  await TestModel.objects.all().delete();
});

Deno.test('IndexedDBBackend create - missing id', options, async () => {
  const result = await TestModel.objects.create({ name: 'Alice' });

  assert(result.id.get());
  assert(result.name.get() === 'Alice');

  await result.delete();
});

Deno.test('IndexedDBBackend get - single entry', options, async () => {
  await TestModel.objects.create({ id: '1', name: 'Alice' });
  const result = await TestModel.objects.get({ id: '1' });

  assert(result.name.get() === 'Alice');
  assert(result.id.get() === '1');

  await result.delete();
});

Deno.test('IndexedDBBackend get - multiple entries', options, async () => {
  await TestModel.objects.create({ id: '1', name: 'Alice' });
  await TestModel.objects.create({ id: '2', name: 'Bob' });
  const result = await TestModel.objects.get({ id: '1' });

  assert(result.name.get() === 'Alice');
  assert(result.id.get() === '1');

  await TestModel.objects.all().delete();
});

Deno.test('IndexedDBBackend get - missing entry', options, async () => {
  let error = null;

  try {
    await TestModel.objects.get({ id: '1' });
  } catch (e) {
    error = e;
  }

  assert(error instanceof Error);
  assert(error.name === 'DoesNotExist');
});

Deno.test('IndexedDBBackend get - missing id', options, async () => {
  let error = null;

  try {
    await TestModel.objects.get({});
  } catch (e) {
    error = e;
  }

  assert(error instanceof Error);
  assert(error.name === 'DoesNotExist');
});

Deno.test('IndexedDBBackend fetch - multiple entries', options, async () => {
  await TestModel.objects.create({ id: '1', name: 'Alice' });
  await TestModel.objects.create({ id: '2', name: 'Bob' });
  const results = await TestModel.objects.all().fetch();
  const alice = results.first();
  const bob = results.last();

  assert(results.toArray().length === 2);
  assert(alice.name.get() === 'Alice');
  assert(alice.id.get() === '1');
  assert(bob.name.get() === 'Bob');
  assert(bob.id.get() === '2');

  await TestModel.objects.all().delete();
});

Deno.test('IndexedDBBackend update - single entry', options, async () => {
  await TestModel.objects.create({ id: '1', name: 'Alice' });
  await TestModel.objects.filter({ id: '1' }).update({ name: 'Alice Updated' });
  const result = await TestModel.objects.get({ id: '1' });

  assert(result.name.get() === 'Alice Updated');
  assert(result.id.get() === '1');

  await TestModel.objects.all().delete();
});

Deno.test('IndexedDBBackend update - multiple entries', options, async () => {
  await TestModel.objects.create({ id: '1', name: 'Alice' });
  await TestModel.objects.create({ id: '2', name: 'Bob' });
  await TestModel.objects.all().update({ name: 'Everyone' });
  const results = await TestModel.objects.all().fetch();

  assert(results.toArray().length === 2);
  assert(results.toArray()[0].name.get() === 'Everyone');
  assert(results.toArray()[0].id.get() === '1');
  assert(results.toArray()[1].name.get() === 'Everyone');
  assert(results.toArray()[1].id.get() === '2');

  await TestModel.objects.all().delete();
});

Deno.test('IndexedDBBackend delete - single entry', options, async () => {
  await TestModel.objects.create({ id: '1', name: 'Alice' });
  await TestModel.objects.filter({ id: '1' }).delete();
  const results = await TestModel.objects.all().fetch();

  assert(results.toArray().length === 0);

  await TestModel.objects.all().delete();
});

Deno.test('IndexedDBBackend delete - multiple entries', options, async () => {
  await TestModel.objects.create({ id: '1', name: 'Alice' });
  await TestModel.objects.create({ id: '2', name: 'Bob' });
  await TestModel.objects.all().delete();
  const results = await TestModel.objects.all().fetch();

  assert(results.toArray().length === 0);
});

Deno.test('cleanup', options, async () => {
  await TestModel.objects.all().delete();
});
