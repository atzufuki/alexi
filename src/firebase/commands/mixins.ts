import { build } from 'esbuild';
import { denoPlugins } from '@luca/esbuild-deno-loader';
import { Constructor, dedupeMixin } from '@open-wc/dedupe-mixin';
import { BaseCommand } from '@alexi/web/base_command';

const { STATIC_ROOT, FIREBASE } = globalThis.alexi.conf.settings;
let delayWatcher = false;

export const BuildMixin = dedupeMixin(
  <T extends Constructor<BaseCommand>>(SuperClass: T) =>
    class BuildMixin extends SuperClass {
      async build() {
        await this.buildFunctions();
        await this.buildSites();
      }

      async buildFunctions() {
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
          entryPoints: settings.FIREBASE.ENTRY_POINTS ?? [],
          outfile: settings.FIREBASE.OUTFILE,
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

      async collectstatic() {}

      async buildSites() {
        console.info('Building sites...');

        await this.collectstatic();

        const apps = globalThis.alexi.conf.apps;

        for (const appName in apps) {
          const entryPoints = FIREBASE.HOSTING.ENTRYPOINTS.filter((path) => {
            return path.split('static/')[1].startsWith(appName);
          });

          for (const entryPoint of entryPoints) {
            const destination = `${STATIC_ROOT}/${
              entryPoint.split('static/')[1]
            }`;
            await Deno.copyFile(entryPoint, destination);
          }
        }

        console.info('Done.');
      }

      async startWatcher() {
        const watchFiles = [
          './src/',
        ];
        const watcher = Deno.watchFs(watchFiles);
        for await (const event of watcher) {
          if (event.kind === 'modify') {
            if (!delayWatcher) {
              delayWatcher = true;

              await this.build();

              // Prevent duplicate reloads
              setTimeout(() => {
                delayWatcher = false;
              }, 0);
            }
          }
        }
      }
    },
);
