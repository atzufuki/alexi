export default class TemplateBackend {
  async getTemplate(templateName: string): Promise<any> {
    const apps = globalThis.alexi.conf.apps;
    const [templateDirName, fileName] = templateName.split('/');

    for (const appName in apps) {
      const app = apps[appName];
      const [name, extension] = fileName.split('.');
      return async (context) => {
        switch (extension) {
          case 'ts': {
            return await app.getTemplate(
              templateDirName,
              name,
              extension,
              context,
            );
          }
          case 'js': {
            return await app.getTemplate(
              templateDirName,
              name,
              extension,
              context,
            );
          }
          default:
            throw new Error('Unsupported template extension.');
        }
      };
    }
  }
}
