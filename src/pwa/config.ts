export abstract class AppConfig {
  name: string | undefined;
  models: object | undefined;
  getModels: (() => Promise<object>) | undefined;
}
