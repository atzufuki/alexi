export async function execute() {
  const mode = Deno.env.get('MODE');
  const command = mode !== 'development' && !Deno.args[0]
    ? 'runserver'
    : Deno.args[0];
  const subcommand = Deno.args[1];
  const apps = globalThis.alexi.conf.apps;

  if (command) {
    if (subcommand === 'help') {
      for (const appName in apps) {
        const appConfig = apps[appName];
        if (appConfig.commands) {
          for (const commandName in appConfig.commands) {
            if (commandName === command) {
              const Command = appConfig.commands[commandName].default;
              const cmd = new Command();
              console.info(cmd.help);
              return;
            }
          }
        }
      }
    }

    for (const app in apps) {
      const appConfig = apps[app];
      if (appConfig.commands) {
        for (const commandName in appConfig.commands) {
          if (commandName === command) {
            const Command = appConfig.commands[commandName].default;
            const cmd = new Command();
            return await cmd.execute();
          }
        }
      }
    }
  } else {
    console.info(
      "Type 'npm run manage.ts help <subcommand>' for help on a specific subcommand.\n",
    );
    console.info('Available subcommands:\n');

    for (const appName in apps) {
      const appConfig = apps[appName];
      if (appConfig.commands) {
        console.info(`[${appName}]`);
        for (const commandName in appConfig.commands) {
          console.info(`  ${commandName}`);
        }
        console.info('');
      }
    }
  }
}
