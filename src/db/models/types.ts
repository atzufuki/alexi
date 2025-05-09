import type { Manager } from './manager.ts';
import type { Model } from './model.ts';
import type { Field } from './fields.ts';
import type { QuerySet } from './query.ts';
import type { BaseDatabaseBackend } from '../backends/base.ts';
import type { Index } from './index.ts';

export type DATABASE = {
  NAME: string;
  ENGINE: typeof BaseDatabaseBackend;
};

export type DATABASES = {
  default: DATABASE;
  [key: string]: DATABASE;
};

type FieldValue<F> = F extends Field ? F['value'] : never;

type AllProps<T extends Model<T>> = {
  [K in keyof T]: FieldValue<T[K]>;
};

export type ModelProps<T extends Model<T>> = Partial<
  Omit<
    AllProps<T>,
    | 'objects'
    | 'save'
    | 'delete'
    | 'serialize'
    | 'init'
    | 'clean'
    | 'fullClean'
    | 'props'
  >
>;

type AllOptions<T> = {
  [K in keyof T]: T[K];
};

export type FieldOptions<T> = Partial<
  Omit<
    AllOptions<T>,
    'init' | 'validate' | 'runValidators' | 'get' | 'set' | 'value'
  >
>;

type QueryEq<T extends Model<T>> = {
  [P in keyof ModelProps<T> as P & string]?: ModelProps<T>[P];
};

type QueryIn<T extends Model<T>> = {
  [P in keyof ModelProps<T> as `${P & string}__in`]?: ModelProps<T>[P][];
};

export type FilterProps<T extends Model<T>> = QueryEq<T> & QueryIn<T>;

export interface ModelClass<T extends Model<T>> {
  new (data: ModelProps<T>): T;
  objects: Manager<T>;
  meta: {
    dbTable: string;
    indexes?: Index[];
  };
}
export type QuerySetClass<T extends Model<T>> = typeof QuerySet<T>;

export type ExecuteAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'list'
  | 'get'
  | 'count'
  | 'exists'
  | 'clear';

export interface GetOrCreateParams {
  [key: string]: any;
  defaults: {
    [key: string]: any;
  };
}

export interface UpdateOrCreateParams {
  [key: string]: any;
  defaults: {
    [key: string]: any;
  };
  createDefaults?: {
    [key: string]: any;
  };
}

export interface GetParams {
  [key: string]: any;
}

export interface CreateParams {
  [key: string]: any;
}

export interface UpdateParams {
  [key: string]: any;
}

export interface FilterParams {
  [key: string]: any;
}

export interface ExcludeParams {
  [key: string]: any;
}

export type OrderByParams<T extends Model<T>> = (
  | keyof ModelProps<T>
  | `-${keyof ModelProps<T> & string}`
)[];

export type UpdateOrCreateResponse<T extends Model<T>> = Promise<[T, boolean]>;

export type GetOrCreateResponse<T extends Model<T>> = Promise<[T, boolean]>;
