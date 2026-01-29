/**
 * AccountPool 单元测试
 * 验证账号池管理器的核心功能
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { AccountPool } from './account-pool';
import { DBManager } from './db-manager';
import { sunoApi } from '@/lib/SunoApi';
import fs from 'fs';

// Mock sunoApi 模块
vi.mock('@/lib/SunoApi', () => ({
  sunoApi: vi.fn(),
}));

const TEST_DB_PATH = `./data/test-account-pool-${Date.now()}-${Math.random()}.db`;

describe('AccountPool', () => {
  let dbManager: DBManager;
  let accountPool: AccountPool;
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
    accountPool = new AccountPool(dbManager);

    // 创建 mock SunoApi 实例
    mockSunoApi = {
      getCredits: vi.fn(),
      keepAlive: vi.fn(),
    };

    // 重置 mock
    vi.clearAllMocks();
  });

  afterEach(() => {
    // 停止自动维护
    accountPool.stopAutoMaintenance();

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

  describe('initialize', () => {
    test('应该加载所有账号', async () => {
      // 准备测试数据 - 添加几个账号
      dbManager.addAccount({
        cookie: 'init-cookie-1',
        status: 'active',
        supportedModels: ['chirp-crow'],
        note: '初始化测试账号1',
      });

      dbManager.addAccount({
        cookie: 'init-cookie-2',
        status: 'disabled',
        supportedModels: [],
        note: '初始化测试账号2',
      });

      // Mock sunoApi 返回成功
      (sunoApi as any).mockResolvedValue(mockSunoApi);
      mockSunoApi.getCredits.mockResolvedValue({ credits_left: 100 });

      // 执行初始化
      await accountPool.initialize();

      // 验证账号已加载（通过统计信息）
      const stats = accountPool.getPoolStats();
      expect(stats.total).toBe(2);
    });

    test('应该对活跃账号执行健康检查', async () => {
      // 添加活跃账号
      const account = dbManager.addAccount({
        cookie: 'health-check-cookie',
        status: 'active',
        supportedModels: [],
        note: '健康检查测试',
      });

      // Mock sunoApi 返回成功
      (sunoApi as any).mockResolvedValue(mockSunoApi);
      mockSunoApi.getCredits.mockResolvedValue({ credits_left: 100 });

      // 执行初始化
      await accountPool.initialize();

      // 验证 sunoApi 被调用
      expect(sunoApi).toHaveBeenCalledWith(account.cookie);
      expect(mockSunoApi.getCredits).toHaveBeenCalled();

      // 验证日志记录
      const logs = dbManager.getLogs({ accountId: account.id });
      expect(logs.length).toBeGreaterThan(0);
      const initLog = logs.find(log => log.operation === 'init');
      expect(initLog).toBeDefined();
      expect(initLog?.status).toBe('success');
    });

    test('应该将健康检查失败的账号标记为 disabled', async () => {
      // 添加活跃账号
      const account = dbManager.addAccount({
        cookie: 'failing-cookie',
        status: 'active',
        supportedModels: ['chirp-v3'],
        note: '失败测试',
      });

      // Mock sunoApi 返回失败
      (sunoApi as any).mockResolvedValue(mockSunoApi);
      mockSunoApi.getCredits.mockRejectedValue(new Error('401 Unauthorized'));

      // 执行初始化
      await accountPool.initialize();

      // 验证账号被标记为 disabled
      const updatedAccount = dbManager.getAccount(account.id);
      expect(updatedAccount?.status).toBe('disabled');

      // 验证日志记录
      const logs = dbManager.getLogs({ accountId: account.id });
      const initLog = logs.find(log => log.operation === 'init');
      expect(initLog).toBeDefined();
      expect(initLog?.status).toBe('failed');
    });

    test('应该在超过维护间隔时触发启动自愈', async () => {
      // 设置上次维护时间为 20 分钟前（超过默认 15 分钟间隔）
      const twentyMinutesAgo = Date.now() - 20 * 60 * 1000;
      dbManager.setConfig('last_maintenance_time', twentyMinutesAgo.toString());

      // 添加活跃账号
      dbManager.addAccount({
        cookie: 'heal-cookie',
        status: 'active',
        supportedModels: [],
        note: '自愈测试',
      });

      // Mock sunoApi 返回成功
      (sunoApi as any).mockResolvedValue(mockSunoApi);
      mockSunoApi.getCredits.mockResolvedValue({ credits_left: 100 });
      mockSunoApi.keepAlive.mockResolvedValue(undefined);

      // 执行初始化
      await accountPool.initialize();

      // 验证 keepAlive 被调用（说明触发了维护）
      expect(mockSunoApi.keepAlive).toHaveBeenCalled();

      // 验证最后维护时间被更新
      const lastMaintenance = dbManager.getConfig('last_maintenance_time');
      expect(lastMaintenance).toBeDefined();
      const lastMaintenanceTime = parseInt(lastMaintenance!);
      expect(lastMaintenanceTime).toBeGreaterThan(twentyMinutesAgo);
    });

    test('应该在维护间隔内时跳过启动自愈', async () => {
      // 设置上次维护时间为 5 分钟前（未超过 15 分钟间隔）
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      dbManager.setConfig('last_maintenance_time', fiveMinutesAgo.toString());

      // 添加活跃账号
      dbManager.addAccount({
        cookie: 'no-heal-cookie',
        status: 'active',
        supportedModels: [],
        note: '无需自愈测试',
      });

      // Mock sunoApi 返回成功
      (sunoApi as any).mockResolvedValue(mockSunoApi);
      mockSunoApi.getCredits.mockResolvedValue({ credits_left: 100 });
      mockSunoApi.keepAlive.mockResolvedValue(undefined);

      // 执行初始化
      await accountPool.initialize();

      // 验证 keepAlive 未被调用（说明未触发维护）
      expect(mockSunoApi.keepAlive).not.toHaveBeenCalled();
    });
  });

  describe('selectAccount', () => {
    test('应该从活跃账号中选择', () => {
      // 添加账号
      const account1 = dbManager.addAccount({
        cookie: 'select-cookie-1',
        status: 'active',
        supportedModels: [],
        note: '选择测试1',
      });

      dbManager.addAccount({
        cookie: 'select-cookie-2',
        status: 'disabled',
        supportedModels: [],
        note: '选择测试2（禁用）',
      });

      // 选择账号（不需要模型筛选）
      const selected = accountPool.selectAccount({ requireModelFilter: false });

      // 验证选中了活跃账号
      expect(selected).not.toBeNull();
      expect(selected?.id).toBe(account1.id);
      expect(selected?.status).toBe('active');
    });

    test('应该在没有活跃账号时返回 null', () => {
      // 添加禁用账号
      dbManager.addAccount({
        cookie: 'disabled-cookie',
        status: 'disabled',
        supportedModels: [],
        note: '禁用账号',
      });

      // 选择账号
      const selected = accountPool.selectAccount({ requireModelFilter: false });

      // 验证返回 null
      expect(selected).toBeNull();
    });

    test('应该根据模型筛选账号', () => {
      // 添加支持不同模型的账号
      const account1 = dbManager.addAccount({
        cookie: 'model-cookie-1',
        status: 'active',
        supportedModels: ['chirp-crow'],
        note: '支持 chirp-crow',
      });

      dbManager.addAccount({
        cookie: 'model-cookie-2',
        status: 'active',
        supportedModels: ['chirp-v3'],
        note: '支持 chirp-v3',
      });

      // 选择支持 chirp-crow 的账号
      const selected = accountPool.selectAccount({
        requireModelFilter: true,
        model: 'chirp-crow',
      });

      // 验证选中了正确的账号
      expect(selected).not.toBeNull();
      expect(selected?.id).toBe(account1.id);
      expect(selected?.supportedModels).toContain('chirp-crow');
    });

    test('应该在没有账号支持指定模型时返回 null', () => {
      // 添加账号
      dbManager.addAccount({
        cookie: 'no-model-cookie',
        status: 'active',
        supportedModels: ['chirp-v3'],
        note: '只支持 chirp-v3',
      });

      // 选择支持 chirp-crow 的账号
      const selected = accountPool.selectAccount({
        requireModelFilter: true,
        model: 'chirp-crow',
      });

      // 验证返回 null
      expect(selected).toBeNull();
    });

    test('应该将空模型列表视为支持所有模型', () => {
      // 添加空模型列表的账号
      const account = dbManager.addAccount({
        cookie: 'all-models-cookie',
        status: 'active',
        supportedModels: [],
        note: '支持所有模型',
      });

      // 选择任意模型
      const selected = accountPool.selectAccount({
        requireModelFilter: true,
        model: 'chirp-crow',
      });

      // 验证选中了该账号
      expect(selected).not.toBeNull();
      expect(selected?.id).toBe(account.id);
    });

    test('应该使用轮询算法选择账号', () => {
      // 添加多个账号
      const account1 = dbManager.addAccount({
        cookie: 'robin-cookie-1',
        status: 'active',
        supportedModels: [],
        note: '轮询测试1',
      });

      const account2 = dbManager.addAccount({
        cookie: 'robin-cookie-2',
        status: 'active',
        supportedModels: [],
        note: '轮询测试2',
      });

      // 连续选择两次
      const selected1 = accountPool.selectAccount({ requireModelFilter: false });
      const selected2 = accountPool.selectAccount({ requireModelFilter: false });

      // 验证选中了不同的账号
      expect(selected1?.id).toBe(account1.id);
      expect(selected2?.id).toBe(account2.id);
    });
  });

  describe('addAccount', () => {
    test('应该添加有效账号', async () => {
      // Mock sunoApi 返回成功
      (sunoApi as any).mockResolvedValue(mockSunoApi);
      mockSunoApi.getCredits.mockResolvedValue({ credits_left: 100 });

      // 添加账号
      const account = await accountPool.addAccount(
        'valid-add-cookie',
        ['chirp-crow'],
        '添加测试'
      );

      // 验证账号被添加
      expect(account.id).toBeDefined();
      expect(account.cookie).toBe('valid-add-cookie');
      expect(account.status).toBe('active');
      expect(account.supportedModels).toEqual(['chirp-crow']);
      expect(account.note).toBe('添加测试');

      // 验证可以从数据库查询到
      const retrieved = dbManager.getAccount(account.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.cookie).toBe('valid-add-cookie');

      // 验证日志记录
      const logs = dbManager.getLogs({ accountId: account.id });
      expect(logs.length).toBeGreaterThan(0);
      const initLog = logs.find(log => log.operation === 'init');
      expect(initLog).toBeDefined();
      expect(initLog?.status).toBe('success');
    });

    test('应该拒绝无效 Cookie', async () => {
      // Mock sunoApi 返回失败
      (sunoApi as any).mockResolvedValue(mockSunoApi);
      mockSunoApi.getCredits.mockRejectedValue(new Error('401 Unauthorized'));

      // 尝试添加无效账号
      await expect(
        accountPool.addAccount('invalid-cookie', [], '无效测试')
      ).rejects.toThrow('INVALID_COOKIE');

      // 验证账号未被添加
      const accounts = dbManager.getAllAccounts();
      expect(accounts).toHaveLength(0);
    });
  });

  describe('updateAccountStatus', () => {
    test('应该更新账号状态', async () => {
      // 添加账号
      const account = dbManager.addAccount({
        cookie: 'update-status-cookie',
        status: 'active',
        supportedModels: [],
        note: '状态更新测试',
      });

      // Mock sunoApi（用于健康检查）
      (sunoApi as any).mockResolvedValue(mockSunoApi);
      mockSunoApi.getCredits.mockResolvedValue({ credits_left: 100 });

      // 更新状态为 disabled
      const result = await accountPool.updateAccountStatus(account.id, 'disabled');

      // 验证更新成功
      expect(result).toBe(true);

      // 验证状态已更新
      const updated = dbManager.getAccount(account.id);
      expect(updated?.status).toBe('disabled');
    });

    test('应该在手动恢复时执行健康检查', async () => {
      // 添加禁用账号
      const account = dbManager.addAccount({
        cookie: 'recover-cookie',
        status: 'disabled',
        supportedModels: [],
        note: '恢复测试',
      });

      // Mock sunoApi 返回成功
      (sunoApi as any).mockResolvedValue(mockSunoApi);
      mockSunoApi.getCredits.mockResolvedValue({ credits_left: 100 });

      // 恢复为 active
      const result = await accountPool.updateAccountStatus(account.id, 'active');

      // 验证更新成功
      expect(result).toBe(true);

      // 验证健康检查被调用
      expect(sunoApi).toHaveBeenCalledWith(account.cookie);
      expect(mockSunoApi.getCredits).toHaveBeenCalled();

      // 验证状态已更新
      const updated = dbManager.getAccount(account.id);
      expect(updated?.status).toBe('active');

      // 验证日志记录
      const logs = dbManager.getLogs({ accountId: account.id });
      const recoverLog = logs.find(log => log.operation === 'manual_recover');
      expect(recoverLog).toBeDefined();
      expect(recoverLog?.status).toBe('success');
    });

    test('应该在健康检查失败时拒绝恢复', async () => {
      // 添加禁用账号
      const account = dbManager.addAccount({
        cookie: 'failed-recover-cookie',
        status: 'disabled',
        supportedModels: [],
        note: '恢复失败测试',
      });

      // Mock sunoApi 返回失败
      (sunoApi as any).mockResolvedValue(mockSunoApi);
      mockSunoApi.getCredits.mockRejectedValue(new Error('401 Unauthorized'));

      // 尝试恢复为 active
      const result = await accountPool.updateAccountStatus(account.id, 'active');

      // 验证更新失败
      expect(result).toBe(false);

      // 验证状态未改变
      const updated = dbManager.getAccount(account.id);
      expect(updated?.status).toBe('disabled');

      // 验证日志记录
      const logs = dbManager.getLogs({ accountId: account.id });
      const recoverLog = logs.find(log => log.operation === 'manual_recover');
      expect(recoverLog).toBeDefined();
      expect(recoverLog?.status).toBe('failed');
    });

    test('应该在账号不存在时返回 false', async () => {
      // 尝试更新不存在的账号
      const result = await accountPool.updateAccountStatus('non-existent-id', 'active');

      // 验证返回 false
      expect(result).toBe(false);
    });
  });

  describe('removeAccount', () => {
    test('应该删除账号', () => {
      // 添加账号
      const account = dbManager.addAccount({
        cookie: 'remove-cookie',
        status: 'active',
        supportedModels: [],
        note: '删除测试',
      });

      // 删除账号
      const result = accountPool.removeAccount(account.id);

      // 验证删除成功
      expect(result).toBe(true);

      // 验证账号已被删除
      const retrieved = dbManager.getAccount(account.id);
      expect(retrieved).toBeNull();
    });

    test('应该在账号不存在时返回 false', () => {
      // 尝试删除不存在的账号
      const result = accountPool.removeAccount('non-existent-id');

      // 验证返回 false
      expect(result).toBe(false);
    });
  });

  describe('performMaintenance', () => {
    test('应该对所有活跃账号执行维护', async () => {
      // 添加账号
      const account1 = dbManager.addAccount({
        cookie: 'maintain-cookie-1',
        status: 'active',
        supportedModels: [],
        note: '维护测试1',
      });

      const account2 = dbManager.addAccount({
        cookie: 'maintain-cookie-2',
        status: 'active',
        supportedModels: [],
        note: '维护测试2',
      });

      dbManager.addAccount({
        cookie: 'maintain-cookie-3',
        status: 'disabled',
        supportedModels: [],
        note: '维护测试3（禁用）',
      });

      // Mock sunoApi 返回成功
      (sunoApi as any).mockResolvedValue(mockSunoApi);
      mockSunoApi.keepAlive.mockResolvedValue(undefined);
      mockSunoApi.getCredits.mockResolvedValue({ credits_left: 100 });

      // 执行维护
      await accountPool.performMaintenance();

      // 验证 keepAlive 被调用了 2 次（只对活跃账号）
      expect(mockSunoApi.keepAlive).toHaveBeenCalledTimes(2);

      // 验证最后维护时间被更新
      const lastMaintenance = dbManager.getConfig('last_maintenance_time');
      expect(lastMaintenance).toBeDefined();

      // 验证日志记录
      const logs = dbManager.getLogs();
      const maintenanceLogs = logs.filter(log => log.operation === 'maintenance');
      expect(maintenanceLogs).toHaveLength(2);
    });

    test('应该更新最后维护时间', async () => {
      // 添加账号
      dbManager.addAccount({
        cookie: 'time-update-cookie',
        status: 'active',
        supportedModels: [],
        note: '时间更新测试',
      });

      // Mock sunoApi 返回成功
      (sunoApi as any).mockResolvedValue(mockSunoApi);
      mockSunoApi.keepAlive.mockResolvedValue(undefined);
      mockSunoApi.getCredits.mockResolvedValue({ credits_left: 100 });

      const beforeMaintenance = Date.now();

      // 执行维护
      await accountPool.performMaintenance();

      // 验证最后维护时间被更新
      const lastMaintenance = dbManager.getConfig('last_maintenance_time');
      expect(lastMaintenance).toBeDefined();
      const lastMaintenanceTime = parseInt(lastMaintenance!);
      expect(lastMaintenanceTime).toBeGreaterThanOrEqual(beforeMaintenance);
    });
  });

  describe('startAutoMaintenance & stopAutoMaintenance', () => {
    test('应该启动定时维护', async () => {
      // 添加账号
      dbManager.addAccount({
        cookie: 'auto-maintain-cookie',
        status: 'active',
        supportedModels: [],
        note: '自动维护测试',
      });

      // Mock sunoApi 返回成功
      (sunoApi as any).mockResolvedValue(mockSunoApi);
      mockSunoApi.keepAlive.mockResolvedValue(undefined);
      mockSunoApi.getCredits.mockResolvedValue({ credits_left: 100 });

      // 启动自动维护（设置很短的间隔用于测试，0.01 分钟 = 600ms）
      accountPool.startAutoMaintenance(0.01);

      // 等待定时器触发
      await new Promise(resolve => setTimeout(resolve, 700));

      // 验证维护被执行
      expect(mockSunoApi.keepAlive).toHaveBeenCalled();

      // 停止自动维护
      accountPool.stopAutoMaintenance();
    });

    test('应该停止定时维护', async () => {
      // 启动自动维护
      accountPool.startAutoMaintenance(0.01);

      // 立即停止
      accountPool.stopAutoMaintenance();

      // Mock sunoApi
      (sunoApi as any).mockResolvedValue(mockSunoApi);
      mockSunoApi.keepAlive.mockResolvedValue(undefined);

      // 等待一段时间
      await new Promise(resolve => setTimeout(resolve, 700));

      // 验证维护未被执行
      expect(mockSunoApi.keepAlive).not.toHaveBeenCalled();
    });
  });

  describe('getPoolStats', () => {
    test('应该返回正确的统计信息', () => {
      // 添加账号
      dbManager.addAccount({
        cookie: 'stats-cookie-1',
        status: 'active',
        supportedModels: [],
        note: '统计测试1',
      });

      dbManager.addAccount({
        cookie: 'stats-cookie-2',
        status: 'active',
        supportedModels: [],
        note: '统计测试2',
      });

      dbManager.addAccount({
        cookie: 'stats-cookie-3',
        status: 'disabled',
        supportedModels: [],
        note: '统计测试3',
      });

      // 设置最后维护时间
      const maintenanceTime = Date.now();
      dbManager.setConfig('last_maintenance_time', maintenanceTime.toString());

      // 获取统计信息
      const stats = accountPool.getPoolStats();

      // 验证统计信息
      expect(stats.total).toBe(3);
      expect(stats.active).toBe(2);
      expect(stats.disabled).toBe(1);
      expect(stats.lastMaintenance).toBe(maintenanceTime);
    });

    test('应该在没有维护记录时返回 null', () => {
      // 获取统计信息
      const stats = accountPool.getPoolStats();

      // 验证最后维护时间为 null
      expect(stats.lastMaintenance).toBeNull();
    });
  });

  describe('getCircuitBreaker', () => {
    test('应该返回熔断器实例', () => {
      const circuitBreaker = accountPool.getCircuitBreaker();
      expect(circuitBreaker).toBeDefined();
      expect(typeof circuitBreaker.shouldBreak).toBe('function');
      expect(typeof circuitBreaker.handleAuthError).toBe('function');
    });
  });
});
