const { loadConfig } = require('../config');
const MergerService = require('../services/merger');
const logger = require('../utils/logger');

/**
 * 主函数
 * 负责初始化和启动合并流程
 */
async function main() {
  let memoryMonitor;
  
  try {
    // 加载合并配置文件
    const config = await loadConfig('merge');
    
    // 创建合并服务
    const merger = new MergerService(config);

    // 添加内存监控
    function logMemoryUsage() {
      const used = process.memoryUsage();
      logger.info('内存使用情况:', {
        heapTotal: `${Math.round(used.heapTotal / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(used.heapUsed / 1024 / 1024)} MB`,
        external: `${Math.round(used.external / 1024 / 1024)} MB`,
        rss: `${Math.round(used.rss / 1024 / 1024)} MB`
      });
    }

    // 定期监控内存
    memoryMonitor = setInterval(logMemoryUsage, 30000);
    
    // 执行合并操作
    await merger.mergeAll();

  } catch (error) {
    logger.error('程序执行出错:', error.message);
    process.exit(1);
  } finally {
    if (memoryMonitor) {
      clearInterval(memoryMonitor);
      logMemoryUsage(); // 最终内存使用情况
    }
  }
}

// 全局错误处理
process.on('uncaughtException', error => {
  logger.error('未捕获的异常:', error);
  process.exit(1);
});

process.on('unhandledRejection', error => {
  logger.error('未处理的 Promise 拒绝:', error);
  process.exit(1);
});

// 启动程序
main(); 