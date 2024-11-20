import { BaseCommand } from '@alexi/web/base_command.ts';
import { CollectStaticMixin } from '@alexi/web/commands/mixins.ts';

export default class Command extends CollectStaticMixin(BaseCommand) {
  help = 'Collects static files.';

  async handle() {
    await this.collectstatic();
  }
}
