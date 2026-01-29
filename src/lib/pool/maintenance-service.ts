import { Account, DBManager } from './db-manager';
import { sunoApi } from '@/lib/SunoApi';

/**
 * 维护结果接口
 */
export interface MaintenanceResult {
  accountId: string;
  success: boolean;
  newCookie?: string;
  error?: string;
}

/**
 * 维护服务类
 * 负责执行账号保活和健康检查操作
 */
export class MaintenanceService {
  private dbManager: DBManager;

  /**
   * 构造函数
   * @param dbManager 数据库管理器实例
   */
  constructor(dbManager: DBManager) {
    this.dbManager = dbManager;
  }

  /**
   * 健康检查
   * 调用 SunoApi 的 getCredits 方法验证 Cookie 有效性
   * @param account 要检查的账号
   * @returns 是否健康
   */
  public async healthCheck(account: Account): Promise<boolean> {
    try {
      // 使用账号的 Cookie 创建 SunoApi 实例并调用 getCredits
      const api = await sunoApi(account.cookie);
      await api.getCredits();
      return true;
    } catch (error) {
      console.error(`账号 ${account.id} 健康检查失败:`, error);
      return false;
    }
  }

  /**
   * 保活操作
   * 使用 SunoApi 执行轻量级操作以保持 Cookie 活跃
   * @param account 要保活的账号
   * @returns 维护结果
   */
  public async keepAlive(account: Account): Promise<MaintenanceResult> {
    try {
      // 使用账号的 Cookie 创建 SunoApi 实例
      const api = await sunoApi(account.cookie);
      
      // 调用 keepAlive 方法保持会话活跃
      await api.keepAlive(true);
      
      // 调用 getCredits 验证保活是否成功
      await api.getCredits();

      return {
        accountId: account.id,
        success: true,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`账号 ${account.id} 保活失败:`, errorMessage);
      
      return {
        accountId: account.id,
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * 批量维护
   * 对所有账号执行保活操作
   * @param accounts 要维护的账号列表
   * @returns 维护结果列表
   */
  public async maintainAll(accounts: Account[]): Promise<MaintenanceResult[]> {
    const results: MaintenanceResult[] = [];

    for (const account of accounts) {
      const result = await this.keepAlive(account);
      results.push(result);

      // 记录维护日志
      this.dbManager.addLog({
        accountId: account.id,
        operation: 'maintenance',
        status: result.success ? 'success' : 'failed',
        message: result.success 
          ? '维护成功' 
          : `维护失败: ${result.error}`,
      });

      // 如果维护失败,将账号标记为 disabled
      if (!result.success) {
        this.dbManager.updateAccount(account.id, { status: 'disabled' });
      }
    }

    return results;
  }
}
