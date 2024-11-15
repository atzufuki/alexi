import BuildCommand from './build.ts';

export default class Command extends BuildCommand {
  help = 'Starts a local Firebase emulators';

  async handle() {
    await super.handle();

    const command = new Deno.Command('firebase', {
      args: [
        'emulators:start',
        '--only',
        'auth,functions,firestore,hosting,storage',
        '--import',
        '.firebase_export',
      ],
      env: { FORCE_COLOR: 'true' },
      stdout: 'piped',
      stderr: 'piped',
    });

    const process = command.spawn();
    const { stdout, stderr } = await process.output();

    const decoder = new TextDecoder();
    const outputStr = decoder.decode(stdout);
    const errorStr = decoder.decode(stderr);

    console.info(outputStr);
    console.error(errorStr);

    if (outputStr.includes('All emulators ready!')) {
      console.info('Quit the server with CONTROL-C.');
    }

    const status = await process.status;
    console.info(`Development server exited with code ${status.code}`);
  }
}
