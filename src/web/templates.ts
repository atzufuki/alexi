import { existsSync } from '@std/fs';
import nunjucks from 'npm:nunjucks@3.2.4';

export default class TemplateBackend {
  templatesDirname = 'templates';

  async getTemplate(templateName: string): Promise<any> {
    const [templateDirName, fileName] = templateName.split('/');

    const apps = globalThis.alexi.conf.apps;
    for (const appName in apps) {
      const app = apps[appName];
      const [name, extension] = fileName.split('.');
      const importPath = `${app.appDir}/${this.templatesDirname}/${templateDirName}/${name}.${extension}`;

      if (!existsSync(importPath)) {
        continue;
      }

      return async (context) => {
        switch (extension) {
          // deno-lint-ignore no-case-declarations
          case 'html':
            const template = await Deno.readTextFile(importPath);
            return nunjucks.renderString(template, context);

          default:
            throw new Error('Unsupported template extension.');
        }
      };
    }
  }
}
