import {
  CreateParams,
  DATABASE,
  ExcludeParams,
  FilterParams,
  GetOrCreateParams,
  GetOrCreateResponse,
  GetParams,
  ModelClass,
  ModelProps,
  OrderByParams,
  UpdateOrCreateParams,
  UpdateOrCreateResponse,
  UpdateParams,
} from '@alexi/db/types.ts';
import { Model } from '@alexi/db/model.ts';
import { Manager } from '@alexi/db/manager.ts';
import { Field } from '@alexi/db/fields.ts';
import { DoesNotExist } from '@alexi/db/errors.ts';

class Query<T extends Model<T>> {
  ordering: string[] = [];
  where: FilterParams[] = [];
  [key: string]: any;
}

export class QuerySet<T extends Model<T>> {
  modelClass: ModelClass<T>;
  manager: Manager<T>;
  databaseConfig: DATABASE;
  query = new Query<T>();

  constructor(modelClass: ModelClass<T>) {
    this.modelClass = modelClass;
    this.manager = this.modelClass.objects as Manager<T>;
  }

  async fetch() {
    const engine = await this.getDatabase();
    await engine._fetch(this);
    return this;
  }

  async delete() {
    const engine = await this.getDatabase();
    return await engine.delete(this);
  }

  async get(params: GetParams): Promise<T> {
    this.query.where.push(params);
    const engine = await this.getDatabase();
    return await engine._get(this, params);
  }

  async create(params: CreateParams): Promise<T> {
    const engine = await this.getDatabase();
    return await engine._create(this, params);
  }

  async update(params: UpdateParams): Promise<T[]> {
    const engine = await this.getDatabase();
    return await engine._update(this, params);
  }

  async updateOrCreate(
    params: UpdateOrCreateParams,
  ): UpdateOrCreateResponse<T> {
    const { defaults, createDefaults, ...lookup } = params;

    let obj: T;
    let created = false;

    try {
      obj = await this.get(lookup);
      for (const key in defaults) {
        obj[key].set(defaults[key]);
      }
      obj = await obj.save();
    } catch (error) {
      if (error instanceof DoesNotExist) {
        if (createDefaults) {
          obj = await this.create({ ...lookup, ...createDefaults });
        } else {
          obj = await this.create({ ...lookup, ...defaults });
        }
        created = true;
      } else {
        throw error;
      }
    }

    return [obj, created];
  }

  async getOrCreate(params: GetOrCreateParams): GetOrCreateResponse<T> {
    const { defaults, ...lookup } = params;

    let obj: T;
    let created = false;

    try {
      obj = await this.get(lookup);
    } catch (error) {
      if (error instanceof DoesNotExist) {
        obj = await this.create({
          ...lookup,
          ...defaults,
        });
      }
      created = true;

      throw error;
    }

    return [obj, created];
  }

  all() {
    return this;
  }

  filter(where: FilterParams) {
    this.query.where.push(where);
    return this;
  }

  exclude(where: ExcludeParams) {
    const excludeWhere = {};

    for (const queryKey in where) {
      let [fieldKey, condition = 'eq'] = queryKey.split('__');

      switch (condition) {
        case 'eq':
          condition = 'ne';
          break;
        case 'in':
          condition = 'nin';
          break;
      }

      excludeWhere[fieldKey + '__' + condition] = where[queryKey];
    }

    this.query.where.push(excludeWhere);

    return this;
  }

  orderBy(...params: OrderByParams<T>) {
    const qs: QuerySet<T> = this.clone();
    qs.query.ordering.push(...(params as any));
    return qs;
  }

  values(..._fields: (keyof ModelProps<T>)[]) {
    // Implementation goes here
    // For example, you might want to return an array of certain properties of the objects
    return this;
  }

  valuesList(fieldKey: keyof ModelProps<T>, options = { flat: false }) {
    if (options.flat) {
      return this.toArray().flatMap((instance) => {
        const field = instance[fieldKey];
        if (field instanceof Field) {
          return field.value;
        }
      });
    }

    return this.toArray().map((instance) => {
      const field = instance[fieldKey];
      if (field instanceof Field) {
        return field.value;
      }
    });
  }

  reverse() {
    // Implementation goes here
    // For example, you might want to reverse the order of the objects
    return this;
  }

  toArray() {
    return this.manager.objects[this.databaseConfig.NAME]
      .filter(this.executeFilter)
      .sort(this.executeSort);
  }

  first(): T | null {
    const objects = this.toArray();
    return objects.length ? objects[0] : null;
  }

  last(): T | null {
    const objects = this.toArray();
    return objects.length ? objects[objects.length - 1] : null;
  }

  exists(): boolean {
    return this.toArray().length > 0;
  }

  count(): number {
    return this.toArray().length;
  }

  using(databaseName: string) {
    const qs: QuerySet<T> = this.clone();
    const settings = globalThis.alexi.conf.settings;
    qs.databaseConfig = settings.DATABASES[databaseName];
    this.manager.objects[qs.databaseConfig.NAME] =
      this.manager.objects[qs.databaseConfig.NAME] || [];
    return qs;
  }

  clone() {
    const qs = new (this.constructor as typeof QuerySet<T>)(this.modelClass);
    qs.modelClass = this.modelClass;
    qs.manager = this.manager;
    qs.query = this.query;
    qs.databaseConfig = this.databaseConfig;
    return qs;
  }

  private getDatabase() {
    const settings = globalThis.alexi.conf.settings;
    const databases = globalThis.alexi.conf.databases;

    if (!this.databaseConfig) {
      this.databaseConfig = settings.DATABASES.default;
    }

    const database = databases[this.databaseConfig.NAME];

    if (!database) {
      throw new Error(
        `Database engine not found for database: ${this.databaseConfig.NAME}`,
      );
    }

    return database;
  }

  private executeFilter = (instance: T) => {
    const results = [];

    for (const filter of this.query.where) {
      for (const key in filter) {
        const [fieldName, condition = 'eq'] = key.split('__');
        let param = filter[key];
        let value = instance[fieldName].value;
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

  private executeSort = (a: T, b: T) => {
    for (const field of this.query.ordering) {
      const direction = field.startsWith('-') ? -1 : 1;
      const fieldName = direction === -1 ? field.slice(1) : field;

      if (a[fieldName].get() < b[fieldName].get()) {
        return -1 * direction;
      }

      if (a[fieldName].get() > b[fieldName].get()) {
        return 1 * direction;
      }
    }

    return 0;
  };
}

export default QuerySet;
