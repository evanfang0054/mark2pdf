const path = require('path');

/**
 * 路径处理工具类
 */
const pathUtils = {
  /**
   * 获取输出文件路径
   * @param {string} inputPath 输入文件路径
   * @param {Object} config 配置对象
   * @returns {string} 输出文件路径
   */
  getOutputPath: (inputPath, config) => {
    const relativePath = path.relative(
      path.resolve(config.input.path),
      inputPath
    );
    const pdfFileName = path.basename(inputPath, path.extname(inputPath)) + '.pdf';
    return path.join(
      path.resolve(config.output.path),
      path.dirname(relativePath),
      pdfFileName
    );
  }
};

module.exports = pathUtils; 