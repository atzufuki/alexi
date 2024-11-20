import TemplateBackend from '@alexi/pwa/templates.ts';
import { reverse } from '@alexi/pwa/urls.ts';

export class LocalRequest {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  params: { [key: string]: string };

  json() {}

  constructor(
    url: string,
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  ) {
    this.url = url;
    this.method = method;
  }
}

export class LocalResponse {
  body: string | HTMLElement;
  status: number;
  headers: { [key: string]: string };

  constructor(
    body: string | HTMLElement,
    options: { status: number; headers?: { [key: string]: string } },
  ) {
    this.body = body;
    this.status = options.status;
    this.headers = options.headers || {};
  }
}

export class View {
  declare urlName: string;
  declare params: { [key: string]: string };

  static asView(options?: any) {
    return new this();
  }

  async dispatch(request: LocalRequest) {
    const pattern = reverse(this.urlName);
    const requestUrl = new URL(location.origin + request.url);
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

    let context: { [key: string]: any } = {};

    switch (request.method) {
      case 'GET':
        context = await this.get(request);
        break;
      case 'POST':
        context = await this.post(request);
        break;
      case 'PUT':
        context = await this.put(request);
        break;
      case 'PATCH':
        context = await this.patch(request);
        break;
      case 'DELETE':
        context = await this.delete(request);
        break;
      default:
        throw new Error('Method not allowed');
    }

    return await this.renderToResponse(context);
  }

  async getContextData(request: LocalRequest) {
    return {};
  }

  async get(request: LocalRequest): Promise<object | null> {
    return await this.getContextData(request);
  }

  async post(request: LocalRequest): Promise<object | null> {
    return await this.getContextData(request);
  }

  async put(request: LocalRequest): Promise<object | null> {
    return await this.getContextData(request);
  }

  async patch(request: LocalRequest): Promise<object | null> {
    return await this.getContextData(request);
  }

  async delete(request: LocalRequest): Promise<object | null> {
    return await this.getContextData(request);
  }

  async renderToResponse(
    context: { [key: string]: any },
  ) {
    const render = JSON.stringify(context);
    return new LocalResponse(render, {
      status: 200,
    });
  }
}

export class TemplateView extends View {
  declare templateName: string;

  async renderToResponse(
    context: { [key: string]: any },
  ) {
    const root = document.querySelector('#root');
    const render = await this.render(context);

    root.replaceChildren(render);

    return new LocalResponse(render, {
      status: 200,
      headers: {
        'content-type': 'text/html',
      },
    });
  }

  async render(context: { [key: string]: any }): Promise<string | HTMLElement> {
    const backend = new TemplateBackend();
    const template = await backend.getTemplate(this.templateName);
    return await template(context);
  }
}
