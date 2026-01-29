import { Account, DBManager } from './db-manager';
import { Scheduler } from './scheduler';
import { MaintenanceService } from './maintenance-service';
import { CircuitBreaker } from './circuit-breaker';

/**
 * 账号选择选项接口
 */
export interface AccountSelectionOptions {
  model?: string;                // 可选的模型参数
  requireModelFilter: boolean;   // 是否需要模型筛选
}

/**
 * 账号池统计信息接口
 */
export interface PoolStats {
  total: number;
  active: number;
  disabled: number;
  lastMaintenance: number | null;
}

/**
 * 账号池管理器类
 * 管理账号生命周期,提供账号选择和状态管理功能
 */
export class AccountPool {
  private dbManager: DBManager;
  private scheduler: Scheduler;
  private maintenanceService: MaintenanceService;
  private circuitBreaker: CircuitBreaker;
  private maintenanceTimer: NodeJS.Timeout | null = null;
  private maintenanceIntervalMinutes: number = 15; // 默认 15 分钟

  /**
   * 构造函数
   * @param dbManager 数据库管理器实例
   */
  constructor(dbManager: DBManager) {
    this.dbManager = dbManager;
    this.scheduler = new Scheduler();
    this.maintenanceService = new MaintenanceService(dbManager);
    this.circuitBreaker = new CircuitBreaker(dbManager);
  }

  /**
   * 初始化账号池
   * 加载账号并执行启动自愈检查
   */
  public async initialize(): Promise<void> {
    console.log('账号池初始化开始...');

    try {
      // 加载所有账号
      const allAccounts = this.dbManager.getAllAccounts();
      console.log(`从数据库加载了 ${allAccounts.length} 个账号`);

      // 检查是否需要启动自愈
      const lastMaintenanceTime = this.dbManager.getConfig('last_maintenance_time');
      const lastMaintenance = lastMaintenanceTime ? parseInt(lastMaintenanceTime) : null;
      const now = Date.now();

      // 如果上次维护时间不存在或超过维护间隔,触发启动自愈
      const shouldHeal = !lastMaintenance || 
        (now - lastMaintenance) > this.maintenanceIntervalMinutes * 60 * 1000;

      if (shouldHeal) {
        console.log('触发启动自愈维护...');
        await this.performMaintenance();
      } else {
        console.log('无需启动自愈,上次维护时间在间隔内');
      }

      // 对所有 active 状态的账号执行健康检查
      const activeAccounts = allAccounts.filter(acc => acc.status === 'active');
      console.log(`对 ${activeAccounts.length} 个活跃账号执行健康检查...`);

      for (const account of activeAccounts) {
        const isHealthy = await this.maintenanceService.healthCheck(account);
        
        if (isHealthy) {
          this.dbManager.addLog({
            accountId: account.id,
            operation: 'init',
            status: 'success',
            message: '初始化健康检查通过',
          });
        } else {
          // 健康检查失败,标记为 disabled
          this.dbManager.updateAccount(account.id, { status: 'disabled' });
          this.dbManager.addLog({
            accountId: account.id,
            operation: 'init',
            status: 'failed',
            message: '初始化健康检查失败,账号已禁用',
          });
        }
      }

      console.log('账号池初始化完成');
    } catch (error) {
      console.error('账号池初始化失败:', error);
      throw error;
    }
  }

  /**
   * 选择账号
   * 根据选项从账号池中选择合适的账号
   * @param options 账号选择选项
   * @returns 选中的账号或 null
   */
  public selectAccount(options: AccountSelectionOptions): Account | null {
    // 获取所有活跃账号
    const allAccounts = this.dbManager.getAllAccounts();
    const activeAccounts = allAccounts.filter(acc => acc.status === 'active');

    if (activeAccounts.length === 0) {
      console.warn('没有可用的活跃账号');
      return null;
    }

    // 如果需要模型筛选且指定了模型
    let candidateAccounts = activeAccounts;
    if (options.requireModelFilter && options.model) {
      candidateAccounts = this.scheduler.filterByModel(activeAccounts, options.model);
      
      if (candidateAccounts.length === 0) {
        console.warn(`没有账号支持模型: ${options.model}`);
        return null;
      }
    }

    // 使用轮询算法选择账号
    return this.scheduler.roundRobin(candidateAccounts);
  }

  /**
   * 添加账号
   * 添加新账号并验证其有效性
   * @param cookie Cookie 字符串
   * @param supportedModels 支持的模型列表
   * @param note 备注信息
   * @returns 添加的账号对象
   */
  public async addAccount(
    cookie: string,
    supportedModels: string[],
    note: string
  ): Promise<Account> {
    // 创建临时账号对象用于健康检查
    const tempAccount: Account = {
      id: 'temp',
      cookie,
      status: 'active',
      supportedModels,
      note,
      lastUpdated: Date.now(),
    };

    // 执行健康检查
    const isHealthy = await this.maintenanceService.healthCheck(tempAccount);
    
    if (!isHealthy) {
      throw new Error('INVALID_COOKIE: Cookie 验证失败,账号无效');
    }

    // 添加到数据库
    const account = this.dbManager.addAccount({
      cookie,
      status: 'active',
      supportedModels,
      note,
    });

    // 记录日志
    this.dbManager.addLog({
      accountId: account.id,
      operation: 'init',
      status: 'success',
      message: '账号添加成功并通过验证',
    });

    console.log(`账号 ${account.id} 添加成功`);
    return account;
  }

