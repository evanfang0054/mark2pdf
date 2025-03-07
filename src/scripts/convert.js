const { loadConfig } = require('../config');
const ConverterService = require('../services/converter');
const logger = require('../utils/logger');

let converter = null;

/**
 * 主函数
 * 负责初始化和启动转换流程
 */
async function main() {
  try {
    // 加载配置文件
    const config = await loadConfig();
    
    // 创建转换服务
    converter = new ConverterService(config);
    await converter.convertAll();
  } catch (error) {
    logger.error('程序执行出错:', error.message);
    process.exit(1);
  }
}

// 优雅退出处理
async function handleExit(signal) {
  console.log(`\n收到 ${signal} 信号，正在清理资源...`);
  if (converter) {
    await converter.cleanup();
  }
  process.exit(0);
}

process.on('SIGINT', () => handleExit('SIGINT'));
process.on('SIGTERM', () => handleExit('SIGTERM'));

// 全局错误处理
process.on('uncaughtException', error => {
  logger.error('未捕获的异常:', error);
  process.exit(1);
});

process.on('unhandledRejection', error => {
  logger.error('未处理的 Promise 拒绝:', error);
  process.exit(1);
});

// 设置日志级别为 verbose 可以看到更多信息
logger.setLevel('verbose');

// 启动程序
main(); 