import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { CircuitBreaker } from './circuit-breaker';
import { DBManager, Account } from './db-manager';
import fs from 'fs';
import path from 'path';

describe('CircuitBreaker 属性测试', () => {
  let dbManager: DBManager;
  let circuitBreaker: CircuitBreaker;
  let testDbPath: string;

  beforeEach(() => {
    // 为每个测试创建独立的数据库
    testDbPath = path.join(
      process.cwd(),
      'data',
      `test-circuit-breaker-${Date.now()}-${Math.random()}.db`
    );
    
    // 重置单例
    DBManager.resetInstance();
    
    // 创建新的数据库实例
    dbManager = DBManager.getInstance(testDbPath);
    circuitBreaker = new CircuitBreaker(dbManager);
  });

  afterEach(() => {
    // 清理测试数据库
    try {
      dbManager.close();
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
      }
      // 清理 WAL 和 SHM 文件
      const walPath = `${testDbPath}-wal`;
      const shmPath = `${testDbPath}-shm`;
      if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
      if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
    } catch (err) {
      console.error('清理测试数据库失败:', err);
    }
    
    // 重置单例
    DBManager.resetInstance();
  });

  /**
   * 属性 4: 熔断器隔离性
   * Feature: account-pool-management, Property 4: 熔断器隔离性
   * 验证需求: 8.1, 8.2, 8.3
   * 
   * 对于任何账号,当其在请求中返回 401 或 403 错误时,
   * 该账号的状态应该立即变为 disabled,且后续的账号选择不应该返回该账号
   */
  it('属性 4: 熔断器隔离性 - 401/403 错误应该立即禁用账号', () => {
    fc.assert(
      fc.property(
        // 生成随机账号数据
        fc.record({
          cookie: fc.string({ minLength: 20, maxLength: 200 }),
          supportedModels: fc.array(
            fc.constantFrom('chirp-crow', 'chirp-v3', 'chirp-v2'),
            { maxLength: 3 }
          ),
          note: fc.string({ maxLength: 100 }),
        }),
        // 生成 401 或 403 错误状态码
        fc.constantFrom(401, 403),
        (accountData, errorStatus) => {
          // 添加一个 active 状态的账号
          const account = dbManager.addAccount({
            cookie: accountData.cookie,
            status: 'active',
            supportedModels: accountData.supportedModels,
            note: accountData.note,
          });

          // 验证账号初始状态为 active
          expect(account.status).toBe('active');

          // 模拟认证错误
          const error = {
            response: {
              status: errorStatus,
              statusText: errorStatus === 401 ? 'Unauthorized' : 'Forbidden',
            },
            message: `HTTP ${errorStatus} error`,
          };

          // 触发熔断
          circuitBreaker.handleAuthError(account.id, error);

          // 验证账号状态已变为 disabled
          const updatedAccount = dbManager.getAccount(account.id);
          expect(updatedAccount).not.toBeNull();
          expect(updatedAccount!.status).toBe('disabled');

          // 验证日志已记录
          const logs = dbManager.getLogs({ accountId: account.id });
          const circuitBreakLog = logs.find(log => log.operation === 'circuit_break');
          expect(circuitBreakLog).toBeDefined();
          expect(circuitBreakLog!.status).toBe('success');
          expect(circuitBreakLog!.message).toContain(String(errorStatus));

          // 验证后续查询只返回 active 账号时不包含该账号
          const allAccounts = dbManager.getAllAccounts();
          const activeAccounts = allAccounts.filter(acc => acc.status === 'active');
          expect(activeAccounts.every(acc => acc.id !== account.id)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('属性 4 补充: 非认证错误不应触发熔断', () => {
    fc.assert(
      fc.property(
        // 生成随机账号数据
        fc.record({
          cookie: fc.string({ minLength: 20, maxLength: 200 }),
          supportedModels: fc.array(
            fc.constantFrom('chirp-crow', 'chirp-v3', 'chirp-v2'),
            { maxLength: 3 }
          ),
          note: fc.string({ maxLength: 100 }),
        }),
        // 生成非 401/403 的错误状态码
        fc.constantFrom(400, 404, 500, 502, 503),
        (accountData, errorStatus) => {
          // 添加一个 active 状态的账号
          const account = dbManager.addAccount({
            cookie: accountData.cookie,
            status: 'active',
            supportedModels: accountData.supportedModels,
            note: accountData.note,
          });

          // 验证账号初始状态为 active
          expect(account.status).toBe('active');

          // 模拟非认证错误
          const error = {
            response: {
              status: errorStatus,
              statusText: 'Error',
            },
            message: `HTTP ${errorStatus} error`,
          };

          // 尝试触发熔断
          circuitBreaker.handleAuthError(account.id, error);

          // 验证账号状态仍为 active
          const updatedAccount = dbManager.getAccount(account.id);
          expect(updatedAccount).not.toBeNull();
          expect(updatedAccount!.status).toBe('active');

          // 验证没有熔断日志
          const logs = dbManager.getLogs({ accountId: account.id });
          const circuitBreakLog = logs.find(log => log.operation === 'circuit_break');
          expect(circuitBreakLog).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('属性 4 补充: 已禁用的账号不应重复熔断', () => {
    fc.assert(
      fc.property(
        // 生成随机账号数据
        fc.record({
          cookie: fc.string({ minLength: 20, maxLength: 200 }),
          supportedModels: fc.array(
            fc.constantFrom('chirp-crow', 'chirp-v3', 'chirp-v2'),
            { maxLength: 3 }
          ),
          note: fc.string({ maxLength: 100 }),
        }),
        (accountData) => {
          // 添加一个 disabled 状态的账号
          const account = dbManager.addAccount({
            cookie: accountData.cookie,
            status: 'disabled',
            supportedModels: accountData.supportedModels,
            note: accountData.note,
          });

          // 验证账号初始状态为 disabled
          expect(account.status).toBe('disabled');

          // 模拟认证错误
          const error = {
            response: {
              status: 401,
              statusText: 'Unauthorized',
            },
            message: 'HTTP 401 error',
          };

          // 尝试触发熔断
          circuitBreaker.handleAuthError(account.id, error);

          // 验证账号状态仍为 disabled
          const updatedAccount = dbManager.getAccount(account.id);
          expect(updatedAccount).not.toBeNull();
          expect(updatedAccount!.status).toBe('disabled');

          // 验证没有新的熔断日志(因为账号已经是 disabled)
          const logs = dbManager.getLogs({ accountId: account.id });
          const circuitBreakLogs = logs.filter(log => log.operation === 'circuit_break');
          expect(circuitBreakLogs.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
