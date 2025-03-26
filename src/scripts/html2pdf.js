const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const chalk = require('chalk');
const ora = require('ora');
const { program } = require('commander');

// 默认配置
const defaultConfig = {
    input: {
        path: './public/html',
        extensions: ['.html']
    },
    output: {
        path: './dist/pdf',
        createDirIfNotExist: true,
        maintainDirStructure: true
    },
    options: {
        format: 'A4',
        margin: {
            top: '1cm',
            right: '1cm',
            bottom: '1cm',
            left: '1cm'
        },
        printBackground: true,
        scale: 1,
        landscape: false,
        pageRanges: '',
        headerTemplate: '',
        footerTemplate: '',
        timeout: 30000
    }
};

// 加载配置文件
function loadConfig(configPath) {
    try {
        const configFile = path.resolve(process.cwd(), configPath);
        if (fs.existsSync(configFile)) {
            const userConfig = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
            return { ...defaultConfig, ...userConfig };
        }
    } catch (error) {
        console.warn(chalk.yellow(`警告: 无法加载配置文件 ${configPath}, 使用默认配置`));
    }
    return defaultConfig;
}

// 获取要转换的文件列表
function getFilesToConvert(inputPath, extensions) {
    const files = [];
    
    // 如果输入路径是文件
    if (fs.statSync(inputPath).isFile()) {
        const ext = path.extname(inputPath).toLowerCase();
        if (extensions.includes(ext)) {
            files.push(inputPath);
        }
        return files;
    }
    
    // 如果输入路径是目录
    function scanDir(dir) {
        const items = fs.readdirSync(dir);
        for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory()) {
                scanDir(fullPath);
            } else {
                const ext = path.extname(fullPath).toLowerCase();
                if (extensions.includes(ext)) {
                    files.push(fullPath);
                }
            }
        }
    }
    
    scanDir(inputPath);
    return files;
}

async function convertHtmlToPdf(htmlPath, outputPath, options = {}) {
    const spinner = ora(`正在转换: ${path.basename(htmlPath)}`).start();
    try {
        // 确保输入文件存在
        if (!fs.existsSync(htmlPath)) {
            throw new Error(`HTML文件不存在: ${htmlPath}`);
        }

        // 确保输出目录存在
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // 启动浏览器
        const browser = await puppeteer.launch({
            headless: 'new'
        });

        const page = await browser.newPage();

        // 读取HTML文件内容
        const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
        await page.setContent(htmlContent, {
            waitUntil: 'networkidle0',
            timeout: options.timeout || 30000
        });

        // 设置PDF选项
        const pdfOptions = {
            path: outputPath,
            format: options.format,
            margin: options.margin,
            printBackground: options.printBackground,
            landscape: options.landscape,
            scale: options.scale,
            pageRanges: options.pageRanges,
            headerTemplate: options.headerTemplate,
            footerTemplate: options.footerTemplate
        };

        // 生成PDF
        await page.pdf(pdfOptions);

        // 关闭浏览器
        await browser.close();

        spinner.succeed(chalk.green(`转换成功: ${path.basename(outputPath)}`));
    } catch (error) {
        spinner.fail(chalk.red(`转换失败 ${path.basename(htmlPath)}: ${error.message}`));
        throw error;
    }
}

// 命令行配置
program
    .name('html2pdf')
    .description('将HTML文件转换为PDF')
    .argument('[input]', 'HTML文件或目录路径')
    .option('-c, --config <path>', '配置文件路径', 'html2pdf.config.json')
    .option('-f, --format <format>', '页面格式 (A4, Letter等)')
    .option('-b, --no-background', '不打印背景')
    .option('-l, --landscape', '横向打印')
    .option('-s, --scale <number>', '缩放比例')
    .option('--margin-top <margin>', '上边距')
    .option('--margin-right <margin>', '右边距')
    .option('--margin-bottom <margin>', '下边距')
    .option('--margin-left <margin>', '左边距')
    .option('--page-ranges <ranges>', '页面范围 (例如: 1-5,8)')
    .option('--header <template>', '页眉模板')
    .option('--footer <template>', '页脚模板')
    .action(async (input, cliOptions) => {
        try {
            // 加载配置文件
            const config = loadConfig(cliOptions.config);
            
            // 确定输入路径
            const inputPath = input 
                ? path.resolve(input)
                : path.resolve(config.input.path);

            // 获取要转换的文件列表
            const files = getFilesToConvert(inputPath, config.input.extensions);
            
            if (files.length === 0) {
                console.log(chalk.yellow('没有找到需要转换的HTML文件'));
                return;
            }

            console.log(chalk.blue(`找到 ${files.length} 个HTML文件需要转换`));

            // 合并配置，命令行参数优先级高于配置文件
            const convertOptions = {
                ...config.options,
                format: cliOptions.format || config.options.format,
                printBackground: cliOptions.background !== false,
                landscape: cliOptions.landscape || config.options.landscape,
                scale: cliOptions.scale ? parseFloat(cliOptions.scale) : config.options.scale,
                pageRanges: cliOptions.pageRanges || config.options.pageRanges,
                headerTemplate: cliOptions.header || config.options.headerTemplate,
                footerTemplate: cliOptions.footer || config.options.footerTemplate,
                margin: {
                    top: cliOptions.marginTop || config.options.margin.top,
                    right: cliOptions.marginRight || config.options.margin.right,
                    bottom: cliOptions.marginBottom || config.options.margin.bottom,
                    left: cliOptions.marginLeft || config.options.margin.left
                }
            };

            // 转换所有文件
            for (const file of files) {
                const relativePath = path.relative(inputPath, file);
                const outputPath = path.resolve(
                    config.output.path,
                    config.output.maintainDirStructure
                        ? path.join(path.dirname(relativePath), `${path.basename(file, '.html')}.pdf`)
                        : `${path.basename(file, '.html')}.pdf`
                );

                try {
                    await convertHtmlToPdf(file, outputPath, convertOptions);
                } catch (error) {
                    console.error(chalk.red(`转换 ${file} 失败: ${error.message}`));
                    // 继续处理下一个文件
                }
            }

            console.log(chalk.green('\n转换完成！'));
        } catch (error) {
            console.error(chalk.red(`错误: ${error.message}`));
            process.exit(1);
        }
    });

program.parse(); 