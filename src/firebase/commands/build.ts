import { build } from 'esbuild';
import { denoPlugins } from '@luca/esbuild-deno-loader';
import { BaseCommand } from '@alexi/web/base_command';

export default class Command extends BaseCommand {
  help = 'Builds Firebase Functions bundle.';

  async handle() {
    console.info('Building functions...');

    const settings = globalThis.alexi.conf.settings;

    // Filter and define environment variables with prefix "SECRET_"
    const envVariables = Object.keys(Deno.env.toObject())
      .filter((key) => key.startsWith('SECRET_'))
      .reduce((acc, key) => {
        acc[`process.env.${key}`] = JSON.stringify(Deno.env.get(key));
        return acc;
      }, {});

    await build({
      plugins: [...denoPlugins()],
      entryPoints: [
        './project/functions.ts',
      ],
      outfile: 'dist/functions.js',
      bundle: true,
      splitting: false,
      outExtension: { '.js': '.ts' },
      allowOverwrite: true,
      write: true,
      format: 'esm',
      platform: 'node',
      target: 'esnext',
      define: envVariables,
      external: settings.FIREBASE.EXTERNAL,
      banner: {
        js:
          "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
      },
    });

    console.info('Done.');
  }
}
