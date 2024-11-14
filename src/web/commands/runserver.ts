import { BaseCommand } from '@alexi/web/base_command.ts';
import { runserver } from '@alexi/web/server.ts';

export class Command extends BaseCommand {
  help = 'Starts a lightweight web server.';

  async handle() {
    await runserver();
  }
}
