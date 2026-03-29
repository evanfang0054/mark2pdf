export interface StructuredError {
  error: string;
  message: string;
  hint: string;
}

export class ErrorFormatter {
  static toStructuredError(error: unknown, isJsonMode: boolean): StructuredError | string {
    const message = error instanceof Error ? error.message : String(error);
    const lowered = message.toLowerCase();

    let category = 'runtime';
    let action = 'mark2pdf --verbose convert --dry-run';

    if (lowered.includes('invalid') || lowered.includes('参数') || lowered.includes('option')) {
      category = 'argument';
      action = 'mark2pdf --help';
    } else if (lowered.includes('path') || lowered.includes('enoent') || lowered.includes('不存在')) {
      category = 'path';
      action = 'mark2pdf convert --show-config';
    } else if (lowered.includes('eacces') || lowered.includes('permission') || lowered.includes('权限')) {
      category = 'permission';
      action = 'mark2pdf convert -o ./output';
    }

    if (isJsonMode) {
      return {
        error: category,
        message,
        hint: action,
      };
    }

    return `[CLI_ERROR]\n类别: ${category}\n摘要: ${message}\n建议: ${action}`;
  }
}
