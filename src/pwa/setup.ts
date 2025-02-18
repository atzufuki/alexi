import { AppSettings } from '@alexi/pwa/types.ts';

export async function setup(settings: AppSettings) {
  globalThis.alexi = { conf: { settings: settings, apps: {}, databases: {} } };

  for (const AppConfig of settings.INSTALLED_APPS) {
    const app = new (AppConfig as any)();
    globalThis.alexi.conf.apps[app.name] = app;
    globalThis.alexi.conf.apps[app.name].models = await app.getModels?.();
  }

  for (const key in settings.DATABASES) {
    const databaseConfig = settings.DATABASES[key];
    const database = new databaseConfig.ENGINE(databaseConfig);
    await database.init();
    globalThis.alexi.conf.databases[databaseConfig.NAME] = database;
  }
}
