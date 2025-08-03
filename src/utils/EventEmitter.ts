/**
 * 事件回调函数类型
 */
export type EventCallback = (data?: any) => void;

/**
 * 简单的事件发射器实现
 */
export class EventEmitter {
  private events: Map<string, EventCallback[]>;

  constructor() {
    this.events = new Map();
  }

  /**
   * 注册事件监听器
   * @param {string} event 事件名称
   * @param {EventCallback} callback 回调函数
   */
  on(event: string, callback: EventCallback): void {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event)!.push(callback);
  }

  /**
   * 触发事件
   * @param {string} event 事件名称
   * @param {any} data 事件数据
   */
  emit(event: string, data?: any): void {
    if (this.events.has(event)) {
      this.events.get(event)!.forEach(callback => {
        callback(data);
      });
    }
  }

  /**
   * 移除事件监听器
   * @param {string} event 事件名称
   * @param {EventCallback} callback 回调函数
   */
  off(event: string, callback: EventCallback): void {
    if (this.events.has(event)) {
      const callbacks = this.events.get(event)!;
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
      if (callbacks.length === 0) {
        this.events.delete(event);
      }
    }
  }

  /**
   * 移除指定事件的所有监听器
   * @param {string} event 事件名称
   */
  removeAllListeners(event: string): void {
    this.events.delete(event);
  }

  /**
   * 获取指定事件的监听器数量
   * @param {string} event 事件名称
   * @returns {number} 监听器数量
   */
  listenerCount(event: string): number {
    return this.events.get(event)?.length || 0;
  }

  /**
   * 获取所有事件名称
   * @returns {string[]} 事件名称数组
   */
  eventNames(): string[] {
    return Array.from(this.events.keys());
  }
}

// 创建单例实例
export const emitter = new EventEmitter();
