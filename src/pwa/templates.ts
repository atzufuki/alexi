export default class TemplateBackend {
  templatesDirname = 'templates';

  async getTemplate(templateName: string): Promise<any> {
    const apps = globalThis.alexi.conf.apps;
    const [templateDirName, fileName] = templateName.split('/');

    for (const appName in apps) {
      const [name, extension] = fileName.split('.');
      const importPath =
        `/static/${appName}/static/${appName}/${this.templatesDirname}/${templateDirName}/${name}.${extension}`;
      return async (context) => {
        switch (extension) {
          case 'ts': {
            const template = await import(importPath);
            return new template.default(context);
          }
          case 'js': {
            const template = await import(importPath);
            return new template.default(context);
          }
          default:
            throw new Error('Unsupported template extension.');
        }
      };
    }
  }
}
