import { Model } from '../models/model.ts';
import { QuerySet } from '../models/query.ts';
import { BaseDatabaseBackend } from './base.ts';

export class DenoKVBackend extends BaseDatabaseBackend {
  declare db: Deno.Kv;

  async init() {
    this.db = await Deno.openKv(this.databaseConfig.NAME);
  }

  async create(qs: QuerySet<any>, serialized: any): Promise<any> {
    if (!serialized.id) {
      serialized.id = Math.random().toString(36).substring(7);
    }

    await this.db.set([qs.modelClass.meta.dbTable, serialized.id], serialized);

    await this.setIndexes(qs, serialized);

    return {
      id: serialized.id,
    };
  }

  async get(qs: QuerySet<any>): Promise<any[]> {
    const id = qs.query.where[0].id;

    if (id) {
      const obj = await this.db.get([qs.modelClass.meta.dbTable, id]);

      if (!obj.value) {
        return [];
      }

      return [
        {
          ...obj.value as any,
          id,
        },
      ];
    }

    return this.fetch(qs);
  }

  async fetch(qs: QuerySet<any>): Promise<any[]> {
    return await this.query(qs);
  }

  async update(qs: QuerySet<any>, serialized: any): Promise<any[]> {
    const { id, ...data } = serialized;

    if (id) {
      await this.db.set([qs.modelClass.meta.dbTable, id], { ...data, id });
      await this.setIndexes(qs, { ...data, id: id });
      return [{ id }];
    }

    const results = await this.query(qs);

    for (const result of results) {
      await this.db.set([qs.modelClass.meta.dbTable, result.id], {
        ...data,
        id: result.id,
      });
      await this.setIndexes(qs, { ...data, id: result.id });
    }

    return results.map(({ id, ...data }) => {
      return {
        ...data,
        id: id,
      };
    });
  }

  async delete(qs: QuerySet<any>): Promise<void> {
    if (qs.query.where?.[0]?.id) {
      const id = qs.query.where[0].id;
      await this.db.delete([qs.modelClass.meta.dbTable, id]);
      // await this.deleteIndexes(qs, { id });
      return;
    }

    const results = await this.query(qs);

    for (const result of results) {
      await this.db.delete([qs.modelClass.meta.dbTable, result.id]);
      await this.deleteIndexes(qs, result);
    }
  }

  private async query<T extends Model<T>>(qs: QuerySet<T>) {
    const results = [];

    if (qs.query.where?.[0]?.id) {
      const id = qs.query.where[0].id;
      const obj = await this.db.get([qs.modelClass.meta.dbTable, id]);

      if (!obj.value) {
        return [];
      }

      return [
        {
          ...obj.value as any,
          id,
        },
      ];
    }

    if (qs.query.where.length > 0) {
      const filters = qs.query.where.filter((filter) =>
        qs.modelClass.meta.indexes?.some((index) =>
          index.fields.some((field) => Object.keys(filter).includes(field))
        )
      );

      if (filters.length !== qs.query.where.length) {
        const missingIndexes = qs.query.where
          .filter((filter) => !filters.includes(filter))
          .flatMap((filter) => Object.keys(filter));

        throw new Error(
          `Only indexed queries are supported. Set indexes for the following fields: ${
            missingIndexes.join(', ')
          }`,
        );
      }

      for (const filter of filters) {
        for (const key in filter) {
          const [fieldName, condition = 'eq'] = key.split('__');
          if (condition !== 'eq') {
            throw new Error(
              `Only 'eq' condition is supported for indexed queries.`,
            );
          }

          const indexKeyPrefix = [
            qs.modelClass.meta.dbTable + '__' + fieldName,
            filter[key],
          ];

          const entries = await this.db.list({ prefix: indexKeyPrefix });
          const keysToFetch = [];
          for await (const entry of entries) {
            keysToFetch.push([
              qs.modelClass.meta.dbTable,
              entry.value as string,
            ]);
          }

          if (keysToFetch.length > 0) {
            const objects = await this.db.getMany(keysToFetch);
            for (const obj of objects) {
              if (obj.value) {
                results.push(obj.value);
              }
            }
          }
        }
      }
    } else {
      for await (
        const entry of this.db.list({ prefix: [qs.modelClass.meta.dbTable] })
      ) {
        results.push(entry.value);
      }
    }

    return results;
  }

  private async setIndexes(qs: QuerySet<any>, serialized: any) {
    if (qs.modelClass.meta.indexes) {
      for (const index of qs.modelClass.meta.indexes) {
        for (const field of index.fields) {
          const fieldValue = serialized[field];
          if (fieldValue) {
            const indexKey = [
              qs.modelClass.meta.dbTable + '__' + field,
              fieldValue,
              serialized.id,
            ];
            await this.db.set(indexKey, serialized.id);
          }
        }
      }
    }
  }

  private async deleteIndexes(qs: QuerySet<any>, serialized: any) {
    if (qs.modelClass.meta.indexes) {
      for (const index of qs.modelClass.meta.indexes) {
        for (const field of index.fields) {
          const fieldValue = serialized[field];
          if (fieldValue) {
            const indexKey = [
              qs.modelClass.meta.dbTable + '__' + field,
              fieldValue,
              serialized.id,
            ];
            await this.db.delete(indexKey);
          }
        }
      }
    }
  }
}

export default DenoKVBackend;
