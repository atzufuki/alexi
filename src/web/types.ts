import type { View } from '@alexi/web/views.ts';

export type BaseDatabaseBackend = new (databaseConfig: DatabaseConfig) => any;

export type AsView = View;

export type UrlPattern = {
  path: string;
  view: View;
  name?: string;
};

export interface DatabaseConfig {
  NAME: string;
  ENGINE: BaseDatabaseBackend;
  [key: string]: any;
}

export interface AppSettings {
  INSTALLED_APPS?: any[];
  APPEND_SLASH?: boolean;
  ROOT_URLCONF?: UrlPattern[];
  DATABASES?: {
    [key: string]: DatabaseConfig;
  };
  [key: string]: any;
}
