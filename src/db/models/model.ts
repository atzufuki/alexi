import { ModelProps } from './types.ts';
import { DoesNotExist, MultipleObjectsReturned } from './errors.ts';
import { AutoField, Field } from './fields.ts';
import { Manager } from './manager.ts';

export abstract class Model<T extends Model<T>> {
  static DoesNotExist = DoesNotExist;
  static MultipleObjectsReturned = MultipleObjectsReturned;
  declare static objects: Manager<Model<any>>;
  static meta: {
    dbTable: string;
  } = {
    dbTable: 'default',
  };

  id: Field = new AutoField();

  constructor(public props?: ModelProps<T>) {
    this.init(props);
  }

  init(props?: this['props']) {
    if (props) {
      for (const key in this) {
        const field = this[key] as Field;
        const value = props[key as unknown as keyof this['props']];
        if (field instanceof Field && value !== undefined) {
          field.set(value);
          continue;
        }
      }
    }
  }

  clean() {
    // Implementation goes here
  }

  fullClean() {
    // Implementation goes here
  }

  serialize() {
    const props: { [key: string]: any } = {};

    for (const key in this) {
      const field = this[key] as Field;
      if (field instanceof Field && field.value !== undefined) {
        props[key] = field.value;
      }
    }

    return props;
  }

  getFields() {
    const fields: { [key: string]: Field } = {};

    for (const key in this) {
      const field = this[key] as Field;
      if (field instanceof Field) {
        fields[key] = field.get();
      }
    }

    return fields;
  }

  async save(): Promise<this> {
    const modelClass = this.constructor as typeof Model<T>;

    if (this.id.get()) {
      await modelClass.objects
        .filter({ id: this.id.get() })
        .update(this.serialize());

      return this;
    }

    const created = await modelClass.objects.create(this.serialize());

    this.id.set(created.id.get());

    return this;
  }

  async delete() {
    const modelClass = this.constructor as typeof Model<T>;
    await modelClass.objects.filter({ id: this.id.get() }).delete();
  }
}

export default Model;
