export default class TemplateBackend {
  async getTemplate(templateName: string): Promise<any> {
    const apps = globalThis.alexi.conf.apps;

    for (const appName in apps) {
      const app = apps[appName];
      const [_, extension] = templateName.split('.');

      return async (context) => {
        switch (extension) {
          case 'ts': {
            const template = await app.getTemplate(templateName);
            return new template.default(context);
          }
          case 'js': {
            const template = await app.getTemplate(templateName);
            return new template.default(context);
          }
          case 'svg': {
            const template = await app.getTemplate(templateName);
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
