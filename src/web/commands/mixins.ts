import { build } from 'esbuild';
import { denoPlugins } from '@luca/esbuild-deno-loader';
import { Constructor, dedupeMixin } from '@open-wc/dedupe-mixin';
import { BaseCommand } from '@alexi/web/base_command.ts';

const { STATIC_ROOT, STATICFILES } = globalThis.alexi.conf.settings;
const dev = Deno.env.get('MODE') === 'development';
const clients = new Set<WebSocket>();
let delayWatcher = false;

export const RunserverMixin = dedupeMixin(
  <T extends Constructor<BaseCommand>>(SuperClass: T) =>
    class RunserverMixin extends SuperClass {
      collectstatic() {}

      async runserver() {
        const options = { port: 3000, hostname: 'localhost' };
        console.info(
          `Starting server at http://${options.hostname}:${options.port}/`,
        );

        if (dev) {
          await this.collectstatic();
        }

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

            // Serve static ts files
            if (pathname.startsWith('/static/')) {
              const filePath = `${pathname.replace('/static/', './static/')}`;

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
          // Watch for file changes and notify clients
          const watcher = Deno.watchFs(STATICFILES);
          for await (const event of watcher) {
            if (event.kind === 'modify') {
              if (!delayWatcher) {
                delayWatcher = true;

                await this.collectstatic();

                // Prevent duplicate reloads
                setTimeout(() => {
                  delayWatcher = false;

                  for (const client of clients) {
                    client.send('reload');
                  }
                }, 0);
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

          await build({
            plugins: [...denoPlugins()],
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
        }

        console.info('Done.');
      }
    },
);
