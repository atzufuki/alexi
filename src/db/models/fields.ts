import { FieldOptions } from './types.ts';
import { Model } from './model.ts';
import { QuerySet } from './query.ts';

export class Field {
  primaryKey?: boolean;
  dbIndex?: boolean;
  null?: boolean;

  constructor(public options?: FieldOptions<Field>) {
    this.init(options);
  }

  init(options?: FieldOptions<ForeignKey<any>>) {
    if (options) {
      for (const key in options) {
        this[key] = options[key];
      }
    }
  }

  validate() {
    // Implementation goes here
  }

  runValidators() {
    // Implementation goes here
  }

  get() {
    return this.value;
  }

  set(value: Field['value']) {
    this.value = value;
  }

  declare value: any;
}

export class CharField extends Field {
  maxLength?: number;

  constructor(public options?: FieldOptions<CharField>) {
    super();
    this.init(options);
  }

  validate() {
    // Implementation goes here
  }

  runValidators() {
    // Implementation goes here
  }

  declare value: string;
}

export class IntegerField extends Field {
  constructor(public options?: FieldOptions<IntegerField>) {
    super();
    this.init(options);
  }

  get() {
    return this.value ?? 0;
  }

  declare value: number;
}

export class FloatField extends Field {
  constructor(public options?: FieldOptions<FloatField>) {
    super();
    this.init(options);
  }

  get() {
    return this.value ?? 0;
  }

  declare value: number;
}

export class ForeignKey<T extends Model<T>> extends Field {
  relatedModel: typeof Model<T>;
  relatedName?: string;
  declare value: any;
  onDelete?: 'CASCADE' | 'SET_NULL' | 'SET_DEFAULT' | 'RESTRICT' | 'NO_ACTION';

  constructor(
    relatedModel: typeof Model<T>,
    public options?: FieldOptions<ForeignKey<T>>,
  ) {
    super();
    this.init(options);
    this.relatedModel = relatedModel;
  }

  async validate() {
    if (typeof this.value === 'number') {
      const relatedObject = await this.relatedModel.objects.get({
        id: this.value,
      });
      if (!relatedObject) {
        throw new Error('Invalid foreign key');
      }
    } else if (typeof this.value === 'string') {
      const relatedObject = await this.relatedModel.objects.get({
        id: this.value,
      });
      if (!relatedObject) {
        throw new Error('Invalid foreign key');
      }
    } else if (!(this.value instanceof this.relatedModel)) {
      throw new Error('Invalid foreign key');
    }
  }

  get id() {
    return this.value;
  }

  get(): T | null {
    return this.relatedModel.objects
      .filter({ id: this.value })
      .first() as T | null;
  }

  set(value: number | string | T | null) {
    if (value instanceof this.relatedModel) {
      this.value = value.id.get();
    } else if (typeof value === 'number') {
      this.value = value;
    } else if (typeof value === 'string') {
      this.value = value;
    } else if (value === null) {
      this.value = value;
    } else {
      throw new Error('Invalid foreign key');
    }
  }
}

export class ManyToManyField<T extends Model<T>> extends Field {
  relatedModel: typeof Model<T>;
  relatedName?: string;
  value: any[] = [];
  onDelete?: 'CASCADE' | 'SET_NULL' | 'SET_DEFAULT' | 'RESTRICT' | 'NO_ACTION';

  constructor(
    relatedModel: typeof Model<T>,
    public options?: FieldOptions<ManyToManyField<T>>,
  ) {
    super();
    this.init(options);
    this.relatedModel = relatedModel;
  }

  async validate() {
    if (Array.isArray(this.value)) {
      for (const item of this.value) {
        if (typeof item === 'number') {
          const relatedObject = await this.relatedModel.objects.get({
            id: item,
          });
          if (!relatedObject) {
            throw new Error('Invalid foreign key');
          }
        } else if (typeof item === 'string') {
          const relatedObject = await this.relatedModel.objects.get({
            id: item,
          });
          if (!relatedObject) {
            throw new Error('Invalid foreign key');
          }
        } else if (!(item instanceof this.relatedModel)) {
          throw new Error('Invalid foreign key');
        }
      }
    } else {
      throw new Error('Invalid many-to-many field');
    }
  }

  get ids() {
    return this.value;
  }

  get(): QuerySet<T> {
    return this.relatedModel.objects.filter({
      id__in: this.value,
    }) as QuerySet<T>;
  }

  set(value: number[] | string[] | Model<T>[]) {
    if (Array.isArray(value)) {
      this.value = value.map((item) => {
        if (item instanceof this.relatedModel) {
          return item.id.get();
        } else if (typeof item === 'number') {
          return item;
        } else if (typeof item === 'string') {
          return item;
        } else {
          throw new Error('Invalid many-to-many field');
        }
      });
    } else {
      throw new Error('Invalid many-to-many field');
    }
  }

  add(value: number | string | Model<T>) {
    if (typeof value === 'number') {
      this.value.push(value);
    } else if (typeof value === 'string') {
      this.value.push(value);
    } else if (value instanceof this.relatedModel) {
      this.value.push(value.id.get());
    } else {
      throw new Error('Invalid many-to-many field');
    }
  }

  remove(value: number | string | Model<T>) {
    if (typeof value === 'number') {
      this.value = this.value.filter((item) => item !== value);
    } else if (typeof value === 'string') {
      this.value = this.value.filter((item) => item !== value);
    } else if (value instanceof this.relatedModel) {
      this.value = this.value.filter((item) => item !== value.id.get());
    } else {
      throw new Error('Invalid many-to-many field');
    }
  }
}

export class AutoField extends IntegerField {
  constructor(public options?: FieldOptions<AutoField>) {
    super();
    this.init(options);
    this.primaryKey = true;
  }
}

export class DateField extends Field {
  constructor(public options?: FieldOptions<DateField>) {
    super();
    this.init(options);
  }

  declare value: Date;

  get(): Date {
    return this.value;
  }

  set(value: Date | string | null) {
    if (typeof value === 'string') {
      this.value = new Date(value);
    } else if (value instanceof Date) {
      this.value = value;
    } else if (value === null) {
      this.value = value;
    } else {
      throw new Error('Invalid value for DateField.');
    }
  }
}

export default {
  Field,
  CharField,
  IntegerField,
  FloatField,
  ForeignKey,
  ManyToManyField,
  AutoField,
  DateField,
};
