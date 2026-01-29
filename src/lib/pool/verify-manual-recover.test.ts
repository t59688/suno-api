/**
 * 属性测试: 手动恢复健康检查
 * Feature: account-pool-management, Property 14: 手动恢复健康检查
 * 验证需求: 17.1, 17.2, 17.3
 * 
 * 属性描述:
 * 对于任何从 disabled 状态手动恢复为 active 状态的账号,
 * 系统应该先执行健康检查,只有检查成功才将其加入可用账号列表
 */

import { describe, test, expect, vi } from 'vitest';
import fc from 'fast-check';
import { AccountPool } from './account-pool';
import { DBManager } from './db-manager';
import { sunoApi } from '@/lib/SunoApi';
import fs from 'fs';

// Mock sunoApi 模块
vi.mock('@/lib/SunoApi', () => ({
  sunoApi: vi.fn(),
}));

describe('Property 14: 手动恢复健康检查', () => {
  /**
   * 为每个测试创建独立的数据库路径
   */
  const createTestDbPath = () => `./data/test-manual-recover-${Date.now()}-${Math.random()}.db`;

  /**
   * 清理测试数据库文件
   */
  const cleanupTestDb = (dbPath: string) => {
    try {
      if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
      if (fs.existsSync(`${dbPath}-shm`)) fs.unlinkSync(`${dbPath}-shm`);
      if (fs.existsSync(`${dbPath}-wal`)) fs.unlinkSync(`${dbPath}-wal`);
    } catch (e) {
      // 忽略清理错误
    }
  };

  /**
   * 属性 14: 手动恢复时必须执行健康检查
   * 
   * 对于任何禁用的账号,当尝试手动恢复为 active 状态时:
   * 1. 系统必须先执行健康检查
   * 2. 只有健康检查成功,账号才会被标记为 active
   * 3. 如果健康检查失败,账号应保持 disabled 状态
   * 4. 所有恢复操作都应该记录日志
   */
  test('属性 14: 手动恢复必须执行健康检查且只有成功才恢复', async () => {
    await fc.assert(
      fc.asyncProperty(
        // 生成随机账号数据
        fc.record({
          cookie: fc.string({ minLength: 20, maxLength: 200 }),
          supportedModels: fc.array(
            fc.constantFrom('chirp-crow', 'chirp-v3', 'chirp-v2'),
            { maxLength: 3 }
          ),
          note: fc.string({ maxLength: 100 }),
          healthCheckSuccess: fc.boolean(), // 随机决定健康检查是否成功
        }),
        async (accountData) => {
          // 为每次迭代创建独立的数据库实例
          const testDbPath = createTestDbPath();
          DBManager.resetInstance();
          const dbManager = DBManager.getInstance(testDbPath);
          const accountPool = new AccountPool(dbManager);

          // 创建独立的 mock SunoApi 实例
          const mockSunoApi = {
            getCredits: vi.fn(),
            keepAlive: vi.fn(),
          };

          try {
            // 添加禁用账号
            const account = dbManager.addAccount({
              cookie: accountData.cookie,
              status: 'disabled',
              supportedModels: accountData.supportedModels,
              note: accountData.note,
            });

            // Mock sunoApi 根据 healthCheckSuccess 返回成功或失败
            (sunoApi as any).mockResolvedValue(mockSunoApi);
            
            if (accountData.healthCheckSuccess) {
              mockSunoApi.getCredits.mockResolvedValue({ credits_left: 100 });
            } else {
              mockSunoApi.getCredits.mockRejectedValue(new Error('401 Unauthorized'));
            }

            // 尝试手动恢复账号
            const result = await accountPool.updateAccountStatus(account.id, 'active');

            // 验证健康检查被调用
            expect(sunoApi).toHaveBeenCalledWith(account.cookie);
            expect(mockSunoApi.getCredits).toHaveBeenCalled();

            // 验证恢复结果与健康检查结果一致
            expect(result).toBe(accountData.healthCheckSuccess);

            // 验证账号状态
            const updatedAccount = dbManager.getAccount(account.id);
            if (accountData.healthCheckSuccess) {
              // 健康检查成功,账号应该被恢复为 active
              expect(updatedAccount?.status).toBe('active');
              
              // 验证账号可以被选择
              const selected = accountPool.selectAccount({ requireModelFilter: false });
              expect(selected).not.toBeNull();
              expect(selected?.id).toBe(account.id);
            } else {
              // 健康检查失败,账号应该保持 disabled
              expect(updatedAccount?.status).toBe('disabled');
              
              // 验证账号不能被选择
              const selected = accountPool.selectAccount({ requireModelFilter: false });
              expect(selected).toBeNull();
            }

            // 验证日志记录
            const logs = dbManager.getLogs({ accountId: account.id });
            const recoverLog = logs.find(log => log.operation === 'manual_recover');
            expect(recoverLog).toBeDefined();
            expect(recoverLog?.status).toBe(accountData.healthCheckSuccess ? 'success' : 'failed');
          } finally {
            // 清理资源
            accountPool.stopAutoMaintenance();
            DBManager.resetInstance();
            cleanupTestDb(testDbPath);
            vi.clearAllMocks();
          }
        }
      ),
      { numRuns: 100 } // 运行 100 次迭代
    );
  });

  /**
   * 属性 14.1: 健康检查成功后账号立即可用
   * 
   * 对于任何成功恢复的账号,它应该立即出现在可用账号列表中
   */
  test('属性 14.1: 健康检查成功后账号立即可用', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          cookie: fc.string({ minLength: 20, maxLength: 200 }),
          supportedModels: fc.array(
            fc.constantFrom('chirp-crow', 'chirp-v3', 'chirp-v2'),
            { maxLength: 3 }
          ),
          note: fc.string({ maxLength: 100 }),
        }),
        async (accountData) => {
          // 为每次迭代创建独立的数据库实例
          const testDbPath = createTestDbPath();
          DBManager.resetInstance();
          const dbManager = DBManager.getInstance(testDbPath);
          const accountPool = new AccountPool(dbManager);

          // 创建独立的 mock SunoApi 实例
          const mockSunoApi = {
            getCredits: vi.fn(),
            keepAlive: vi.fn(),
          };

          try {
            // 添加禁用账号
            const account = dbManager.addAccount({
              cookie: accountData.cookie,
              status: 'disabled',
              supportedModels: accountData.supportedModels,
              note: accountData.note,
            });

            // Mock sunoApi 返回成功
            (sunoApi as any).mockResolvedValue(mockSunoApi);
            mockSunoApi.getCredits.mockResolvedValue({ credits_left: 100 });

            // 恢复前验证账号不可用
            const beforeRecover = accountPool.selectAccount({ requireModelFilter: false });
            expect(beforeRecover).toBeNull();

            // 手动恢复账号
            const result = await accountPool.updateAccountStatus(account.id, 'active');
            expect(result).toBe(true);

            // 恢复后验证账号立即可用
            const afterRecover = accountPool.selectAccount({ requireModelFilter: false });
            expect(afterRecover).not.toBeNull();
            expect(afterRecover?.id).toBe(account.id);
            expect(afterRecover?.status).toBe('active');

            // 验证统计信息
            const stats = accountPool.getPoolStats();
            expect(stats.active).toBe(1);
            expect(stats.disabled).toBe(0);
          } finally {
            // 清理资源
            accountPool.stopAutoMaintenance();
            DBManager.resetInstance();
            cleanupTestDb(testDbPath);
            vi.clearAllMocks();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * 属性 14.2: 健康检查失败后账号保持禁用
   * 
   * 对于任何健康检查失败的账号,它应该保持 disabled 状态且不出现在可用列表中
   */
  test('属性 14.2: 健康检查失败后账号保持禁用', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          cookie: fc.string({ minLength: 20, maxLength: 200 }),
          supportedModels: fc.array(
            fc.constantFrom('chirp-crow', 'chirp-v3', 'chirp-v2'),
            { maxLength: 3 }
          ),
          note: fc.string({ maxLength: 100 }),
          errorType: fc.constantFrom('401 Unauthorized', '403 Forbidden', 'Network Error'),
        }),
        async (accountData) => {
          // 为每次迭代创建独立的数据库实例
          const testDbPath = createTestDbPath();
          DBManager.resetInstance();
          const dbManager = DBManager.getInstance(testDbPath);
          const accountPool = new AccountPool(dbManager);

          // 创建独立的 mock SunoApi 实例
          const mockSunoApi = {
            getCredits: vi.fn(),
            keepAlive: vi.fn(),
          };

          try {
            // 添加禁用账号
            const account = dbManager.addAccount({
              cookie: accountData.cookie,
              status: 'disabled',
              supportedModels: accountData.supportedModels,
              note: accountData.note,
            });

            // Mock sunoApi 返回失败
            (sunoApi as any).mockResolvedValue(mockSunoApi);
            mockSunoApi.getCredits.mockRejectedValue(new Error(accountData.errorType));

            // 尝试恢复账号
            const result = await accountPool.updateAccountStatus(account.id, 'active');
            expect(result).toBe(false);

            // 验证账号仍然是 disabled
            const updatedAccount = dbManager.getAccount(account.id);
            expect(updatedAccount?.status).toBe('disabled');

            // 验证账号不可用
            const selected = accountPool.selectAccount({ requireModelFilter: false });
            expect(selected).toBeNull();

            // 验证统计信息
            const stats = accountPool.getPoolStats();
            expect(stats.active).toBe(0);
            expect(stats.disabled).toBe(1);

            // 验证失败日志
            const logs = dbManager.getLogs({ accountId: account.id });
            const recoverLog = logs.find(log => log.operation === 'manual_recover');
            expect(recoverLog).toBeDefined();
            expect(recoverLog?.status).toBe('failed');
            expect(recoverLog?.message).toContain('健康检查未通过');
          } finally {
            // 清理资源
            accountPool.stopAutoMaintenance();
            DBManager.resetInstance();
            cleanupTestDb(testDbPath);
            vi.clearAllMocks();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * 属性 14.3: 多个账号恢复的独立性
   * 
   * 对于多个账号的恢复操作,每个账号的健康检查应该是独立的,
   * 一个账号的失败不应该影响其他账号的恢复
   */
  test('属性 14.3: 多个账号恢复的独立性', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            cookie: fc.string({ minLength: 20, maxLength: 200 }),
            supportedModels: fc.array(
              fc.constantFrom('chirp-crow', 'chirp-v3', 'chirp-v2'),
              { maxLength: 3 }
            ),
            note: fc.string({ maxLength: 100 }),
            healthCheckSuccess: fc.boolean(),
          }),
          { minLength: 2, maxLength: 5 }
        ),
        async (accountsData) => {
          // 为每次迭代创建独立的数据库实例
          const testDbPath = createTestDbPath();
          DBManager.resetInstance();
          const dbManager = DBManager.getInstance(testDbPath);
          const accountPool = new AccountPool(dbManager);

          try {
            // 添加所有禁用账号
            const accounts = accountsData.map(data =>
              dbManager.addAccount({
                cookie: data.cookie,
                status: 'disabled',
                supportedModels: data.supportedModels,
                note: data.note,
              })
            );

            // 尝试恢复所有账号
            const results = await Promise.all(
              accounts.map(async (account, index) => {
                const data = accountsData[index];
                
                // 为每个账号创建独立的 mock SunoApi 实例
                const mockSunoApi = {
                  getCredits: vi.fn(),
                  keepAlive: vi.fn(),
                };
                
                // Mock sunoApi 根据每个账号的 healthCheckSuccess 返回结果
                (sunoApi as any).mockResolvedValue(mockSunoApi);
                
                if (data.healthCheckSuccess) {
                  mockSunoApi.getCredits.mockResolvedValue({ credits_left: 100 });
                } else {
                  mockSunoApi.getCredits.mockRejectedValue(new Error('Health check failed'));
                }

                const result = await accountPool.updateAccountStatus(account.id, 'active');
                
                return { account, result, expectedSuccess: data.healthCheckSuccess };
              })
            );

            // 验证每个账号的恢复结果
            results.forEach(({ account, result, expectedSuccess }) => {
              expect(result).toBe(expectedSuccess);
              
              const updatedAccount = dbManager.getAccount(account.id);
              expect(updatedAccount?.status).toBe(expectedSuccess ? 'active' : 'disabled');
            });

            // 验证统计信息
            const stats = accountPool.getPoolStats();
            const expectedActive = accountsData.filter(d => d.healthCheckSuccess).length;
            const expectedDisabled = accountsData.length - expectedActive;
            
            expect(stats.active).toBe(expectedActive);
            expect(stats.disabled).toBe(expectedDisabled);
            expect(stats.total).toBe(accountsData.length);
          } finally {
            // 清理资源
            accountPool.stopAutoMaintenance();
            DBManager.resetInstance();
            cleanupTestDb(testDbPath);
            vi.clearAllMocks();
          }
        }
      ),
      { numRuns: 50 } // 由于涉及多个账号,减少迭代次数
    );
  });
});
