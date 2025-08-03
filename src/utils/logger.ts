import chalk from 'chalk';

/**
 * 日志级别枚举
 */
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  VERBOSE = 3,
  DEBUG = 4
}

/**
 * 日志级别名称映射
 */
const LOG_LEVEL_NAMES: Record<LogLevel, string> = {
  [LogLevel.ERROR]: 'error',
  [LogLevel.WARN]: 'warn',
  [LogLevel.INFO]: 'info',
  [LogLevel.VERBOSE]: 'verbose',
  [LogLevel.DEBUG]: 'debug'
};

/**
 * 日志工具类
 * 统一管理日志输出格式和样式
 */
export class Logger {
  private level: LogLevel;
  private readonly levels: Record<string, LogLevel>;

  constructor() {
    this.level = LogLevel.INFO; // default level
    this.levels = {
      error: LogLevel.ERROR,
      warn: LogLevel.WARN,
      info: LogLevel.INFO,
      verbose: LogLevel.VERBOSE,
      debug: LogLevel.DEBUG
    };
  }

  /**
   * 设置日志级别
   * @param {string} level 日志级别名称
   */
  setLevel(level: string): void {
    if (this.levels[level] !== undefined) {
      this.level = this.levels[level];
    }
  }

  /**
   * 获取当前日志级别
   * @returns {LogLevel} 当前日志级别
   */
  getLevel(): LogLevel {
    return this.level;
  }

  /**
   * 检查是否应该输出指定级别的日志
   * @param {LogLevel} level 日志级别
   * @returns {boolean} 是否应该输出
   */
  private shouldLog(level: LogLevel): boolean {
    return level <= this.level;
  }

  /**
   * 输出错误日志
   * @param {...any} args 日志内容
   */
  error(...args: any[]): void {
    console.error(chalk.red('❌ ERROR:'), ...args);
  }

  /**
   * 输出警告日志
   * @param {...any} args 日志内容
   */
  warn(...args: any[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(chalk.yellow('⚠️ WARN:'), ...args);
    }
  }

  /**
   * 输出信息日志
   * @param {...any} args 日志内容
   */
  info(...args: any[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(chalk.blue('ℹ️ INFO:'), ...args);
    }
  }

  /**
   * 输出详细日志
   * @param {...any} args 日志内容
   */
  verbose(...args: any[]): void {
    if (this.shouldLog(LogLevel.VERBOSE)) {
      console.log(chalk.gray('🔍 VERBOSE:'), ...args);
    }
  }

  /**
   * 输出调试日志
   * @param {...any} args 日志内容
   */
  debug(...args: any[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.log(chalk.magenta('🐛 DEBUG:'), ...args);
    }
  }

  /**
   * 输出成功日志
   * @param {...any} args 日志内容
   */
  success(...args: any[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(chalk.green('✓ SUCCESS:'), ...args);
    }
  }

  /**
   * 输出带时间戳的日志
   * @param {LogLevel} level 日志级别
   * @param {...any} args 日志内容
   */
  logWithTimestamp(level: LogLevel, ...args: any[]): void {
    if (this.shouldLog(level)) {
      const timestamp = new Date().toISOString();
      const levelName = LOG_LEVEL_NAMES[level];
      console.log(`[${timestamp}] [${levelName.toUpperCase()}]`, ...args);
    }
  }

  /**
   * 创建子日志器
   * @param {string} prefix 前缀
   * @returns {Logger} 子日志器
   */
  child(prefix: string): Logger {
    const childLogger = new Logger();
    childLogger.level = this.level;
    
    // 重写所有方法以添加前缀
    const methods = ['error', 'warn', 'info', 'verbose', 'debug', 'success'];
    methods.forEach(method => {
      const originalMethod = (this as any)[method];
      (childLogger as any)[method] = (...args: any[]) => {
        originalMethod.call(this, `[${prefix}]`, ...args);
      };
    });
    
    return childLogger;
  }
}

// 创建单例实例
export const logger = new Logger();
