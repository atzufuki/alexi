import { BaseCommand } from '@alexi/web/base_command.ts';
import { collectstatic } from '@alexi/web/server.ts';

export class Command extends BaseCommand {
  help = 'Collects static files.';

  async handle() {
    await collectstatic();
  }
}
