import type { UrlPattern } from '@alexi/pwa/types.ts';
import type { View } from '@alexi/pwa/views.ts';

const routeMap: { [name: string]: any } = {};

export function path(
  path: string,
  view: View,
  name?: string,
) {
  const pattern = { path, view, name };
  if (name) {
    routeMap[name] = pattern;
    pattern.view.urlName = name;
  }
  return pattern;
}

export function include(
  basePath: string,
  patterns: UrlPattern[],
) {
  return patterns.map((pattern) => {
    routeMap[pattern.name] = { ...pattern, path: `${basePath}${pattern.path}` };
    return {
      ...pattern,
      path: `${basePath}${pattern.path}`,
    };
  });
}

export function reverse(
  name: string,
  params: { [key: string]: string | number } = {},
): UrlPattern {
  const pattern = routeMap[name];

  if (!pattern) {
    throw new Error(`No route found for name: ${name}`);
  }

  let url = '/' + pattern.path;

  for (const key in params) {
    url = url.replace(`:${key}`, params[key].toString());
  }

  return pattern;
}
