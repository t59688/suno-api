/**
 * MaintenanceService 单元测试
 * 验证维护服务的健康检查和保活功能
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { MaintenanceService } from './maintenance-service';
import { DBManager, Account } from './db-manager';
import { sunoApi } from '@/lib/SunoApi';
import fs from 'fs';

// Mock sunoApi 模块
vi.mock('@/lib/SunoApi', () => ({
  sunoApi: vi.fn(),
}));

const TEST_DB_PATH = `./data/test-account-pool-${Date.now()}-${Math.random()}.db`;

describe('MaintenanceService', () => {
  let dbManager: DBManager;
  let maintenanceService: MaintenanceService;
  let mockSunoApi: any;

  beforeEach(() => {
    // 重置单例实例
    DBManager.resetInstance();

    // 清理可能存在的旧测试数据库
    if (fs.existsSync(TEST_DB_PATH)) {
      try {
        fs.unlinkSync(TEST_DB_PATH);
      } catch (e) {
        // 忽略删除错误
      }
    }

    // 创建新的数据库实例
    dbManager = DBManager.getInstance(TEST_DB_PATH);
    maintenanceService = new MaintenanceService(dbManager);

    // 创建 mock SunoApi 实例
    mockSunoApi = {
      getCredits: vi.fn(),
      keepAlive: vi.fn(),
    };

    // 重置 mock
    vi.clearAllMocks();
  });

  afterEach(() => {
    // 关闭数据库连接并重置单例
    DBManager.resetInstance();

    // 清理测试数据库文件
    try {
      if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
      if (fs.existsSync(`${TEST_DB_PATH}-shm`)) fs.unlinkSync(`${TEST_DB_PATH}-shm`);
      if (fs.existsSync(`${TEST_DB_PATH}-wal`)) fs.unlinkSync(`${TEST_DB_PATH}-wal`);
    } catch (e) {
      // 忽略清理错误
    }
  });

  describe('healthCheck', () => {
    test('健康检查成功 - Cookie 有效', async () => {
      // 准备测试账号
      const account: Account = {
        id: 'test-account-1',
        cookie: 'valid-cookie-123',
        status: 'active',
        supportedModels: ['chirp-crow'],
        note: '测试账号',
        lastUpdated: Date.now(),
      };

      // Mock sunoApi 返回成功的实例
      (sunoApi as any).mockResolvedValue(mockSunoApi);
      mockSunoApi.getCredits.mockResolvedValue({
        credits_left: 100,
        period: 'monthly',
        monthly_limit: 500,
        monthly_usage: 400,
      });

      // 执行健康检查
      const result = await maintenanceService.healthCheck(account);

      // 验证结果
      expect(result).toBe(true);
      expect(sunoApi).toHaveBeenCalledWith(account.cookie);
      expect(mockSunoApi.getCredits).toHaveBeenCalled();
    });

    test('健康检查失败 - Cookie 无效', async () => {
      // 准备测试账号
      const account: Account = {
        id: 'test-account-2',
        cookie: 'invalid-cookie-456',
        status: 'active',
        supportedModels: [],
        note: '无效账号',
        lastUpdated: Date.now(),
      };

      // Mock sunoApi 抛出错误
      (sunoApi as any).mockResolvedValue(mockSunoApi);
      mockSunoApi.getCredits.mockRejectedValue(new Error('401 Unauthorized'));

      // 执行健康检查
      const result = await maintenanceService.healthCheck(account);

      // 验证结果
      expect(result).toBe(false);
      expect(sunoApi).toHaveBeenCalledWith(account.cookie);
      expect(mockSunoApi.getCredits).toHaveBeenCalled();
    });

    test('健康检查失败 - 网络错误', async () => {
      // 准备测试账号
      const account: Account = {
        id: 'test-account-3',
        cookie: 'network-error-cookie',
        status: 'active',
        supportedModels: ['chirp-v3'],
        note: '网络错误测试',
        lastUpdated: Date.now(),
      };

      // Mock sunoApi 抛出网络错误
      (sunoApi as any).mockRejectedValue(new Error('Network error'));

      // 执行健康检查
      const result = await maintenanceService.healthCheck(account);

      // 验证结果
      expect(result).toBe(false);
      expect(sunoApi).toHaveBeenCalledWith(account.cookie);
    });
  });

  describe('keepAlive', () => {
    test('保活成功 - 更新 Cookie', async () => {
      // 准备测试账号
      const account: Account = {
        id: 'test-account-4',
        cookie: 'keepalive-cookie-789',
        status: 'active',
        supportedModels: ['chirp-crow', 'chirp-v3'],
        note: '保活测试',
        lastUpdated: Date.now(),
      };

      // Mock sunoApi 返回成功的实例
      (sunoApi as any).mockResolvedValue(mockSunoApi);
      mockSunoApi.keepAlive.mockResolvedValue(undefined);
      mockSunoApi.getCredits.mockResolvedValue({
        credits_left: 50,
        period: 'monthly',
        monthly_limit: 500,
        monthly_usage: 450,
      });

      // 执行保活操作
      const result = await maintenanceService.keepAlive(account);

      // 验证结果
      expect(result.success).toBe(true);
      expect(result.accountId).toBe(account.id);
      expect(result.error).toBeUndefined();
      expect(sunoApi).toHaveBeenCalledWith(account.cookie);
      expect(mockSunoApi.keepAlive).toHaveBeenCalledWith(true);
      expect(mockSunoApi.getCredits).toHaveBeenCalled();
    });

    test('保活失败 - keepAlive 抛出错误', async () => {
      // 准备测试账号
      const account: Account = {
        id: 'test-account-5',
        cookie: 'failed-keepalive-cookie',
        status: 'active',
        supportedModels: [],
        note: '保活失败测试',
        lastUpdated: Date.now(),
      };

      // Mock sunoApi keepAlive 抛出错误
      (sunoApi as any).mockResolvedValue(mockSunoApi);
      mockSunoApi.keepAlive.mockRejectedValue(new Error('Session expired'));

      // 执行保活操作
      const result = await maintenanceService.keepAlive(account);

      // 验证结果
      expect(result.success).toBe(false);
      expect(result.accountId).toBe(account.id);
      expect(result.error).toBe('Session expired');
      expect(sunoApi).toHaveBeenCalledWith(account.cookie);
      expect(mockSunoApi.keepAlive).toHaveBeenCalledWith(true);
    });

    test('保活失败 - getCredits 验证失败', async () => {
      // 准备测试账号
      const account: Account = {
        id: 'test-account-6',
        cookie: 'credits-fail-cookie',
        status: 'active',
        supportedModels: ['chirp-v2'],
        note: 'Credits 验证失败',
        lastUpdated: Date.now(),
      };

      // Mock sunoApi keepAlive 成功但 getCredits 失败
      (sunoApi as any).mockResolvedValue(mockSunoApi);
      mockSunoApi.keepAlive.mockResolvedValue(undefined);
      mockSunoApi.getCredits.mockRejectedValue(new Error('403 Forbidden'));

      // 执行保活操作
      const result = await maintenanceService.keepAlive(account);

      // 验证结果
      expect(result.success).toBe(false);
      expect(result.accountId).toBe(account.id);
      expect(result.error).toBe('403 Forbidden');
      expect(sunoApi).toHaveBeenCalledWith(account.cookie);
      expect(mockSunoApi.keepAlive).toHaveBeenCalledWith(true);
      expect(mockSunoApi.getCredits).toHaveBeenCalled();
    });
  });

  describe('maintainAll', () => {
    test('批量维护 - 所有账号成功', async () => {
      // 准备测试账号
      const account1 = dbManager.addAccount({
        cookie: 'batch-cookie-1',
        status: 'active',
        supportedModels: ['chirp-crow'],
        note: '批量测试账号1',
      });

      const account2 = dbManager.addAccount({
        cookie: 'batch-cookie-2',
        status: 'active',
        supportedModels: ['chirp-v3'],
        note: '批量测试账号2',
      });

      const accounts = [account1, account2];

      // Mock sunoApi 返回成功的实例
      (sunoApi as any).mockResolvedValue(mockSunoApi);
      mockSunoApi.keepAlive.mockResolvedValue(undefined);
      mockSunoApi.getCredits.mockResolvedValue({
        credits_left: 100,
        period: 'monthly',
        monthly_limit: 500,
        monthly_usage: 400,
      });

      // 执行批量维护
      const results = await maintenanceService.maintainAll(accounts);

      // 验证结果
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[0].accountId).toBe(account1.id);
      expect(results[1].success).toBe(true);
      expect(results[1].accountId).toBe(account2.id);

      // 验证日志记录
      const logs = dbManager.getLogs();
      expect(logs).toHaveLength(2);
      expect(logs.every(log => log.status === 'success')).toBe(true);
      expect(logs.every(log => log.operation === 'maintenance')).toBe(true);

      // 验证账号状态未改变（仍然是 active）
      const updatedAccount1 = dbManager.getAccount(account1.id);
      const updatedAccount2 = dbManager.getAccount(account2.id);
      expect(updatedAccount1?.status).toBe('active');
      expect(updatedAccount2?.status).toBe('active');
    });

    test('批量维护 - 部分账号失败', async () => {
      // 准备测试账号
      const account1 = dbManager.addAccount({
        cookie: 'partial-success-cookie-1',
        status: 'active',
        supportedModels: [],
        note: '成功账号',
      });

      const account2 = dbManager.addAccount({
        cookie: 'partial-success-cookie-2',
        status: 'active',
        supportedModels: [],
        note: '失败账号',
      });

      const accounts = [account1, account2];

      // Mock sunoApi - 第一个账号成功，第二个账号失败
      let callCount = 0;
      (sunoApi as any).mockImplementation((cookie) => {
        callCount++;
        if (callCount === 1) {
          // 第一个账号成功
          return Promise.resolve({
            keepAlive: vi.fn().mockResolvedValue(undefined),
            getCredits: vi.fn().mockResolvedValue({ credits_left: 100 }),
          });
        } else {
          // 第二个账号失败
          return Promise.resolve({
            keepAlive: vi.fn().mockRejectedValue(new Error('Auth failed')),
            getCredits: vi.fn(),
          });
        }
      });

      // 执行批量维护
      const results = await maintenanceService.maintainAll(accounts);

      // 验证结果
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[0].accountId).toBe(account1.id);
      expect(results[1].success).toBe(false);
      expect(results[1].accountId).toBe(account2.id);
      expect(results[1].error).toBe('Auth failed');

      // 验证日志记录
      const logs = dbManager.getLogs();
      expect(logs).toHaveLength(2);
      const successLog = logs.find(log => log.accountId === account1.id);
      const failLog = logs.find(log => log.accountId === account2.id);
      expect(successLog?.status).toBe('success');
      expect(failLog?.status).toBe('failed');

      // 验证失败账号被标记为 disabled
      const updatedAccount1 = dbManager.getAccount(account1.id);
      const updatedAccount2 = dbManager.getAccount(account2.id);
      expect(updatedAccount1?.status).toBe('active');
      expect(updatedAccount2?.status).toBe('disabled');
    });

    test('批量维护 - 所有账号失败', async () => {
      // 准备测试账号
      const account1 = dbManager.addAccount({
        cookie: 'all-fail-cookie-1',
        status: 'active',
        supportedModels: ['chirp-crow'],
        note: '失败账号1',
      });

      const account2 = dbManager.addAccount({
        cookie: 'all-fail-cookie-2',
        status: 'active',
        supportedModels: ['chirp-v3'],
        note: '失败账号2',
      });

      const accounts = [account1, account2];

      // Mock sunoApi - 所有账号都失败
      (sunoApi as any).mockResolvedValue(mockSunoApi);
      mockSunoApi.keepAlive.mockRejectedValue(new Error('Service unavailable'));

      // 执行批量维护
      const results = await maintenanceService.maintainAll(accounts);

      // 验证结果
      expect(results).toHaveLength(2);
      expect(results.every(r => r.success === false)).toBe(true);
      expect(results.every(r => r.error === 'Service unavailable')).toBe(true);

      // 验证日志记录
      const logs = dbManager.getLogs();
      expect(logs).toHaveLength(2);
      expect(logs.every(log => log.status === 'failed')).toBe(true);

      // 验证所有账号都被标记为 disabled
      const updatedAccount1 = dbManager.getAccount(account1.id);
      const updatedAccount2 = dbManager.getAccount(account2.id);
      expect(updatedAccount1?.status).toBe('disabled');
      expect(updatedAccount2?.status).toBe('disabled');
    });

    test('批量维护 - 空账号列表', async () => {
      // 执行批量维护（空列表）
      const results = await maintenanceService.maintainAll([]);

      // 验证结果
      expect(results).toHaveLength(0);

      // 验证没有日志记录
      const logs = dbManager.getLogs();
      expect(logs).toHaveLength(0);
    });
  });
});
