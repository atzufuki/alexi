import {
  CreateParams,
  DATABASE,
  ExcludeParams,
  FilterParams,
  GetOrCreateParams,
  GetParams,
  ModelClass,
  OrderByParams,
  QuerySetClass,
  UpdateOrCreateParams,
} from './types.ts';

import { Model } from './model.ts';
import { QuerySet } from './query.ts';

export class Manager<T extends Model<T>> {
  objects: {
    default: T[];
    [key: string]: T[];
  } = {
    default: [],
  };
  modelClass: ModelClass<T>;
  databaseConfig: DATABASE;
  querysetClass: QuerySetClass<T> = QuerySet;

  constructor(modelClass: ModelClass<T>, querysetClass?: QuerySetClass<T>) {
    this.modelClass = modelClass;

    if (querysetClass) {
      this.querysetClass = querysetClass;
    }
  }

  getQuerySet() {
    const settings = globalThis.alexi.conf.settings;
    this.databaseConfig = settings.DATABASES.default;

    for (const key in this.objects) {
      this.objects[key] = [];
    }

    if (!this.objects[this.databaseConfig.NAME]) {
      this.objects[this.databaseConfig.NAME] = [];
    }

    const qs = new this.querysetClass(this.modelClass);

    if (this.databaseConfig.ENGINE) {
      qs.databaseConfig = this.databaseConfig;
    }

    return qs;
  }

  async get(query: GetParams): Promise<T> {
    return await this.getQuerySet().get(query);
  }

  async create(data: CreateParams): Promise<T> {
    return await this.getQuerySet().create(data);
  }

  async updateOrCreate(params: UpdateOrCreateParams) {
    return await this.getQuerySet().updateOrCreate(params);
  }

  async getOrCreate(params: GetOrCreateParams) {
    return await this.getQuerySet().getOrCreate(params);
  }

  async count(): Promise<number> {
    return await this.getQuerySet().count();
  }

  all() {
    return this.getQuerySet().all();
  }

  filter(params: FilterParams) {
    return this.getQuerySet().filter(params);
  }

  exclude(params: ExcludeParams) {
    return this.getQuerySet().exclude(params);
  }

  orderBy(...params: OrderByParams<T>) {
    return this.getQuerySet().orderBy(...params);
  }

  using(databaseName: string) {
    return this.getQuerySet().using(databaseName);
  }

  dbManager(databaseName: string) {
    const manager = this.clone();

    const settings = globalThis.alexi.conf.settings;
    manager.databaseConfig = settings.DATABASES[databaseName];

    if (!manager.databaseConfig) {
      throw new Error(`Database ${databaseName} not found in settings`);
    }

    if (
      !this.objects[manager.databaseConfig.NAME]
    ) {
      this.objects[manager.databaseConfig.NAME] = [];
    }

    return manager;
  }

  private clone() {
    return new (this.constructor as typeof Manager<T>)(this.modelClass);
  }
}

export default Manager;
