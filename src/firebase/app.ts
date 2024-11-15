import { AppConfig } from '@alexi/web/config';

export class AlexiFirebaseApp extends AppConfig {
  name = 'alexi_firebase';
  getModels = async () => await import(`./models/model.ts`);
  getCommands = async () => {
    return {
      build: await import(`./commands/build.ts`),
      runemulators: await import(`./commands/runemulators.ts`),
    };
  };
}
