/**
 * 账号池系统集成测试
 * 测试端到端流程和系统集成
 * 
 * 注意: 这些测试跳过了实际的 Suno API 调用和健康检查
 * 在实际环境中,这些功能需要真实的 Cookie 和网络连接
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DBManager } from './db-manager';
import { AccountPool } from './account-pool';
import { promises as fs } from 'fs';
import path from 'path';

describe('账号池系统集成测试', () => {
  let dbManager: DBManager;
  let accountPool: AccountPool;
  let testDbPath: string;

  beforeEach(async () => {
    // 每个测试前创建新的测试数据库
    testDbPath = path.join(
      process.cwd(),
      'data',
      `test-integration-${Date.now()}-${Math.random()}.db`
    );
    dbManager = new DBManager(testDbPath);
    accountPool = new AccountPool(dbManager);
  });

  afterEach(async () => {
    // 每个测试后清理测试数据库
    try {
      // 关闭数据库连接
      (dbManager as any).db.close();
      
      // 等待一小段时间确保文件句柄释放
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 删除测试文件
      await fs.unlink(testDbPath).catch(() => {});
      await fs.unlink(`${testDbPath}-shm`).catch(() => {});
      await fs.unlink(`${testDbPath}-wal`).catch(() => {});
    } catch (error) {
      // 忽略清理错误
    }
  });

  describe('端到端流程: 启动 → 加载账号 → 处理请求 → 返回响应', () => {
    it('应该完成完整的账号添加和选择流程', async () => {
      // 1. 添加测试账号
      const testCookie = '__client=test_token_123; __session=test_session_456';
      const account = dbManager.addAccount({
        cookie: testCookie,
        status: 'active',
        supportedModels: ['chirp-crow'],
        note: '集成测试账号',
      });

      expect(account).toBeDefined();
      expect(account.id).toBeTruthy();

      // 2. 验证账号已保存
      const allAccounts = dbManager.getAllAccounts();
      expect(allAccounts.length).toBe(1);

      // 3. 选择账号
      const selectedAccount = accountPool.selectAccount({
        model: 'chirp-crow',
        requireModelFilter: true,
      });

      expect(selectedAccount).toBeDefined();
      expect(selectedAccount?.id).toBe(account.id);
      expect(selectedAccount?.cookie).toBe(testCookie);
    });
  });

  describe('熔断和重试流程', () => {
    it('应该在账号失败时熔断并切换到其他账号', async () => {
      // 1. 添加两个账号
      const account1 = dbManager.addAccount({
        cookie: '__client=account1_token',
        status: 'active',
        supportedModels: ['chirp-crow'],
        note: '账号 1',
      });

      const account2 = dbManager.addAccount({
        cookie: '__client=account2_token',
        status: 'active',
        supportedModels: ['chirp-crow'],
        note: '账号 2',
      });

      // 2. 选择第一个账号
      const firstSelected = accountPool.selectAccount({
        model: 'chirp-crow',
        requireModelFilter: true,
      });

      expect(firstSelected).toBeDefined();
      const firstAccountId = firstSelected!.id;

      // 3. 触发熔断
      const circuitBreaker = accountPool.getCircuitBreaker();
      circuitBreaker.handleAuthError(firstAccountId, {
        response: { status: 401 },
        message: 'Unauthorized',
      });

      // 4. 验证账号已被禁用
      const disabledAccount = dbManager.getAccount(firstAccountId);
      expect(disabledAccount?.status).toBe('disabled');

      // 5. 再次选择账号,应该返回第二个账号
      const secondSelected = accountPool.selectAccount({
        model: 'chirp-crow',
        requireModelFilter: true,
      });

      expect(secondSelected).toBeDefined();
      expect(secondSelected?.id).not.toBe(firstAccountId);
    });
  });

  describe('配置管理', () => {
    it('应该支持存储和读取配置', async () => {
      // 设置配置
      const testKey = 'test_captcha_key_12345';
      dbManager.setConfig('twocaptcha_key', testKey);

      // 读取配置
      const savedKey = dbManager.getConfig('twocaptcha_key');
      expect(savedKey).toBe(testKey);

      // 更新配置
      dbManager.setConfig('twocaptcha_key', 'new_key');
      const updatedKey = dbManager.getConfig('twocaptcha_key');
      expect(updatedKey).toBe('new_key');
    });
  });

  describe('维护操作', () => {
    it('应该记录维护日志', async () => {
      // 添加账号
      const account = dbManager.addAccount({
        cookie: '__client=maintenance_test',
        status: 'active',
        supportedModels: [],
        note: '维护测试账号',
      });

      // 记录维护日志
      dbManager.addLog({
        accountId: account.id,
        operation: 'maintenance',
        status: 'success',
        message: '维护成功',
      });

      // 查询日志
      const logs = dbManager.getLogs({ accountId: account.id });
      const maintenanceLog = logs.find(log => log.operation === 'maintenance');

      expect(maintenanceLog).toBeDefined();
      expect(maintenanceLog?.status).toBe('success');
    });
  });
});
