import { Account } from './db-manager';

/**
 * 调度器类
 * 实现负载均衡算法,选择合适的账号处理请求
 */
export class Scheduler {
  private roundRobinIndex: number = 0;

  /**
   * 轮询调度算法
   * 使用轮询算法从账号列表中选择一个账号
   * @param accounts 可用账号列表
   * @returns 选中的账号或 null(如果列表为空)
   */
  public roundRobin(accounts: Account[]): Account | null {
    if (accounts.length === 0) {
      return null;
    }

    // 使用轮询索引选择账号
    const selectedAccount = accounts[this.roundRobinIndex % accounts.length];
    
    // 递增索引,准备下次选择
    this.roundRobinIndex = (this.roundRobinIndex + 1) % accounts.length;

    return selectedAccount;
  }

  /**
   * 基于模型的筛选
   * 从账号列表中筛选出支持指定模型的账号
   * @param accounts 账号列表
   * @param model 模型名称
   * @returns 支持该模型的账号列表
   */
  public filterByModel(accounts: Account[], model: string): Account[] {
    return accounts.filter(account => {
      // 如果账号的 supportedModels 为空数组,视为支持所有模型
      if (account.supportedModels.length === 0) {
        return true;
      }
      
      // 检查账号是否支持指定模型
      return account.supportedModels.includes(model);
    });
  }

  /**
   * 重置轮询索引(用于测试)
   * @internal
   */
  public resetIndex(): void {
    this.roundRobinIndex = 0;
  }

  /**
   * 获取当前轮询索引(用于测试)
   * @internal
   */
  public getCurrentIndex(): number {
    return this.roundRobinIndex;
  }
}