  /**
   * 更新账号状态
   * @param id 账号 ID
   * @param status 新状态
   * @returns 是否更新成功
   */
  public async updateAccountStatus(
    id: string,
    status: 'active' | 'disabled'
  ): Promise<boolean> {
    const account = this.dbManager.getAccount(id);
    
    if (!account) {
      console.warn(`账号 ${id} 不存在`);
      return false;
    }

    // 如果是从 disabled 恢复为 active,需要先执行健康检查
    if (status === 'active' && account.status === 'disabled') {
      const isHealthy = await this.maintenanceService.healthCheck(account);
      
      if (!isHealthy) {
        this.dbManager.addLog({
          accountId: id,
          operation: 'manual_recover',
          status: 'failed',
          message: '手动恢复失败: 健康检查未通过',
        });
        return false;
      }

      // 健康检查通过,记录日志
      this.dbManager.addLog({
        accountId: id,
        operation: 'manual_recover',
        status: 'success',
        message: '手动恢复成功: 健康检查通过',
      });
    }

    // 更新状态
    const updated = this.dbManager.updateAccount(id, { status });
    
    if (updated) {
      console.log(`账号 ${id} 状态更新为 ${status}`);
    }

    return updated;
  }

  /**
   * 移除账号
   * @param id 账号 ID
   * @returns 是否移除成功
   */
  public removeAccount(id: string): boolean {
    const deleted = this.dbManager.deleteAccount(id);
    
    if (deleted) {
      console.log(`账号 ${id} 已删除`);
    } else {
      console.warn(`账号 ${id} 删除失败或不存在`);
    }

    return deleted;
  }

  /**
   * 启动自动维护
   * @param intervalMinutes 维护间隔(分钟)
   */
  public startAutoMaintenance(intervalMinutes: number = 15): void {
    // 如果已有定时器,先停止
    if (this.maintenanceTimer) {
      this.stopAutoMaintenance();
    }

    this.maintenanceIntervalMinutes = intervalMinutes;
    
    // 设置定时器
    const intervalMs = intervalMinutes * 60 * 1000;
    this.maintenanceTimer = setInterval(async () => {
      console.log('执行定时维护...');
      await this.performMaintenance();
    }, intervalMs);

    console.log(`自动维护已启动,间隔: ${intervalMinutes} 分钟`);
  }

  /**
   * 停止自动维护
   */
  public stopAutoMaintenance(): void {
    if (this.maintenanceTimer) {
      clearInterval(this.maintenanceTimer);
      this.maintenanceTimer = null;
      console.log('自动维护已停止');
    }
  }

  /**
   * 执行维护
   * 对所有活跃账号执行保活操作
   */
  public async performMaintenance(): Promise<void> {
    console.log('开始执行维护操作...');

    try {
      // 获取所有活跃账号
      const allAccounts = this.dbManager.getAllAccounts();
      const activeAccounts = allAccounts.filter(acc => acc.status === 'active');

      console.log(`对 ${activeAccounts.length} 个活跃账号执行维护`);

      // 执行批量维护
      const results = await this.maintenanceService.maintainAll(activeAccounts);

      // 统计结果
      const successCount = results.filter(r => r.success).length;
      const failedCount = results.filter(r => !r.success).length;

      console.log(`维护完成: 成功 ${successCount}, 失败 ${failedCount}`);

      // 更新最后维护时间
      this.dbManager.setConfig('last_maintenance_time', Date.now().toString());
    } catch (error) {
      console.error('维护操作失败:', error);
      throw error;
    }
  }

  /**
   * 获取账号池统计信息
   * @returns 统计信息
   */
  public getPoolStats(): PoolStats {
    const allAccounts = this.dbManager.getAllAccounts();
    const activeCount = allAccounts.filter(acc => acc.status === 'active').length;
    const disabledCount = allAccounts.filter(acc => acc.status === 'disabled').length;

    const lastMaintenanceTime = this.dbManager.getConfig('last_maintenance_time');
    const lastMaintenance = lastMaintenanceTime ? parseInt(lastMaintenanceTime) : null;

    return {
      total: allAccounts.length,
      active: activeCount,
      disabled: disabledCount,
      lastMaintenance,
    };
  }

  /**
   * 获取熔断器实例(用于外部调用)
   * @returns 熔断器实例
   */
  public getCircuitBreaker(): CircuitBreaker {
    return this.circuitBreaker;
  }
}
