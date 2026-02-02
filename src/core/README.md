# @alexi/core

Django-tyylinen management commands -järjestelmä Denolle.

Tarjoaa CLI-kehyksen, jolla voit luoda ja ajaa hallintakomentoja projektissasi, samaan tapaan kuin
Djangon `manage.py`.

## Asennus

Moduuli on osa Alexi-ekosysteemiä. Importtaa se käyttämällä:

```typescript
import { BaseCommand, ManagementUtility } from "@alexi/core";
```

## Peruskäyttö

### manage.ts luominen

Luo projektin juureen `manage.ts` tiedosto:

```typescript
// manage.ts
import { ManagementUtility } from "@alexi/core";

const cli = new ManagementUtility();

// Aja CLI
const exitCode = await cli.execute(Deno.args);
Deno.exit(exitCode);
```

### Komentojen ajaminen

```bash
# Näytä käytettävissä olevat komennot
deno run -A manage.ts

# Näytä ohje
deno run -A manage.ts help

# Näytä tietyn komennon ohje
deno run -A manage.ts help runserver

# Käynnistä kehityspalvelin
deno run -A manage.ts runserver --port 3000
```

## Sisäänrakennetut komennot

### help

Näyttää käytettävissä olevat komennot tai tietyn komennon ohjeet.

```bash
deno run -A manage.ts help
deno run -A manage.ts help <komento>
```

### runserver

Käynnistää kehityspalvelimen. Vaatii server factoryn asettamisen.

```bash
deno run -A manage.ts runserver
deno run -A manage.ts runserver --port 8080
deno run -A manage.ts runserver --host 127.0.0.1 --port 3000
```

Argumentit:

- `--port, -p` - Portti (oletus: 8000)
- `--host, -H` - Osoite (oletus: 0.0.0.0)
- `--no-reload` - Poista automaattinen uudelleenlataus käytöstä

## Oman komennon luominen

### Perusesimerkki

```typescript
import { BaseCommand, failure, success } from "@alexi/core";
import type { CommandOptions, CommandResult, IArgumentParser } from "@alexi/core";

class GreetCommand extends BaseCommand {
  // Komennon nimi (mitä käyttäjä kirjoittaa)
  readonly name = "greet";

  // Lyhyt kuvaus help-listassa
  readonly help = "Tervehdi käyttäjää";

  // Pidempi kuvaus (valinnainen)
  readonly description = "Tulostaa tervehdyksen annetulla nimellä.";

  // Esimerkkejä (valinnainen)
  readonly examples = [
    "manage.ts greet --name Matti",
  ];

  // Määritä argumentit
  addArguments(parser: IArgumentParser): void {
    parser.addArgument("--name", {
      type: "string",
      default: "Maailma",
      alias: "-n",
      help: "Nimi, jota tervehditään",
    });
  }

  // Komennon suoritus
  async handle(options: CommandOptions): Promise<CommandResult> {
    const name = options.args.name as string;

    this.success(`Hei, ${name}!`);

    return success();
  }
}
```

### Komennon rekisteröinti

```typescript
import { ManagementUtility } from "@alexi/core";
import { GreetCommand } from "./commands/greet.ts";

const cli = new ManagementUtility();
cli.registerCommand(GreetCommand);

// Tai rekisteröi useita kerralla
cli.registerCommands([GreetCommand, OtherCommand]);

// Tai konfiguraatiossa
const cli = new ManagementUtility({
  commands: [GreetCommand, OtherCommand],
});
```

## Argumenttityypit

ArgumentParser tukee seuraavia tyyppejä:

```typescript
parser.addArgument("--port", {
  type: "number", // Numero
  default: 8000,
});

parser.addArgument("--name", {
  type: "string", // Merkkijono (oletus)
  required: true, // Pakollinen
});

parser.addArgument("--debug", {
  type: "boolean", // Boolean-lippu
  default: false,
});

parser.addArgument("--origins", {
  type: "array", // Pilkulla erotettu lista
  // --origins=a,b,c => ["a", "b", "c"]
});

parser.addArgument("--level", {
  type: "string",
  choices: ["debug", "info", "error"], // Rajoitetut vaihtoehdot
});

parser.addArgument("command", {
  required: true, // Positionaalinen argumentti
  help: "Suoritettava komento",
});
```

### Argumenttien aliakset

