import { AppConfig as WebAppConfig } from '@alexi/web/config';

export abstract class AppConfig extends WebAppConfig {
  functions: object | undefined;
  getFunctions: (() => Promise<object>) | undefined;
}
