/**
 * 账号池 API 辅助函数
 * 提供从账号池获取 SunoApi 实例的便捷方法
 */

import { sunoApi } from '../SunoApi';
import { getGlobalPool } from './global-pool';
import { AccountSelectionOptions } from './account-pool';

/**
 * 从账号池获取 SunoApi 实例
 * @param options 账号选择选项
 * @returns Promise<SunoApi> SunoApi 实例
 * @throws Error 如果没有可用账号
 */
export async function getSunoApiFromPool(options: AccountSelectionOptions) {
  const pool = await getGlobalPool();
  
  // 从账号池选择账号
  const account = pool.selectAccount(options);
  
  if (!account) {
    if (options.requireModelFilter && options.model) {
      throw new Error(`NO_AVAILABLE_ACCOUNTS: 没有账号支持模型 ${options.model}`);
    } else {
      throw new Error('NO_AVAILABLE_ACCOUNTS: 账号池中没有可用账号');
    }
  }

  // 获取 TWOCAPTCHA_KEY 配置
  const dbManager = (pool as any).dbManager;
  const twocaptchaKey = dbManager.getConfig('twocaptcha_key') || process.env.TWOCAPTCHA_KEY;

  // 创建 SunoApi 实例
  const api = await sunoApi(account.cookie, twocaptchaKey);
  
  return { api, account };
}

/**
 * 带重试机制的 API 调用
 * 当账号失败时自动切换到其他账号重试
 * @param options 账号选择选项
 * @param apiCall API 调用函数
 * @param maxRetries 最大重试次数,默认 3
 * @returns Promise<T> API 调用结果
 */
export async function callWithRetry<T>(
  options: AccountSelectionOptions,
  apiCall: (api: any) => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  const pool = await getGlobalPool();
  const circuitBreaker = pool.getCircuitBreaker();
  
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const { api, account } = await getSunoApiFromPool(options);
      
      // 执行 API 调用
      const result = await apiCall(api);
      
      // 成功,记录日志
      if (attempt > 0) {
        console.log(`重试成功: 使用账号 ${account.id}, 尝试次数 ${attempt + 1}`);
      }
      
      return result;
    } catch (error: any) {
      lastError = error;
      
      // 检查是否是认证错误
      if (circuitBreaker.shouldBreak(error)) {
        // 获取当前账号并熔断
        const { account } = await getSunoApiFromPool(options);
        circuitBreaker.handleAuthError(account.id, error);
        
        console.log(`账号 ${account.id} 认证失败,已熔断,尝试切换账号...`);
        
        // 如果还有重试机会,继续
        if (attempt < maxRetries - 1) {
          continue;
        }
      }
      
      // 非认证错误或已达最大重试次数,抛出错误
      throw error;
    }
  }
  
  // 所有重试都失败
  throw lastError || new Error('API 调用失败: 已达最大重试次数');
}
