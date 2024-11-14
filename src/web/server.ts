import { build } from 'esbuild';

const STATIC_ROOT = './static';
const STATICFILES_DIRS = [
  './project',
  './src',
];
const dev = Deno.env.get('MODE') === 'development';
const clients = new Set<WebSocket>();
let delayWatcher = false;

export async function runserver() {
  const options = { port: 3000, hostname: 'localhost' };
  console.info(
    `Starting server at http://${options.hostname}:${options.port}/`,
  );

  if (dev) {
    await collectstatic();
    await bundle();
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
        const url = pathname.startsWith('/') ? pathname.slice(1) : pathname;
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
    const watcher = Deno.watchFs(STATICFILES_DIRS);
    for await (const event of watcher) {
      if (event.kind === 'modify') {
        if (!delayWatcher) {
          delayWatcher = true;

          await collectstatic();
          await bundle();

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

async function copyFile(
  srcPath: string,
  destPath: string,
  destDir: string,
) {
  await Deno.mkdir(destDir, { recursive: true });
  await Deno.copyFile(srcPath, destPath);
}

async function copyRecursively(srcDir: string, destDir: string) {
  for await (const entry of Deno.readDir(srcDir)) {
    const srcPath = `${srcDir}/${entry.name}`;
    const destPath = `${destDir}/${entry.name}`;

    if (entry.isFile) {
      await copyFile(srcPath, destPath, destDir);
    } else if (entry.isDirectory) {
      await copyRecursively(srcPath, destPath);
    }
  }
}

export async function collectstatic() {
  console.info('Collecting static files...');

  for (const dir of STATICFILES_DIRS) {
    await copyRecursively(dir, STATIC_ROOT);
  }

  console.info('Done.');
}

// Bundle
const files = [];
async function findFiles(srcDir: string) {
  for await (const entry of Deno.readDir(srcDir)) {
    const srcPath = `${srcDir}/${entry.name}`;

    if (entry.isFile && srcPath.endsWith('.ts')) {
      files.push(srcPath);
      continue;
    } else if (entry.isDirectory) {
      await findFiles(srcPath);
      continue;
    }
  }

  return null;
}

export async function bundle() {
  console.info('Bundling...');

  await findFiles(STATIC_ROOT);
  await build({
    entryPoints: files,
    bundle: false,
    outExtension: { '.js': '.ts' },
    allowOverwrite: true,
    write: true,
    format: 'esm',
    platform: 'browser',
    outdir: STATIC_ROOT,
    target: 'esnext',
  });

  console.info('Done.');
}
