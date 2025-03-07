const fs = require('fs').promises;
const path = require('path');
const stream = require('stream');
const { promisify } = require('util');
const pipeline = promisify(stream.pipeline);

/**
 * 文件操作工具类
 */
const fileUtils = {
  /**
   * 确保目录存在，不存在则创建
   * @param {string} dirPath 目录路径
   */
  ensureDir: async (dirPath) => {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  },

  /**
   * 检查文件是否为 Markdown 文件
   * @param {string} filePath 文件路径
   * @returns {boolean} 是否为 Markdown 文件
   */
  isMarkdownFile: (filePath) => {
    return path.extname(filePath).toLowerCase() === '.md';
  },

  /**
   * 递归获取指定目录下所有指定扩展名的文件
   * @param {string} dirPath 目录路径
   * @param {string} extension 文件扩展名
   * @param {boolean} [includeDirs=false] 是否包含子目录信息
   * @returns {Promise<string[]|{files: string[], subDirs: string[]}>} 文件路径数组或包含子目录信息的对象
   */
  getAllFiles: async (dirPath, extension, includeDirs = false) => {
    try {
      const files = await fs.readdir(dirPath);
      const result = includeDirs ? { files: [], subDirs: [] } : [];

      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stats = await fs.stat(filePath);

        if (stats.isDirectory()) {
          if (includeDirs) {
            result.subDirs.push(filePath);
            const subResults = await fileUtils.getAllFiles(filePath, extension, includeDirs);
            result.files.push(...subResults.files);
          } else {
            const subFiles = await fileUtils.getAllFiles(filePath, extension, includeDirs);
            result.push(...subFiles);
          }
        } else if (path.extname(file).toLowerCase() === extension) {
          if (includeDirs) {
            result.files.push(filePath);
          } else {
            result.push(filePath);
          }
        }
      }

      return result;
    } catch (error) {
      console.error(`读取目录失败 ${dirPath}:`, error.message);
      return includeDirs ? { files: [], subDirs: [] } : [];
    }
  },

  async readFileStream(filePath) {
    return fs.createReadStream(filePath, { 
      highWaterMark: 64 * 1024 // 64KB chunks
    });
  },

  async writeFileStream(filePath, content) {
    const writeStream = fs.createWriteStream(filePath);
    await pipeline(content, writeStream);
  },
  
  async processLargeFile(inputPath, outputPath, processor) {
    const readStream = await fileUtils.readFileStream(inputPath);
    const transform = new stream.Transform({
      transform(chunk, encoding, callback) {
        const processed = processor(chunk);
        callback(null, processed);
      }
    });
    await pipeline(readStream, transform, fs.createWriteStream(outputPath));
  },

  /**
   * 获取文件的相对路径
   * @param {string} fullPath 完整路径
   * @param {string} basePath 基础路径
   * @returns {string} 相对路径
   */
  getRelativePath: (fullPath, basePath) => {
    return path.relative(basePath, fullPath);
  }
};

module.exports = fileUtils; 