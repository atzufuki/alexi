import { AppSettings } from '@alexi/pwa/types.ts';
import { LocalRequest, LocalResponse } from '@alexi/pwa/views.ts';

export async function dispatch(
  url: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
) {
  const settings = globalThis.alexi.conf.settings as AppSettings;
  const urlpatterns = settings.ROOT_URLCONF;
  const request = new LocalRequest(url, method);

  const resolvedUrl = new URL(request.url, globalThis.location.origin);
  if (settings.APPEND_SLASH && !resolvedUrl.pathname.endsWith('/')) {
    resolvedUrl.pathname = resolvedUrl.pathname + '/';
  }
  request.url = `${resolvedUrl.pathname}${resolvedUrl.search}`;

  globalThis.history.pushState({}, '', request.url);

  for (const pattern of urlpatterns) {
    const url = resolvedUrl.pathname.startsWith('/')
      ? resolvedUrl.pathname.slice(1)
      : resolvedUrl.pathname;

    // Replace :param in the path with a regex that matches any sequence of characters except for a slash
    const regexPath = pattern.path.replace(/:\w+/g, '([^/]+)');
    const regex = new RegExp(`^${regexPath}/?$`);
    const match = url.match(regex);

    if (match) {
      // Create an object with the parameter names and values
      const paramNames = (pattern.path.match(/:\w+/g) || []).map((name) =>
        name.slice(1)
      );
      const params = paramNames.reduce((params, name, index) => {
        params[name] = match[index + 1];
        return params;
      }, {} as { [key: string]: string });

      request.params = params;

      return await pattern.view.dispatch(request);
    }
  }

  return new LocalResponse('404: Not Found', { status: 404 });
}
