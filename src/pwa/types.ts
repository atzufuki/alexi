import type { View } from '@alexi/pwa/views.ts';

export type AsView = View;

export type UrlPattern = {
  path: string;
  view: View;
  name?: string;
};

export type AppSettings = {
  INSTALLED_APPS: any[];
  APPEND_SLASH: boolean;
  ROOT_URLCONF: UrlPattern[];
  [key: string]: any;
};
