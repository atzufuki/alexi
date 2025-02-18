import type { View } from '@alexi/pwa/views.ts';

export type AsView = View;

export type UrlPattern = {
  path: string;
  view: View;
  name?: string;
};

export type BaseDatabaseBackend = new (databaseConfig: DatabaseConfig) => any;

export interface DatabaseConfig {
  NAME: string;
  ENGINE: BaseDatabaseBackend;
  [key: string]: any;
}

export type AppSettings = {
  INSTALLED_APPS?: any[];
  APPEND_SLASH?: boolean;
  ROOT_URLCONF?: UrlPattern[];
  DATABASES?: {
    [key: string]: DatabaseConfig;
  };
  [key: string]: any;
};
