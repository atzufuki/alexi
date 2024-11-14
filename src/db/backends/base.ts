import { CreateParams, GetParams, UpdateParams } from '@alexi/db/types.ts';
import { Model } from '@alexi/db/model.ts';
import { QuerySet } from '@alexi/db/query.ts';
import { DoesNotExist, MultipleObjectsReturned } from '@alexi/db/errors.ts';

export class BaseDatabaseBackend {
  declare db: any;

  async init(
    _databaseName: string,
    _version: number,
    _onUpgrade: (db: any) => void,
  ): Promise<this> {
    throw new Error('Not implemented');
  }

  docToData(modelClass: any, props: any) {
    return new modelClass(props);
  }

  serialize(instance: Model<any>) {
    return instance.serialize();
  }

  private _writeToMemory(qs: QuerySet<any>, instances: Model<any>[]) {
    const objects = qs.toArray();
    for (const instance of instances) {
      if (objects.length > 0) {
        const obj = objects.find((obj) => obj.id === instance.id.get());
        if (obj) {
          const index = qs.manager.objects[qs.databaseConfig.NAME].indexOf(obj);
          qs.manager.objects[qs.databaseConfig.NAME][index] = instance;
        } else {
          qs.manager.objects[qs.databaseConfig.NAME].push(instance);
        }
      } else {
        qs.manager.objects[qs.databaseConfig.NAME].push(instance);
      }
    }
  }

  private _removeFromMemory(qs: QuerySet<any>, instances: Model<any>[]) {
    const objects = qs.toArray();
    for (const instance of instances) {
      if (objects.length > 0) {
        const obj = objects.find((obj) => obj.id === instance.id.get());
        if (obj) {
          const index = qs.manager.objects[qs.databaseConfig.NAME].indexOf(obj);
          qs.manager.objects[qs.databaseConfig.NAME].splice(index, 1);
        }
      }
    }
  }

  _clearMemory(qs: QuerySet<any>) {
    qs.manager.objects[qs.databaseConfig.NAME] = [];
  }

  async _create(qs: QuerySet<any>, params: CreateParams): Promise<any> {
    const serialized = this.serialize(new qs.modelClass(params));

    const created = await this.create(qs, serialized);
    const instance = new qs.modelClass({
      ...params,
      ...created,
    });

    this._writeToMemory(qs, [instance]);

    return instance;
  }

  async _get(qs: QuerySet<any>, params: GetParams): Promise<any> {
    this._clearMemory(qs);

    const getted = await this.get(qs);

    if (getted.length === 0) {
      throw new DoesNotExist();
    }

    if (getted.length > 1) {
      throw new MultipleObjectsReturned();
    }

    const instance = new qs.modelClass(getted[0]);

    this._writeToMemory(qs, [instance]);

    return instance;
  }

  async _fetch(qs: QuerySet<any>): Promise<any[]> {
    this._clearMemory(qs);

    const fetched = await this.fetch(qs);

    const instances = fetched.map((props) => {
      return new qs.modelClass(props);
    });

    this._writeToMemory(qs, instances);

    return instances;
  }

  async _update(qs: QuerySet<any>, params: UpdateParams): Promise<any[]> {
    const serialized = this.serialize(new qs.modelClass(params));
    const updated = await this.update(qs, serialized);

    const instances = updated.map((updated) => {
      return new qs.modelClass({
        ...params,
        ...updated,
      });
    });

    this._writeToMemory(qs, instances);

    return instances;
  }

  async _delete(qs: QuerySet<any>): Promise<void> {
    await this.delete(qs);
    this._removeFromMemory(qs, qs.toArray());
  }

  async create(qs: QuerySet<any>, serialized: any): Promise<any> {
    throw new Error('Not implemented');
  }

  async get(qs: QuerySet<any>): Promise<any[]> {
    throw new Error('Not implemented');
  }

  async fetch(qs: QuerySet<any>): Promise<any[]> {
    throw new Error('Not implemented');
  }

  async update(qs: QuerySet<any>, serialized: any): Promise<any[]> {
    throw new Error('Not implemented');
  }

  async delete(qs: QuerySet<any>): Promise<void> {
    throw new Error('Not implemented');
  }
}

export default BaseDatabaseBackend;
