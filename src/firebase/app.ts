import { AppConfig } from './config.ts';

export class AlexiFirebaseApp extends AppConfig {
  name = 'alexi_firebase';

  get appDir(): string {
    const url = new URL(import.meta.url);
    return url.pathname.split('/').slice(1, -1).join('/');
  }

  getModels = async () => await import(`./models/model.ts`);
  getCommands = async () => {
    return {
      build: await import(`./commands/build.ts`),
      runemulators: await import(`./commands/runemulators.ts`),
    };
  };
}
