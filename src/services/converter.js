const PdfConverter = require('../core/PdfConverter');
const { getAllFiles } = require('../utils/fileUtils');
const logger = require('../utils/logger');
const ora = require('ora');
const chalk = require('chalk');

/**
 * 转换服务类
 * 负责管理 Markdown 到 PDF 的批量转换流程
 */
class ConverterService {
  /**
   * 创建转换服务实例
   * @param {Object} config 配置对象
   */
  constructor(config) {
    this.config = config;
    this.converter = new PdfConverter(config);
    this.spinner = ora();
    this.startTime = 0;
    this.cache = new Map();
    this.cacheSize = 100; // 最大缓存条目
  }

  /**
   * 执行批量转换
   * @returns {Promise<void>}
   */
  async convertAll() {
    try {
      this.startTime = Date.now();
      
      // 文件扫描阶段
      this.spinner.start('正在扫描 Markdown 文件...');
      const mdFiles = await this._getMdFiles();
      
      if (mdFiles.length === 0) {
        this.spinner.fail(chalk.yellow('未找到任何 Markdown 文件'));
        return;
      }
      
      this.spinner.succeed(`找到 ${chalk.cyan(mdFiles.length)} 个 Markdown 文件`);

      // 转换阶段
      const results = await this._processBatch(mdFiles);
      this._printSummary(results);
      
      // 清理阶段
      await this._cleanup();
      
    } catch (error) {
      this.spinner.fail(chalk.red('转换过程出错'));
      logger.error('详细错误信息:', error.message);
      throw error;
    }
  }

  /**
   * 获取所有 Markdown 文件
   * @private
   * @returns {Promise<string[]>} Markdown 文件路径数组
   */
  async _getMdFiles() {
    return getAllFiles(this.config.input.path, '.md');
  }

  /**
   * 批量处理文件
   * @private
   * @param {string[]} files 文件路径数组
   * @returns {Promise<Object>} 处理结果
   */
  async _processBatch(files) {
    const results = { success: [], failed: [], total: files.length };
    const batchSize = this.config.options.concurrent;
    let processedCount = 0;

    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      this.spinner.start(`正在转换 [${processedCount}/${files.length}]`);
      
      const batchResults = await Promise.all(
        batch.map(async file => {
          const result = await this.converter.convert(file);
          processedCount++;
          this.spinner.text = `正在转换 [${processedCount}/${files.length}]`;
          return result;
        })
      );

      this._processResults(batchResults, results);
    }

    this.spinner.succeed(`转换完成 [${processedCount}/${files.length}]`);
    return results;
  }

  /**
   * 处理转换结果
   * @private
   * @param {Object[]} batchResults 批处理结果
   * @param {Object} results 累计结果
   */
  _processResults(batchResults, results) {
    batchResults.forEach(result => {
      if (result.success) {
        results.success.push(result);
      } else {
        results.failed.push(result);
      }
    });
  }

  /**
   * 打印转换结果摘要
   * @private
   * @param {Object} results 转换结果
   */
  _printSummary(results) {
    const duration = ((Date.now() - this.startTime) / 1000).toFixed(2);
    const total = results.success.length + results.failed.length;
    
    console.log('\n' + chalk.bold('📊 转换报告'));
    console.log('━'.repeat(50));
    console.log(`总耗时: ${chalk.cyan(duration)} 秒`);
    console.log(`总文件: ${chalk.white(total)}`);
    console.log(`成功数: ${chalk.green(results.success.length)}`);
    console.log(`失败数: ${chalk.red(results.failed.length)}`);
    console.log(`成功率: ${chalk.cyan(((results.success.length / total) * 100).toFixed(1))}%`);
    console.log('━'.repeat(50));

    if (results.failed.length > 0) {
      console.log('\n' + chalk.red('❌ 失败详情:'));
      results.failed.forEach(({ file, error }, index) => {
        console.log(`${index + 1}. ${chalk.yellow(file)}`);
        console.log(`   ${chalk.red('原因:')} ${error}`);
      });
    }
  }

  async _cleanup() {
    // 清理临时文件等资源
    try {
      // 实现资源清理逻辑
    } catch (error) {
      logger.warn('资源清理过程出现警告:', error.message);
    }
  }

  async convert(data) {
    const cacheKey = this.getCacheKey(data);
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    
    const result = await this.processConversion(data);
    
    // 管理缓存大小
    if (this.cache.size >= this.cacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(cacheKey, result);
    return result;
  }
  
  getCacheKey(data) {
    // 根据实际数据结构生成缓存键
    return typeof data === 'object' ? JSON.stringify(data) : String(data);
  }
}

module.exports = ConverterService; 