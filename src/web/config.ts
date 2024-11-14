export abstract class AppConfig {
  name: string | undefined;
  models: object | undefined;
  getModels: (() => Promise<object>) | undefined;
  commands: object | undefined;
  getCommands: (() => Promise<object>) | undefined;
}
