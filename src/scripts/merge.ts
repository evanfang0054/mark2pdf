import { ConfigLoader } from '../config/loader';
import { MergerService } from '../services/merger';
import { ProgressIndicator } from '../utils/progress';

let memoryMonitor: NodeJS.Timeout | null = null;

/**
 * 主函数
 * 负责初始化和启动合并流程
 */
async function main() {
  try {
    // 加载合并配置文件
    const config = await ConfigLoader.loadConfig();
    
    // 创建进度显示
    const progress = new ProgressIndicator({ verbose: false });
    
    // 创建合并服务
    const merger = new MergerService(config, progress);

    // 添加内存监控
    function logMemoryUsage() {
      const used = process.memoryUsage();
      console.log('内存使用情况:', {
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
    console.error('程序执行出错:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    if (memoryMonitor) {
      clearInterval(memoryMonitor);
      // 最终内存使用情况
      const used = process.memoryUsage();
      console.log('最终内存使用情况:', {
        heapTotal: `${Math.round(used.heapTotal / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(used.heapUsed / 1024 / 1024)} MB`,
        external: `${Math.round(used.external / 1024 / 1024)} MB`,
        rss: `${Math.round(used.rss / 1024 / 1024)} MB`
      });
    }
  }
}

// 全局错误处理
process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  console.error('未处理的 Promise 拒绝:', error);
  process.exit(1);
});

// 启动程序
main();
