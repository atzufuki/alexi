import { BaseCommand } from '@alexi/web/base_command';
import { CollectStaticMixin } from '@alexi/web/commands';
import { BuildMixin } from './mixins.ts';

export default class Command extends CollectStaticMixin(
  BuildMixin(
    BaseCommand,
  ),
) {
  help = 'Starts a local Firebase emulators';

  async handle() {
    await this.build();

    const command = new Deno.Command('firebase', {
      args: [
        'emulators:start',
        '--import',
        '.firebase_export',
      ],
      env: { FORCE_COLOR: 'true' },
      stdin: 'inherit',
      stdout: 'inherit',
      stderr: 'inherit',
    });

    command.spawn();

    this.startWatcher();
  }
}
