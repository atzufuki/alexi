export abstract class AppConfig {
  name: string;
  models: object;
  getModels: () => Promise<object>;
  getTemplate: (
    templateName: string,
  ) => Promise<any>;
}
