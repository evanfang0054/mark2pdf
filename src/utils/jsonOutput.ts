import chalk from 'chalk';

export interface ListOutput<T> {
  items: T[];
  total: number;
  processed: number;
  has_more: boolean;
}

export interface JsonOutputOptions {
  quiet?: boolean;
  json?: boolean;
}

interface JsonErrorInput {
  category: string;
  summary: string;
  action: string;
}

export class JsonOutput {
  private readonly quiet: boolean;
  private readonly json: boolean;

  constructor(options: JsonOutputOptions) {
    this.json = Boolean(options.json);
    this.quiet = Boolean(options.quiet) || this.json;

    if (this.json) {
      chalk.level = 0;
    }
  }

  isJsonMode(): boolean {
    return this.json;
  }

  shouldSuppressOutput(): boolean {
    return this.quiet || this.json;
  }

  formatList<T>(items: T[], total: number, hasMore: boolean): ListOutput<T> | T[] {
    if (!this.json) {
      return items;
    }

    return {
      items,
      total,
      processed: items.length,
      has_more: hasMore,
    };
  }

  formatError(error: JsonErrorInput): { error: string; message: string; hint: string } | string {
    if (this.json) {
      return {
        error: error.category,
        message: error.summary,
        hint: error.action,
      };
    }

    return `[CLI_ERROR]\n类别: ${error.category}\n摘要: ${error.summary}\n建议: ${error.action}`;
  }
}
