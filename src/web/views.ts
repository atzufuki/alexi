import TemplateBackend from '@alexi/web/templates.ts';
import { reverse } from '@alexi/web/urls.ts';

export class View {
  declare urlName: string;
  declare params: { [key: string]: string };

  static asView(options?: any) {
    return new this();
  }

  async dispatch(request: Request) {
    const pattern = reverse(this.urlName);
    const requestUrl = new URL(request.url);
    const patternParts = pattern.path.split('/').filter((part) => part !== '');
    const urlParts = requestUrl.pathname.split('/').filter((part) =>
      part !== ''
    );
    const matchedParts = urlParts.slice(0, patternParts.length);
    const path = matchedParts.join('/');
    const paramNames = (pattern.path.match(/:\w+/g) || []).map((name) =>
      name.slice(1)
    );
    const params = {};
    for (const name of paramNames) {
      const index = pattern.path.split('/').indexOf(`:${name}`);
      params[name] = path.split('/')[index];
    }
    this.params = params;

    switch (request.method) {
      case 'GET':
        return await this.get(request);
      case 'POST':
        return await this.post(request);
      case 'PUT':
        return await this.put(request);
      case 'PATCH':
        return await this.patch(request);
      case 'DELETE':
        return await this.delete(request);
      default:
        return new Response('', {
          status: 405,
        });
    }
  }

  async get(request: Request): Promise<object | null> {
    return new Response('', {
      status: 200,
    });
  }

  async post(request: Request): Promise<object | null> {
    return new Response('', {
      status: 200,
    });
  }

  async put(request: Request): Promise<object | null> {
    return new Response('', {
      status: 200,
    });
  }

  async patch(request: Request): Promise<object | null> {
    return new Response('', {
      status: 200,
    });
  }

  async delete(request: Request): Promise<object | null> {
    return new Response('', {
      status: 200,
    });
  }
}

export class TemplateView extends View {
  declare templateName: string;

  async getContextData(request: Request) {
    return {};
  }

  async renderToResponse(
    context: { [key: string]: any },
  ) {
    const render = await this.render(context);
    return new Response(render, {
      status: 200,
      headers: {
        'content-type': 'text/html',
      },
    });
  }

  async render(context: { [key: string]: any }) {
    const backend = new TemplateBackend();
    const template = await backend.getTemplate(this.templateName);
    return template(context);
  }
}
