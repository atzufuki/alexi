import { ArgumentParser, BaseCommand } from '@alexi/web/base_command';
import { CollectStaticMixin } from '@alexi/web/commands';
import { BuildMixin } from './mixins.ts';

export default class Command extends CollectStaticMixin(
  BuildMixin(
    BaseCommand,
  ),
) {
  help = 'Starts a local Firebase emulators';

  addArguments(parser: ArgumentParser): void {
    parser.addArgument({
      name: 'only',
      help: `
      only specific emulators. This is a comma       
      separated list of emulator names. Valid        
      options are:
      ["auth","functions","firestore","database","hosting","pubsub","storage","eventarc","dataconnect"]
      `,
    });
  }

  async handle(options: { only?: string }) {
    await this.build();

    const only = options.only ? ['--only', options.only] : [];

    const command = new Deno.Command('firebase', {
      args: [
        'emulators:start',
        '--import',
        '.firebase_export',
        ...only,
      ],
      env: { FORCE_COLOR: 'true' },
      stdin: 'inherit',
      stdout: 'inherit',
      stderr: 'inherit',
    });

    command.spawn();

    this.watchFunctions();
    this.watchHosting();
    this.runhmr();
  }
}
