const fs = require('fs').promises;
const path = require('path');

/**
 * 配置加载器
 * 负责加载和验证配置文件
 */
class ConfigLoader {
  /**
   * 加载配置文件
   * @param {string} [type='default'] 配置类型
   * @returns {Promise<Object>} 配置对象
   */
  static async loadConfig(type = 'default') {
    const configPath = path.join(
      process.cwd(),
      type === 'default' ? 'config.json' : 'merge.config.json'
    );

    try {
      const content = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(content);
      await ConfigLoader._validateConfig(config, type);
      return config;
    } catch (error) {
      throw new Error(`加载配置文件失败: ${error.message}`);
    }
  }

  /**
   * 验证配置对象
   * @private
   * @param {Object} config 配置对象
   * @param {string} type 配置类型
   */
  static async _validateConfig(config, type) {
    if (!config.input || !config.output) {
      throw new Error('配置文件缺少必要的 input 或 output 字段');
    }

    // 验证输入路径
    try {
      await fs.access(path.resolve(config.input.path));
    } catch {
      throw new Error(`输入路径不存在: ${config.input.path}`);
    }

    // 验证其他必要字段
    if (type === 'default') {
      ConfigLoader._validateDefaultConfig(config);
    } else {
      ConfigLoader._validateMergeConfig(config);
    }
  }

  /**
   * 验证默认配置
   * @private
   * @param {Object} config 配置对象
   */
  static _validateDefaultConfig(config) {
    const { options } = config;
    if (!options) {
      throw new Error('配置文件缺少 options 字段');
    }

    if (!Number.isInteger(options.concurrent) || options.concurrent < 1) {
      throw new Error('concurrent 必须是大于 0 的整数');
    }

    if (!Number.isInteger(options.timeout) || options.timeout < 0) {
      throw new Error('timeout 必须是大于等于 0 的整数');
    }
  }

  /**
   * 验证合并配置
   * @private
   * @param {Object} config 配置对象
   */
  static _validateMergeConfig(config) {
    const { options } = config;
    if (!options || !options.sort || !options.compression) {
      throw new Error('合并配置缺少必要的选项字段');
    }

    if (typeof options.sort.enabled !== 'boolean') {
      throw new Error('sort.enabled 必须是布尔值');
    }

    if (!['low', 'medium', 'high'].includes(options.compression.quality)) {
      throw new Error('compression.quality 必须是 low、medium 或 high');
    }
  }
}

module.exports = {
  loadConfig: ConfigLoader.loadConfig
}; 