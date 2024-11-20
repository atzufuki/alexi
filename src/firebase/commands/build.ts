import { BaseCommand } from '@alexi/web/base_command';
import { CollectStaticMixin } from '@alexi/web/commands';
import { BuildMixin } from './mixins.ts';

export default class Command extends CollectStaticMixin(
  BuildMixin(
    BaseCommand,
  ),
) {
  help = 'Builds Firebase Functions bundle.';

  async handle() {
    await this.build();
  }
}
