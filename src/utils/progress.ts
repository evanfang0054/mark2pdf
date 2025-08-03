import cliProgress from 'cli-progress';
import path from 'path';
import chalk from 'chalk';

export interface ProgressOptions {
  verbose: boolean;
}

export class ProgressIndicator {
  private verbose: boolean;
  private startTime: number;
  private processed: number = 0;
  private total: number = 0;
  private progressBar?: cliProgress.SingleBar;

  constructor(options: ProgressOptions) {
    this.verbose = options.verbose;
    this.startTime = Date.now();
  }

  start(total: number): void {
    this.total = total;
    this.progressBar = new cliProgress.SingleBar({
      format: `${chalk.green('{bar}')} {percentage}% | {value}/${this.total} | ${chalk.cyan('{filename}')} | {speed}`,
      barCompleteChar: '█',
      barIncompleteChar: '░',
      hideCursor: true
    });

    this.progressBar.start(total, 0, {
      filename: '',
      speed: '0.0s/file'
    });
  }

  update(filename: string): void {
    if (!this.progressBar) return;

    this.processed++;
    const elapsed = (Date.now() - this.startTime) / 1000;
    const speed = elapsed > 0 ? (elapsed / this.processed).toFixed(1) : '0.0';

    this.progressBar.update(this.processed, {
      filename: path.basename(filename),
      speed: `${speed}s/file`
    });

    if (this.verbose) {
      console.log(`${chalk.blue('处理中:')} ${filename}`);
    }
  }

  complete(): void {
    if (this.progressBar) {
      this.progressBar.stop();
    }
    
    const totalTime = ((Date.now() - this.startTime) / 1000).toFixed(2);
    const avgSpeed = this.processed > 0 ? (parseFloat(totalTime) / this.processed).toFixed(2) : '0.00';
    
    console.log(`\n${chalk.green('✓')} 转换完成！总耗时: ${chalk.cyan(totalTime)}秒，平均速度: ${chalk.cyan(avgSpeed)}s/文件`);
  }

  error(message: string): void {
    if (this.progressBar) {
      this.progressBar.stop();
    }
    console.error(chalk.red('✗'), message);
  }

  warn(message: string): void {
    if (this.verbose) {
      console.warn(chalk.yellow('⚠'), message);
    }
  }

  info(message: string): void {
    if (this.verbose) {
      console.info(chalk.blue('ℹ'), message);
    }
  }
}
