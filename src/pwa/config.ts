export abstract class AppConfig {
  name: string;
  models: object;
  getModels: () => Promise<object>;
  getTemplate: (
    templateName: string,
    context: Record<string, any>,
  ) => Promise<any>;
}
