export type BaseDatabaseBackend = new (databaseConfig: DatabaseConfig) => any;

export interface DatabaseConfig {
  NAME: string;
  ENGINE: BaseDatabaseBackend;
  [key: string]: any;
}

export interface AppSettings {
  INSTALLED_APPS?: any[];
  APPEND_SLASH?: boolean;
  DATABASES?: {
    [key: string]: DatabaseConfig;
  };
  [key: string]: any;
}
