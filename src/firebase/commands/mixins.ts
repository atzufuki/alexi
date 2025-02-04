import { build } from 'esbuild';
import { denoPlugins } from '@luca/esbuild-deno-loader';
import { Constructor, dedupeMixin } from '@open-wc/dedupe-mixin';
import { BaseCommand } from '@alexi/web/base_command';

const { STATIC_ROOT, FIREBASE } = globalThis.alexi.conf.settings;
const dev = Deno.env.get('MODE') === 'development';
const clients = new Set<WebSocket>();
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
          entryPoints: settings.FIREBASE.FUNCTIONS.ENTRYPOINTS ?? [],
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
          const filePaths = FIREBASE.HOSTING.COPY_PATHS.filter((path) => {
            return path.split('static/')[1].startsWith(appName);
          });

          for (const filePath of filePaths) {
            const destination = `${STATIC_ROOT}/${
              filePath.split('static/')[1]
            }`;

            const entryInfo = await Deno.stat(filePath);
            if (entryInfo.isFile) {
              await Deno.copyFile(filePath, destination);
            } else if (entryInfo.isDirectory) {
              await this.copyDirectory(filePath, destination);
            }
          }
        }

        console.info('Done.');
      }

      async copyDirectory(src: string, dest: string) {
        await Deno.mkdir(dest, { recursive: true });
        for await (const entry of Deno.readDir(src)) {
          const srcPath = `${src}/${entry.name}`;
          const destPath = `${dest}/${entry.name}`;
          if (entry.isFile) {
            await Deno.copyFile(srcPath, destPath);
          } else if (entry.isDirectory) {
            await this.copyDirectory(srcPath, destPath);
          }
        }
      }

      async watchFunctions() {
        const settings = globalThis.alexi.conf.settings;
        const watchPaths = settings.FIREBASE.FUNCTIONS.WATCH_PATHS ?? [];
        const watcher = Deno.watchFs(watchPaths);
        for await (const event of watcher) {
          if (event.kind === 'modify') {
            if (!delayWatcher) {
              delayWatcher = true;

              await this.buildFunctions();

              // Prevent duplicate reloads
              const timeout = setTimeout(() => {
                delayWatcher = false;
              }, 0);
              clearTimeout(timeout);
            }
          }
        }
      }

      async watchHosting() {
        const settings = globalThis.alexi.conf.settings;
        const watchPaths = settings.FIREBASE.HOSTING.WATCH_PATHS ?? [];
        const watcher = Deno.watchFs(watchPaths);
        for await (const event of watcher) {
          if (event.kind === 'modify') {
            if (!delayWatcher) {
              delayWatcher = true;

              await this.buildSites();

              // Prevent duplicate reloads
              const timeout = setTimeout(() => {
                delayWatcher = false;

                for (const client of clients) {
                  client.send('reload');
                  client.close();
                }
              }, 0);
              clearTimeout(timeout);
            }
          }
        }
      }

      async runhmr() {
        const options = {
          port: 3000,
          hostname: 'localhost',
        };
        Deno.serve(
          options,
          async (request: Request) => {
            const requestURL = new URL(request.url);
            const pathname = requestURL.pathname;

            if (dev) {
              // Handle WebSocket connections for HMR
              if (pathname === '/hmr') {
                const { response, socket } = Deno.upgradeWebSocket(request);
                socket.onopen = () => clients.add(socket);
                socket.onclose = () => clients.delete(socket);
                return response;
              }
            }

            return new Response('404: Not Found', { status: 404 });
          },
        );
      }
    },
);
