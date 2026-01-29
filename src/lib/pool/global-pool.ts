/**
 * 全局账号池单例
 * 在应用启动时初始化,提供全局访问
 */

import { AccountPool } from './account-pool';
import { DBManager } from './db-manager';
import path from 'path';

// 全局账号池实例
let globalAccountPool: AccountPool | null = null;
let isInitializing = false;
let initPromise: Promise<AccountPool> | null = null;

/**
 * 初始化全局账号池
 * 只会初始化一次,后续调用返回已初始化的实例
 * @returns Promise<AccountPool> 账号池实例
 */
export async function initializeGlobalPool(): Promise<AccountPool> {
  // 如果已经初始化,直接返回
  if (globalAccountPool) {
    return globalAccountPool;
  }

  // 如果正在初始化,等待初始化完成
  if (isInitializing && initPromise) {
    return initPromise;
  }

  // 开始初始化
  isInitializing = true;
  initPromise = (async () => {
    try {
      console.log('开始初始化全局账号池...');

      // 创建数据库管理器
      const dbPath = path.join(process.cwd(), 'data', 'account-pool.db');
      const dbManager = DBManager.getInstance(dbPath);

      // 创建账号池
      const pool = new AccountPool(dbManager);

      // 初始化账号池
      await pool.initialize();

      // 启动自动维护(默认 15 分钟)
      const maintenanceInterval = parseInt(process.env.POOL_MAINTENANCE_INTERVAL || '15');
      pool.startAutoMaintenance(maintenanceInterval);

      console.log(`全局账号池初始化完成,自动维护间隔: ${maintenanceInterval} 分钟`);

      globalAccountPool = pool;
      return pool;
    } catch (error) {
      console.error('全局账号池初始化失败:', error);
      throw error;
    } finally {
      isInitializing = false;
      initPromise = null;
    }
  })();

  return initPromise;
}

/**
 * 获取全局账号池实例
 * 如果未初始化,会自动初始化
 * @returns Promise<AccountPool> 账号池实例
 */
export async function getGlobalPool(): Promise<AccountPool> {
  if (!globalAccountPool) {
    return initializeGlobalPool();
  }
  return globalAccountPool;
}

/**
 * 停止全局账号池(用于测试或应用关闭)
 */
export function stopGlobalPool(): void {
  if (globalAccountPool) {
    globalAccountPool.stopAutoMaintenance();
    globalAccountPool = null;
    console.log('全局账号池已停止');
  }
}
