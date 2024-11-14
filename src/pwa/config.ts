export abstract class AppConfig {
  name: string;
  models: object;
  getModels: () => Promise<object>;
  getTemplate: (
    appName: string,
    templateName: string,
    extension: string,
    context: Record<string, any>,
  ) => Promise<any>;
}
