import { Model } from '../models/model.ts';
import { QuerySet } from '../models/query.ts';
import { BaseDatabaseBackend } from './base.ts';

export class DenoKVBackend extends BaseDatabaseBackend {
  declare db: Deno.Kv;

  async init(databaseName: string): Promise<this> {
    this.db = await Deno.openKv(databaseName);
    globalThis.alexi.conf.databases[databaseName] = this;
    return this;
  }

  async create(qs: QuerySet<any>, serialized: any): Promise<any> {
    if (!serialized.id) {
      serialized.id = Math.random().toString(36).substring(7);
    }

    await this.db.set([qs.modelClass.meta.dbTable, serialized.id], serialized);
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
      return [{ id }];
    }

    const results = await this.query(qs);

    for (const result of results) {
      await this.db.set([qs.modelClass.meta.dbTable, result.id], {
        ...data,
        id: result.id,
      });
    }

    return results.map(({ id, ...data }) => {
      return {
        ...data,
        id: id,
      };
    });
  }

  async delete(qs: QuerySet<any>): Promise<void> {
    const results = await this.query(qs);

    for (const result of results) {
      await this.db.delete([qs.modelClass.meta.dbTable, result.id]);
    }
  }

  private async query<T extends Model<T>>(qs: QuerySet<T>) {
    const results = [];
    for await (
      const entry of this.db.list({ prefix: [qs.modelClass.meta.dbTable] })
    ) {
      const match = this.executeFilter(qs, entry.value as any);

      if (match) {
        results.push(entry.value);
      }
    }
    return results;
  }

  private executeFilter = (
    qs: QuerySet<Model<any>>,
    entry: { key: string; value: any },
  ) => {
    const results = [];

    for (const filter of qs.query.where) {
      for (const key in filter) {
        const [fieldName, condition = 'eq'] = key.split('__');
        let param = filter[key];
        let value = entry[fieldName];
        let result = false;

        if (param instanceof Model) {
          param = param.id.value;
        } else if (Array.isArray(param) && param[0] instanceof Model) {
          param = param.map((item) => item.id.value);
        }

        if (param instanceof Date) {
          param = param.getTime();
        }

        if (value instanceof Date) {
          value = value.getTime();
        }

        if (!param) {
          throw new Error('Invalid filter param:', {
            [key]: param,
          });
        }

        switch (condition) {
          case 'eq':
            if (value === param) {
              result = true;
            }
            break;
          case 'ne':
            if (value !== param) {
              result = true;
            }
            break;
          case 'in':
            if (param.includes(value)) {
              result = true;
            }
            break;
          case 'nin':
            if (!param.includes(value)) {
              result = true;
            }
            break;
          case 'gt':
            if (value > param) {
              result = true;
            }
            break;
          case 'lt':
            if (value < param) {
              result = true;
            }
            break;
          case 'gte':
            if (value >= param) {
              result = true;
            }
            break;
          case 'lte':
            if (value <= param) {
              result = true;
            }
            break;
          default:
            throw new Error('Invalid filter condition:', {
              [key]: condition,
            });
        }

        results.push(result);
      }
    }

    return results.every((r) => r);
  };
}

export default DenoKVBackend;
