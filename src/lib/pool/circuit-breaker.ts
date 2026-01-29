import { DBManager, Account } from './db-manager';

/**
 * 熔断器类
 * 自动识别和隔离失效账号
 */
export class CircuitBreaker {
  private dbManager: DBManager;

  /**
   * 构造函数
   * @param dbManager 数据库管理器实例
   */
  constructor(dbManager: DBManager) {
    this.dbManager = dbManager;
  }

  /**
   * 检查错误是否应该触发熔断
   * @param error 错误对象
   * @returns 是否应该熔断
   */
  public shouldBreak(error: any): boolean {
    // 检查是否是 401 或 403 认证错误
    const status = error?.response?.status || error?.status;
    return status === 401 || status === 403;
  }

  /**
   * 处理认证错误
   * 当检测到认证错误时,立即将账号状态更新为 disabled
   * @param accountId 账号 ID
   * @param error 错误对象
   */
  public handleAuthError(accountId: string, error: any): void {
    try {
      // 检查是否应该熔断
      if (!this.shouldBreak(error)) {
        return;
      }

      // 获取账号信息
      const account = this.dbManager.getAccount(accountId);
      if (!account) {
        console.warn(`熔断器: 账号 ${accountId} 不存在`);
        return;
      }

      // 如果账号已经是 disabled 状态,无需重复处理
      if (account.status === 'disabled') {
        return;
      }

      // 更新账号状态为 disabled
      const updated = this.dbManager.updateAccount(accountId, { status: 'disabled' });

      if (updated) {
        // 记录熔断日志
        const errorMessage = error?.message || error?.response?.statusText || '认证失败';
        const status = error?.response?.status || error?.status || 'unknown';
        
        this.dbManager.addLog({
          accountId,
          operation: 'circuit_break',
          status: 'success',
          message: `账号因 ${status} 错误被熔断: ${errorMessage}`,
        });

        console.log(`熔断器: 账号 ${accountId} 已被熔断并标记为 disabled`);
      }
    } catch (err) {
      console.error('熔断器处理错误:', err);
      
      // 即使记录日志失败,也要尝试记录错误
      try {
        this.dbManager.addLog({
          accountId,
          operation: 'circuit_break',
          status: 'failed',
          message: `熔断处理失败: ${err instanceof Error ? err.message : String(err)}`,
        });
      } catch (logErr) {
        console.error('记录熔断失败日志时出错:', logErr);
      }
    }
  }
}
