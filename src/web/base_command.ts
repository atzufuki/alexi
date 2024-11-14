export class BaseCommand {
  name: string;
  help: string;

  async execute() {
    const parser = new ArgumentParser(Deno.args);
    this.addArguments(parser);
    return await this.handle(parser.parseArgs());
  }

  addArguments(parser: ArgumentParser) {}

  async handle(options: object) {
    throw new Error('Not implemented');
  }
}

export class ArgumentParser {
  arguments: {
    [name: string]: {
      value?: string;
      help?: string;
      default?: string;
    };
  } = {};

  constructor(args: string[]) {
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg.startsWith('--')) {
        const name = arg.slice(2);
        const value = args[i + 1];

        this.arguments[name] = { value: value };
      }
    }
  }

  addArgument(options: { name: string; help?: string; default?: string }) {
    if (!this.arguments[options.name]) {
      this.arguments[options.name] = {};
    }

    this.arguments[options.name].help = options.help;
    this.arguments[options.name].default = options.default;
  }

  parseArgs() {
    const args = {};

    for (const name in this.arguments) {
      args[name] = this.arguments[name].value || this.arguments[name].default;
    }

    return args;
  }
}
