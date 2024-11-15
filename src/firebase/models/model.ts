import type { ModelProps } from '@alexi/db/models';
import { CharField, DateField, Manager, Model } from '@alexi/db/models';

export abstract class BaseModel<T extends BaseModel<T>> extends Model<T> {
  id = new CharField();
  createdAt = new DateField();
  updatedAt = new DateField();

  constructor(props?: ModelProps<T>) {
    super(props);
    this.init(props);
  }
}

export class User extends BaseModel<User> {
  name = new CharField();
  email = new CharField();
  phone = new CharField();
  picture = new CharField();

  constructor(props?: ModelProps<User>) {
    super();
    this.init(props);
  }

  static objects: Manager<User> = new Manager<User>(User);
  static meta = {
    dbTable: 'users',
  };
}
