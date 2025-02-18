import { AppConfig } from '@alexi/web/config.ts';

export class AlexiWebApp extends AppConfig {
  name = 'alexi_web';

  get appDir() {
    const url = new URL(import.meta.url);
    return url.pathname.split('/').slice(1, -1).join('/');
  }

  getCommands = async () => {
    return {
      runserver: await import(`./commands/runserver.ts`),
      collectstatic: await import(`./commands/collectstatic.ts`),
    };
  };
}
