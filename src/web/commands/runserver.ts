import { BaseCommand } from '@alexi/web/base_command.ts';
import { RunserverMixin } from '@alexi/web/commands/mixins.ts';
import { CollectStaticMixin } from '@alexi/web/commands/mixins.ts';

export default class Command extends CollectStaticMixin(
  RunserverMixin(
    BaseCommand,
  ),
) {
  help = 'Starts a lightweight web server.';

  async handle() {
    const dev = Deno.env.get('MODE') === 'development';
    if (dev) {
      await this.collectstatic();
    }
    await this.runserver();
  }
}
