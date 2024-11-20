export default class TemplateBackend {
  async getTemplate(templateName: string): Promise<any> {
    const apps = globalThis.alexi.conf.apps;

    for (const appName in apps) {
      const app = apps[appName];
      const [_, extension] = templateName.split('.');
      return async (context) => {
        switch (extension) {
          case 'ts': {
            return await app.getTemplate(
              templateName,
              context,
            );
          }
          case 'js': {
            return await app.getTemplate(
              templateName,
              context,
            );
          }
          case 'svg': {
            const template = await app.getTemplate(templateName, context);
            const div = document.createElement('div');
            div.innerHTML = template.default;
            return div.firstChild as HTMLElement;
          }
          default:
            throw new Error('Unsupported template extension.');
        }
      };
    }
  }
}
