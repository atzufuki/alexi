import { IDBPDatabase, openDB } from 'idb';

import { Model } from '../models/model.ts';
import { QuerySet } from '../models/query.ts';
import { BaseDatabaseBackend } from './base.ts';

export class IndexedDBBackend extends BaseDatabaseBackend {
  declare db: IDBPDatabase<unknown>;

  async init() {
    this.db = await openDB(
      this.databaseConfig.NAME,
      this.databaseConfig.VERSION,
      {
        upgrade: async (db) => {
          this.databaseConfig.ON_UPGRADE(db);
        },
      },
    );
  }

  async create(qs: QuerySet<any>, serialized: any): Promise<any> {
    const key = await this.db
      .transaction(qs.modelClass.meta.dbTable, 'readwrite')
      .objectStore(qs.modelClass.meta.dbTable)
      .add(serialized);

    return {
      id: key,
    };
  }

  async get(qs: QuerySet<any>): Promise<any[]> {
    const id = qs.query.where[0].id;

    if (id) {
      const obj = await this.db
        .transaction(qs.modelClass.meta.dbTable, 'readwrite')
        .objectStore(qs.modelClass.meta.dbTable)
        .get(id);

      if (!obj) {
        return [];
      }

      return [
        {
          ...obj,
          id,
        },
      ];
    }

    return this.fetch(qs);
  }

  async fetch(qs: QuerySet<any>): Promise<any[]> {
    return await this.query(qs, 'readonly');
  }

  async update(qs: QuerySet<any>, serialized: any): Promise<any[]> {
    const { id, ...data } = serialized;

    if (id) {
      const key = await this.db
        .transaction(qs.modelClass.meta.dbTable, 'readwrite')
        .objectStore(qs.modelClass.meta.dbTable)
        .put({ ...data, id });

      return [{ id: key }];
    }

    const results = await this.query(qs, 'readwrite');

    for (const result of results) {
      await this.db
        .transaction(qs.modelClass.meta.dbTable, 'readwrite')
        .objectStore(qs.modelClass.meta.dbTable)
        .put({ ...data, id: result.id });
    }

    return results.map(({ id, ...data }) => {
      return {
        ...data,
        id: id,
      };
    });
  }

  async delete(qs: QuerySet<any>): Promise<void> {
    const results = await this.query(qs, 'readwrite');
    for (const result of results) {
      await this.db
        .transaction(qs.modelClass.meta.dbTable, 'readwrite')
        .objectStore(qs.modelClass.meta.dbTable)
        .delete(result.id);
    }
  }

  private async query<T extends Model<T>>(
    qs: QuerySet<T>,
    mode: 'readonly' | 'readwrite',
  ) {
    const store = this.db
      .transaction(qs.modelClass.meta.dbTable, mode)
      .objectStore(qs.modelClass.meta.dbTable);
    const ordering = qs.query.ordering.length > 0 ? qs.query.ordering : ['id'];
    const results = [];

    for (const field of ordering) {
      const direction = field.startsWith('-') ? 'prev' : 'next';
      const fieldName = direction === 'prev' ? field.slice(1) : field;

      let cursor;

      try {
        cursor = await store.index(fieldName).openCursor(null, direction);
      } catch (error) {
        cursor = await store.openCursor(null, direction);
      }

      while (cursor) {
        const match = this.executeFilter(qs, cursor);

        if (match) {
          results.push(cursor.value);
        }

        cursor = await cursor.continue();
      }
    }

    return results;
  }

  private executeFilter = (
    qs: QuerySet<Model<any>>,
    cursor: IDBCursorWithValue,
  ) => {
    const results = [];

    for (const filter of qs.query.where) {
      for (const key in filter) {
        const [fieldName, condition = 'eq'] = key.split('__');
        let param = filter[key];
        let value = cursor.value[fieldName];
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

export default IndexedDBBackend;
