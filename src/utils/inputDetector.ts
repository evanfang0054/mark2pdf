import path from 'path';

/**
 * 支持的输入文件类型
 */
export type InputType = 'md' | 'html' | 'docx' | 'pdf' | 'unknown';

/**
 * 输入类型映射表
 */
const EXTENSION_MAP: Record<string, InputType> = {
  '.md': 'md',
  '.markdown': 'md',
  '.html': 'html',
  '.htm': 'html',
  '.docx': 'docx',
  '.pdf': 'pdf',
};

/**
 * 检测输入文件类型
 * @param filePath 文件路径
 * @returns 输入类型
 */
export function detectInputType(filePath: string): InputType {
  const ext = path.extname(filePath).toLowerCase();
  return EXTENSION_MAP[ext] || 'unknown';
}

/**
 * 获取输入类型对应的文件扩展名列表
 * @param type 输入类型
 * @returns 扩展名数组
 */
export function getExtensionsForType(type: InputType): string[] {
  const typeToExtensions: Record<string, string[]> = {
    md: ['.md', '.markdown'],
    html: ['.html', '.htm'],
    docx: ['.docx'],
    pdf: ['.pdf'],
  };
  return typeToExtensions[type] || [];
}

/**
 * 检查文件是否为支持的输入类型
 * @param filePath 文件路径
 * @returns 是否支持
 */
export function isSupportedInputType(filePath: string): boolean {
  return detectInputType(filePath) !== 'unknown';
}

/**
 * 获取所有支持的扩展名
 * @returns 扩展名数组
 */
export function getSupportedExtensions(): string[] {
  return Object.keys(EXTENSION_MAP);
}
