import svg from 'esbuild-plugin-svg';
import chokidar from 'chokidar';
import { build } from 'esbuild';
import { denoPlugins } from '@luca/esbuild-deno-loader';
import { Constructor, dedupeMixin } from '@open-wc/dedupe-mixin';
import { BaseCommand } from '@alexi/web/base_command.ts';

const { STATIC_ROOT, STATICFILES, WATCHFILES_DIRS, WATCHER_USE_POLLING } =
  globalThis.alexi.conf.settings;
const dev = Deno.env.get('MODE') === 'development';

export const RunserverMixin = dedupeMixin(
  <T extends Constructor<BaseCommand>>(SuperClass: T) =>
    class RunserverMixin extends SuperClass {
      ac: AbortController;
      clients = new Set<WebSocket>();

      collectstatic() {}

      async runserver() {
        this.ac = new AbortController();
        const args = Deno.args.slice(1);
        const [hostname, port] = args?.[0]?.split(':') ?? [];
        const options = {
          signal: this.ac.signal,
          port: parseInt(port ?? '3000'),
          hostname: hostname ?? 'localhost',
        };
        console.info(
          `Starting server at http://${options.hostname}:${options.port}/`,
        );

        Deno.serve(
          options,
          async (request: Request) => {
            const requestURL = new URL(request.url);
            const pathname = requestURL.pathname;

            if (dev) {
              // Handle WebSocket connections for HMR
              if (pathname === '/hmr') {
                const { response, socket } = Deno.upgradeWebSocket(request);
                socket.onopen = () => this.clients.add(socket);
                socket.onclose = () => this.clients.delete(socket);
                return response;
              }
            }

            // Serve static ts files
            if (pathname.startsWith('/static/')) {
              const filePath = `${pathname.replace('/static/', STATIC_ROOT)}`;

              if (
                filePath.endsWith('.ts') || filePath.endsWith('.js')
              ) {
                const code = await Deno.readTextFile(filePath);
                return new Response(code, {
                  headers: { 'Content-Type': 'application/javascript' },
                });
              } else if (filePath.endsWith('.json')) {
                const code = await Deno.readTextFile(filePath);
                return new Response(code, {
                  headers: { 'Content-Type': 'application/json' },
                });
              }
            }

            const settings = globalThis.alexi.conf.settings;
            const urlpatterns = settings.ROOT_URLCONF;
            for (const pattern of urlpatterns) {
              const url = pathname.startsWith('/')
                ? pathname.slice(1)
                : pathname;
              const regexPath = pattern.path.replace(/:\w+/g, '([^/]+)');
              const regex = new RegExp(`^${regexPath}/?$`);
              const match = url.match(regex);

              if (match) {
                return await pattern.view.dispatch(request);
              }
            }

            return new Response('404: Not Found', { status: 404 });
          },
        );

        console.info('Quit the server with CONTROL-C.');

        if (dev) {
          this._watch();
        }
      }

      async _watch() {
        if (WATCHER_USE_POLLING) {
          const watcher = chokidar.watch(WATCHFILES_DIRS, {
            ignored: /(^|[\/\\])\../,
            persistent: true,
            usePolling: true,
          });

          watcher.on('change', async () => {
            this.ac.abort();
            watcher.close();

            await this.collectstatic();
            await this.runserver();

            for (const client of this.clients) {
              client.send('reload');
            }
          });
        } else {
          const watcher = Deno.watchFs(WATCHFILES_DIRS, {
            recursive: true,
          });

          for await (const event of watcher) {
            if (event.kind === 'modify') {
              watcher.close();
              this.ac.abort();

              await this.collectstatic();
              await this.runserver();

              for (const client of this.clients) {
                client.send('reload');
              }
            }
          }
        }
      }
    },
);

export const CollectStaticMixin = dedupeMixin(
  <T extends Constructor<BaseCommand>>(SuperClass: T) =>
    class CollectStaticMixin extends SuperClass {
      async collectstatic() {
        console.info('Collecting static files...');

        const apps = globalThis.alexi.conf.apps;

        // Filter and define environment variables with prefix "SITE_"
        const envVariables = Object.keys(Deno.env.toObject())
          .filter((key) => key.startsWith('SITE_'))
          .reduce((acc, key) => {
            acc[`import.meta.env.${key}`] = JSON.stringify(Deno.env.get(key));
            return acc;
          }, {});

        for (const appName in apps) {
          const entryPoints = STATICFILES.filter((path) => {
            return path.split('static/')[1].startsWith(appName);
          });
          try {
            await build({
              plugins: [svg(), ...denoPlugins()],
              entryPoints: entryPoints,
              outdir: `${STATIC_ROOT}/${appName}`,
              bundle: true,
              splitting: true,
              outExtension: { '.js': '.js' },
              allowOverwrite: true,
              write: true,
              format: 'esm',
              platform: 'browser',
              target: 'esnext',
              define: envVariables,
            });
          } catch (error) {
            if (error.message.includes('Not an ESM module')) {
              console.warn(
                `Failed to bundle ${appName} because it contains an entry point that is not an ESM module.`,
              );
              continue;
            }

            if (error.message.includes('Module not found')) {
              console.warn(
                `Failed to bundle ${appName} because it contains an entry point that is not found.`,
              );
              continue;
            }

            throw error;
          }
        }

        console.info('Done.');
      }
    },
);
