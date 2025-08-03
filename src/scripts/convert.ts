import { ConfigLoader } from '../config/loader';
import { ConverterService } from '../services/converter';
import { ProgressIndicator } from '../utils/progress';

let converter: ConverterService | null = null;

/**
 * 主函数
 * 负责初始化和启动转换流程
 */
async function main() {
  try {
    // 加载配置文件
    const config = await ConfigLoader.loadConfig();
    
    // 创建进度显示
    const progress = new ProgressIndicator({ verbose: false });
    
    // 创建转换服务
    converter = new ConverterService(config, progress);
    await converter.convertAll();
  } catch (error) {
    console.error('程序执行出错:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// 优雅退出处理
async function handleExit(signal: string) {
  console.log(`\n收到 ${signal} 信号，正在清理资源...`);
  if (converter) {
    // 清理资源
    console.log('资源清理完成');
  }
  process.exit(0);
}

process.on('SIGINT', () => handleExit('SIGINT'));
process.on('SIGTERM', () => handleExit('SIGTERM'));

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