```typescript
parser.addArgument("--port", {
  type: "number",
  alias: "-p", // Lyhyt muoto
});

// Molemmat toimivat:
// --port 3000
// -p 3000
// --port=3000
// -p=3000
```

## Server Factory

Runserver-komento vaatii server factoryn, joka luo ja käynnistää palvelimen:

```typescript
import { ManagementUtility } from "@alexi/core";
import { Application } from "@alexi/http";
import { urlpatterns } from "./urls.ts";

const cli = new ManagementUtility();

cli.setServerFactory(async (config) => {
  console.log(`Käynnistetään palvelin: http://${config.host}:${config.port}/`);

  const app = new Application({
    urls: urlpatterns,
    debug: config.debug,
  });

  await app.serve({
    port: config.port,
    hostname: config.host,
  });
});

await cli.execute(Deno.args);
```

## Apumetodit BaseCommandissa

```typescript
class MyCommand extends BaseCommand {
  async handle(options: CommandOptions): Promise<CommandResult> {
    // Tulostukset
    this.success("Onnistui!"); // ✓ Onnistui!
    this.error("Virhe!"); // ✗ Virhe!
    this.warn("Varoitus!"); // ⚠ Varoitus!
    this.info("Tiedoksi!"); // ℹ Tiedoksi!
    this.debug("Debug", options.debug); // [DEBUG] Debug (vain debug-moodissa)

    // Suora console-käyttö
    this.stdout.log("Normaali tulostus");
    this.stderr.error("Virhetulostus");

    // Paluuarvot
    return success("Viesti"); // { exitCode: 0, message: "Viesti" }
    return failure("Virhe", 2); // { exitCode: 2, message: "Virhe" }
  }
}
```

## Testaaminen

Komentoja voi testata mock-consolella:

```typescript
import { assertEquals } from "https://deno.land/std/assert/mod.ts";

class MockConsole {
  logs: string[] = [];
  errors: string[] = [];

  log(...args: unknown[]): void {
    this.logs.push(args.map(String).join(" "));
  }
  error(...args: unknown[]): void {
    this.errors.push(args.map(String).join(" "));
  }
  warn = this.error;
  info = this.log;
}

Deno.test("MyCommand toimii", async () => {
  const command = new MyCommand();
  const mockConsole = new MockConsole();
  command.setConsole(mockConsole);

  const result = await command.run(["--arg", "value"]);

  assertEquals(result.exitCode, 0);
  assertEquals(mockConsole.logs.includes("Odotettu tulos"), true);
});
```

## API

### ManagementUtility

```typescript
new ManagementUtility(config?: ManagementConfig)

interface ManagementConfig {
  debug?: boolean;           // Debug-tila
  projectRoot?: string;      // Projektin juurikansio
  commands?: CommandConstructor[];  // Rekisteröitävät komennot
}

// Metodit
cli.execute(args: string[]): Promise<number>
cli.registerCommand(CommandClass): void
cli.registerCommands(commandClasses: CommandConstructor[]): void
cli.setServerFactory(factory: ServerFactory): void
cli.setConsole(stdout, stderr?): void
cli.getRegistry(): CommandRegistry
cli.isDebug(): boolean
cli.getProjectRoot(): string
```

### BaseCommand

```typescript
abstract class BaseCommand {
  abstract readonly name: string;
  abstract readonly help: string;
  description?: string;
  examples?: string[];

  addArguments(parser: IArgumentParser): void;
  abstract handle(options: CommandOptions): Promise<CommandResult>;

  run(args: string[], debug?: boolean): Promise<CommandResult>;
  printHelp(parser?: IArgumentParser): void;
  setConsole(stdout, stderr?): void;

  protected success(message: string): void;
  protected error(message: string): void;
  protected warn(message: string): void;
  protected info(message: string): void;
  protected debug(message: string, isDebug: boolean): void;
}
```

### ArgumentParser

```typescript
class ArgumentParser {
  addArgument(name: string, config?: ArgumentConfig): this;
  parse(args: string[]): ParsedArguments;
  getHelp(): string;
}

interface ArgumentConfig {
  type?: "string" | "number" | "boolean" | "array";
  default?: unknown;
  required?: boolean;
  help?: string;
  alias?: string;
  choices?: readonly (string | number)[];
}
```

## Lisenssit

MIT
