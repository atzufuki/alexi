import type { View } from '@alexi/web/views.ts';
import type { BaseDatabaseBackend } from '@alexi/db/backends';

export type AsView = View;

export type UrlPattern = {
  path: string;
  view: View;
  name?: string;
};

export type AppSettings = {
  INSTALLED_APPS: any[];
  APPEND_SLASH: boolean;
  ROOT_URLCONF: UrlPattern[];
  [key: string]: any;
};

export interface DatabaseConfig {
  NAME: string;
  ENGINE: typeof BaseDatabaseBackend;
  [key: string]: any;
}

export interface Settings {
  INSTALLED_APPS: any[];
  DATABASES: {
    [key: string]: DatabaseConfig;
  };
}
