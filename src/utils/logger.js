/**
 * 日志工具类
 * 统一管理日志输出格式和样式
 */
const chalk = require('chalk');

class Logger {
  constructor() {
    this.level = 'info'; // default level
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      verbose: 3,
      debug: 4
    };
  }

  setLevel(level) {
    if (this.levels[level] !== undefined) {
      this.level = level;
    }
  }

  shouldLog(level) {
    return this.levels[level] <= this.levels[this.level];
  }

  error(...args) {
    console.error(chalk.red('❌ ERROR:'), ...args);
  }

  warn(...args) {
    if (this.shouldLog('warn')) {
      console.warn(chalk.yellow('⚠️ WARN:'), ...args);
    }
  }

  info(...args) {
    if (this.shouldLog('info')) {
      console.info(chalk.blue('ℹ️ INFO:'), ...args);
    }
  }

  verbose(...args) {
    if (this.shouldLog('verbose')) {
      console.log(chalk.gray('🔍 VERBOSE:'), ...args);
    }
  }

  debug(...args) {
    if (this.shouldLog('debug')) {
      console.log(chalk.magenta('🐛 DEBUG:'), ...args);
    }
  }

  success(...args) {
    if (this.shouldLog('info')) {
      console.log(chalk.green('✓ SUCCESS:'), ...args);
    }
  }
}

module.exports = new Logger(); 