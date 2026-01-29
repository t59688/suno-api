/**
 * DBManager 基本功能测试
 * 验证数据库管理器的核心 CRUD 操作
 */

import { DBManager, Account } from './db-manager';
import fs from 'fs';
import path from 'path';
import fc from 'fast-check';

// 测试数据库路径
const TEST_DB_PATH = './data/test-account-pool.db';

describe('DBManager', () => {
  let dbManager: DBManager;

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
    if (fs.existsSync(`${TEST_DB_PATH}-shm`)) {
      try {
        fs.unlinkSync(`${TEST_DB_PATH}-shm`);
      } catch (e) {
        // 忽略删除错误
      }
    }
    if (fs.existsSync(`${TEST_DB_PATH}-wal`)) {
      try {
        fs.unlinkSync(`${TEST_DB_PATH}-wal`);
      } catch (e) {
        // 忽略删除错误
      }
    }

    // 创建新的数据库实例
    dbManager = DBManager.getInstance(TEST_DB_PATH);
  });

  afterEach(() => {
    // 关闭数据库连接并重置单例
    DBManager.resetInstance();
  });

  describe('账号管理', () => {
    test('应该能够添加账号', () => {
      const account = dbManager.addAccount({
        cookie: 'test-cookie-123',
        status: 'active',
        supportedModels: ['chirp-crow'],
        note: '测试账号',
      });

      expect(account.id).toBeDefined();
      expect(account.cookie).toBe('test-cookie-123');
      expect(account.status).toBe('active');
      expect(account.supportedModels).toEqual(['chirp-crow']);
      expect(account.note).toBe('测试账号');
      expect(account.lastUpdated).toBeGreaterThan(0);
    });

    test('应该能够查询账号', () => {
      const added = dbManager.addAccount({
        cookie: 'test-cookie-456',
        status: 'active',
        supportedModels: [],
        note: '',
      });

      const retrieved = dbManager.getAccount(added.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(added.id);
      expect(retrieved?.cookie).toBe('test-cookie-456');
    });

    test('应该能够获取所有账号', () => {
      dbManager.addAccount({
        cookie: 'cookie-1',
        status: 'active',
        supportedModels: [],
        note: '',
      });

      dbManager.addAccount({
        cookie: 'cookie-2',
        status: 'disabled',
        supportedModels: ['chirp-v3'],
        note: '账号2',
      });

      const accounts = dbManager.getAllAccounts();
      expect(accounts).toHaveLength(2);
    });

    test('应该能够更新账号', () => {
      const account = dbManager.addAccount({
        cookie: 'original-cookie',
        status: 'active',
        supportedModels: [],
        note: '',
      });

      const updated = dbManager.updateAccount(account.id, {
        status: 'disabled',
        note: '已禁用',
      });

      expect(updated).toBe(true);

      const retrieved = dbManager.getAccount(account.id);
      expect(retrieved?.status).toBe('disabled');
      expect(retrieved?.note).toBe('已禁用');
      expect(retrieved?.cookie).toBe('original-cookie'); // 未更新的字段保持不变
    });

    test('应该能够删除账号', () => {
      const account = dbManager.addAccount({
        cookie: 'to-be-deleted',
        status: 'active',
        supportedModels: [],
        note: '',
      });

      const deleted = dbManager.deleteAccount(account.id);
      expect(deleted).toBe(true);

      const retrieved = dbManager.getAccount(account.id);
      expect(retrieved).toBeNull();
    });
  });

  describe('系统配置', () => {
    test('应该能够设置和获取配置', () => {
      dbManager.setConfig('test_key', 'test_value');
      const value = dbManager.getConfig('test_key');
      expect(value).toBe('test_value');
    });

    test('应该能够更新配置', () => {
      dbManager.setConfig('update_key', 'old_value');
      dbManager.setConfig('update_key', 'new_value');
      const value = dbManager.getConfig('update_key');
      expect(value).toBe('new_value');
    });

    test('不存在的配置应该返回 null', () => {
      const value = dbManager.getConfig('non_existent_key');
      expect(value).toBeNull();
    });
  });

  describe('日志管理', () => {
    test('应该能够添加日志', () => {
      const account = dbManager.addAccount({
        cookie: 'log-test-cookie',
        status: 'active',
        supportedModels: [],
        note: '',
      });

      dbManager.addLog({
        accountId: account.id,
        operation: 'init',
        status: 'success',
        message: '初始化成功',
      });

      const logs = dbManager.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].accountId).toBe(account.id);
      expect(logs[0].operation).toBe('init');
      expect(logs[0].status).toBe('success');
    });

    test('应该能够按账号 ID 筛选日志', () => {
      const account1 = dbManager.addAccount({
        cookie: 'cookie-1',
        status: 'active',
        supportedModels: [],
        note: '',
      });

      const account2 = dbManager.addAccount({
        cookie: 'cookie-2',
        status: 'active',
        supportedModels: [],
        note: '',
      });

      dbManager.addLog({
        accountId: account1.id,
        operation: 'maintenance',
        status: 'success',
        message: '维护成功',
      });

      dbManager.addLog({
        accountId: account2.id,
        operation: 'maintenance',
        status: 'failed',
        message: '维护失败',
      });

      const logs = dbManager.getLogs({ accountId: account1.id });
      expect(logs).toHaveLength(1);
      expect(logs[0].accountId).toBe(account1.id);
    });

    test('应该能够分页查询日志', () => {
      const account = dbManager.addAccount({
        cookie: 'pagination-test',
        status: 'active',
        supportedModels: [],
        note: '',
      });

      // 添加多条日志
      for (let i = 0; i < 5; i++) {
        dbManager.addLog({
          accountId: account.id,
          operation: 'test',
          status: 'success',
          message: `日志 ${i}`,
        });
      }

      const page1 = dbManager.getLogs({ limit: 2, offset: 0 });
      expect(page1).toHaveLength(2);

      const page2 = dbManager.getLogs({ limit: 2, offset: 2 });
      expect(page2).toHaveLength(2);
    });
  });

  describe('事务', () => {
    test('应该能够执行事务', () => {
      const result = dbManager.transaction(() => {
        dbManager.addAccount({
          cookie: 'tx-cookie-1',
          status: 'active',
          supportedModels: [],
          note: '',
        });

        dbManager.addAccount({
          cookie: 'tx-cookie-2',
          status: 'active',
          supportedModels: [],
          note: '',
        });

        return 'success';
      });

      expect(result).toBe('success');
      const accounts = dbManager.getAllAccounts();
      expect(accounts).toHaveLength(2);
    });
  });

  describe('属性测试 - 数据库持久化一致性', () => {
    /**
     * 属性 1: 数据库持久化一致性
     * Feature: account-pool-management, Property 1: 数据库持久化一致性
     * 验证需求: 3.1, 3.2, 3.3
     * 
     * 对于任何账号数据，当添加到数据库后立即查询，应该返回相同的账号信息
     * （包括 ID、Cookie、状态、支持模型、备注）
     */
    test('属性 1: 添加账号后立即查询应返回一致的数据', () => {
      fc.assert(
        fc.property(
          // 生成随机账号数据
          fc.record({
            cookie: fc.string({ minLength: 20, maxLength: 200 }),
            status: fc.constantFrom('active' as const, 'disabled' as const),
            supportedModels: fc.array(
              fc.constantFrom('chirp-crow', 'chirp-v3', 'chirp-v2'),
              { maxLength: 3 }
            ),
            note: fc.string({ maxLength: 100 }),
          }),
          (accountData) => {
            // 1. 添加账号到数据库
            const addedAccount = dbManager.addAccount(accountData);

            // 2. 立即查询该账号
            const retrievedAccount = dbManager.getAccount(addedAccount.id);

            // 3. 验证查询结果不为空
            expect(retrievedAccount).not.toBeNull();

            // 4. 验证所有字段一致性
            expect(retrievedAccount!.id).toBe(addedAccount.id);
            expect(retrievedAccount!.cookie).toBe(accountData.cookie);
            expect(retrievedAccount!.status).toBe(accountData.status);
            expect(retrievedAccount!.supportedModels).toEqual(accountData.supportedModels);
            expect(retrievedAccount!.note).toBe(accountData.note);
            expect(retrievedAccount!.lastUpdated).toBe(addedAccount.lastUpdated);

            // 5. 验证通过 getAllAccounts 也能查询到
            const allAccounts = dbManager.getAllAccounts();
            const foundInList = allAccounts.find(acc => acc.id === addedAccount.id);
            expect(foundInList).toBeDefined();
            expect(foundInList!.cookie).toBe(accountData.cookie);
            expect(foundInList!.status).toBe(accountData.status);
            expect(foundInList!.supportedModels).toEqual(accountData.supportedModels);
            expect(foundInList!.note).toBe(accountData.note);
          }
        ),
        { numRuns: 100 } // 运行 100 次迭代
      );
    });

    /**
     * 属性 1 扩展: 批量添加场景
     * 验证多个账号添加后的持久化一致性
     */
    test('属性 1 扩展: 批量添加多个账号后都能正确查询', () => {
      fc.assert(
        fc.property(
          // 生成 1-10 个随机账号
          fc.array(
            fc.record({
              cookie: fc.string({ minLength: 20, maxLength: 200 }),
              status: fc.constantFrom('active' as const, 'disabled' as const),
              supportedModels: fc.array(
                fc.constantFrom('chirp-crow', 'chirp-v3', 'chirp-v2'),
                { maxLength: 3 }
              ),
              note: fc.string({ maxLength: 100 }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (accountsData) => {
            // 1. 批量添加账号
            const addedAccounts = accountsData.map(data => dbManager.addAccount(data));

            // 2. 验证每个账号都能单独查询到
            addedAccounts.forEach((addedAccount, index) => {
              const retrieved = dbManager.getAccount(addedAccount.id);
              expect(retrieved).not.toBeNull();
              expect(retrieved!.cookie).toBe(accountsData[index].cookie);
              expect(retrieved!.status).toBe(accountsData[index].status);
              expect(retrieved!.supportedModels).toEqual(accountsData[index].supportedModels);
              expect(retrieved!.note).toBe(accountsData[index].note);
            });

            // 3. 验证 getAllAccounts 返回所有账号
            const allAccounts = dbManager.getAllAccounts();
            expect(allAccounts.length).toBeGreaterThanOrEqual(addedAccounts.length);

            // 4. 验证每个添加的账号都在列表中
            addedAccounts.forEach((addedAccount, index) => {
              const found = allAccounts.find(acc => acc.id === addedAccount.id);
              expect(found).toBeDefined();
              expect(found!.cookie).toBe(accountsData[index].cookie);
              expect(found!.status).toBe(accountsData[index].status);
              expect(found!.supportedModels).toEqual(accountsData[index].supportedModels);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * 属性 1 扩展: 更新后的持久化一致性
     * 验证账号更新后查询结果的一致性
     */
    test('属性 1 扩展: 更新账号后查询应返回更新后的数据', () => {
      fc.assert(
        fc.property(
          // 原始账号数据
          fc.record({
            cookie: fc.string({ minLength: 20, maxLength: 200 }),
            status: fc.constantFrom('active' as const, 'disabled' as const),
            supportedModels: fc.array(
              fc.constantFrom('chirp-crow', 'chirp-v3', 'chirp-v2'),
              { maxLength: 3 }
            ),
            note: fc.string({ maxLength: 100 }),
          }),
          // 更新数据
          fc.record({
            newCookie: fc.option(fc.string({ minLength: 20, maxLength: 200 })),
            newStatus: fc.option(fc.constantFrom('active' as const, 'disabled' as const)),
            newModels: fc.option(fc.array(
              fc.constantFrom('chirp-crow', 'chirp-v3', 'chirp-v2'),
              { maxLength: 3 }
            )),
            newNote: fc.option(fc.string({ maxLength: 100 })),
          }),
          (originalData, updateData) => {
            // 1. 添加原始账号
            const addedAccount = dbManager.addAccount(originalData);
            const originalLastUpdated = addedAccount.lastUpdated;

            // 2. 构建更新对象（只包含非 null 的字段）
            const updates: any = {};
            if (updateData.newCookie !== null) updates.cookie = updateData.newCookie;
            if (updateData.newStatus !== null) updates.status = updateData.newStatus;
            if (updateData.newModels !== null) updates.supportedModels = updateData.newModels;
            if (updateData.newNote !== null) updates.note = updateData.newNote;

            // 如果没有任何更新，跳过此测试
            if (Object.keys(updates).length === 0) {
              return;
            }

            // 3. 更新账号
            const updateResult = dbManager.updateAccount(addedAccount.id, updates);
            expect(updateResult).toBe(true);

            // 4. 查询更新后的账号
            const retrievedAccount = dbManager.getAccount(addedAccount.id);
            expect(retrievedAccount).not.toBeNull();

            // 5. 验证更新的字段
            if (updates.cookie !== undefined) {
              expect(retrievedAccount!.cookie).toBe(updates.cookie);
            } else {
              expect(retrievedAccount!.cookie).toBe(originalData.cookie);
            }

            if (updates.status !== undefined) {
              expect(retrievedAccount!.status).toBe(updates.status);
            } else {
              expect(retrievedAccount!.status).toBe(originalData.status);
            }

            if (updates.supportedModels !== undefined) {
              expect(retrievedAccount!.supportedModels).toEqual(updates.supportedModels);
            } else {
              expect(retrievedAccount!.supportedModels).toEqual(originalData.supportedModels);
            }

            if (updates.note !== undefined) {
              expect(retrievedAccount!.note).toBe(updates.note);
            } else {
              expect(retrievedAccount!.note).toBe(originalData.note);
            }

            // 6. 验证 lastUpdated 已更新（可能在同一毫秒内，所以使用 >= ）
            expect(retrievedAccount!.lastUpdated).toBeGreaterThanOrEqual(originalLastUpdated);

            // 7. 验证 ID 保持不变
            expect(retrievedAccount!.id).toBe(addedAccount.id);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * 属性 1 扩展: 事务中的持久化一致性
     * 验证在事务中添加的账号能够正确持久化
     */
    test('属性 1 扩展: 事务中添加的账号应该正确持久化', () => {
      fc.assert(
        fc.property(
          // 生成 2-5 个随机账号
          fc.array(
            fc.record({
              cookie: fc.string({ minLength: 20, maxLength: 200 }),
              status: fc.constantFrom('active' as const, 'disabled' as const),
              supportedModels: fc.array(
                fc.constantFrom('chirp-crow', 'chirp-v3', 'chirp-v2'),
                { maxLength: 3 }
              ),
              note: fc.string({ maxLength: 100 }),
            }),
            { minLength: 2, maxLength: 5 }
          ),
          (accountsData) => {
            // 1. 在事务中批量添加账号
            const addedAccounts = dbManager.transaction(() => {
              return accountsData.map(data => dbManager.addAccount(data));
            });

            // 2. 验证事务返回了正确数量的账号
            expect(addedAccounts.length).toBe(accountsData.length);

            // 3. 验证每个账号都能查询到且数据一致
            addedAccounts.forEach((addedAccount, index) => {
              const retrieved = dbManager.getAccount(addedAccount.id);
              expect(retrieved).not.toBeNull();
              expect(retrieved!.id).toBe(addedAccount.id);
              expect(retrieved!.cookie).toBe(accountsData[index].cookie);
              expect(retrieved!.status).toBe(accountsData[index].status);
              expect(retrieved!.supportedModels).toEqual(accountsData[index].supportedModels);
              expect(retrieved!.note).toBe(accountsData[index].note);
            });

            // 4. 验证所有账号都在 getAllAccounts 中
            const allAccounts = dbManager.getAllAccounts();
            addedAccounts.forEach(addedAccount => {
              const found = allAccounts.find(acc => acc.id === addedAccount.id);
              expect(found).toBeDefined();
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('属性测试 - 配置更新即时生效', () => {
    /**
     * 属性 5: 配置更新即时生效
     * Feature: account-pool-management, Property 5: 配置更新即时生效
     * 验证需求: 1.1, 1.2, 1.4
     * 
     * 对于任何系统配置项，更新后立即查询应该返回新值，无需重启系统
     */
    test('属性 5: 更新配置后立即查询应返回新值', () => {
      fc.assert(
        fc.property(
          // 生成随机配置键值对
          fc.record({
            key: fc.string({ minLength: 1, maxLength: 50 }),
            value: fc.string({ maxLength: 200 }),
          }),
          (configData) => {
            // 1. 设置配置
            dbManager.setConfig(configData.key, configData.value);

            // 2. 立即查询配置
            const retrievedValue = dbManager.getConfig(configData.key);

            // 3. 验证查询结果与设置的值一致
            expect(retrievedValue).toBe(configData.value);
          }
        ),
        { numRuns: 100 } // 运行 100 次迭代
      );
    });

    /**
     * 属性 5 扩展: 配置更新覆盖旧值
     * 验证配置更新能够正确覆盖旧值
     */
    test('属性 5 扩展: 多次更新同一配置键应该覆盖旧值', () => {
      fc.assert(
        fc.property(
          // 生成配置键和多个值
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.array(fc.string({ maxLength: 200 }), { minLength: 2, maxLength: 5 }),
          (key, values) => {
            // 1. 依次设置多个值
            values.forEach(value => {
              dbManager.setConfig(key, value);
              
              // 2. 每次设置后立即查询，应该返回最新值
              const retrieved = dbManager.getConfig(key);
              expect(retrieved).toBe(value);
            });

            // 3. 最终查询应该返回最后一个值
            const finalValue = dbManager.getConfig(key);
            expect(finalValue).toBe(values[values.length - 1]);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * 属性 5 扩展: 批量配置独立性
     * 验证多个配置项之间互不干扰
     */
    test('属性 5 扩展: 多个配置项应该独立存储和查询', () => {
      fc.assert(
        fc.property(
          // 生成多个不同的配置项
          fc.array(
            fc.record({
              key: fc.string({ minLength: 1, maxLength: 50 }),
              value: fc.string({ maxLength: 200 }),
            }),
            { minLength: 2, maxLength: 10 }
          ),
          (configs) => {
            // 确保所有键都是唯一的
            const uniqueConfigs = configs.filter((config, index, self) =>
              index === self.findIndex(c => c.key === config.key)
            );

            // 如果去重后少于 2 个，跳过此测试
            if (uniqueConfigs.length < 2) {
              return;
            }

            // 1. 设置所有配置
            uniqueConfigs.forEach(config => {
              dbManager.setConfig(config.key, config.value);
            });

            // 2. 验证每个配置都能正确查询到
            uniqueConfigs.forEach(config => {
              const retrieved = dbManager.getConfig(config.key);
              expect(retrieved).toBe(config.value);
            });

            // 3. 更新其中一个配置
            const toUpdate = uniqueConfigs[0];
            const newValue = `updated_${toUpdate.value}`;
            dbManager.setConfig(toUpdate.key, newValue);

            // 4. 验证更新的配置返回新值
            const updatedValue = dbManager.getConfig(toUpdate.key);
            expect(updatedValue).toBe(newValue);

            // 5. 验证其他配置不受影响
            uniqueConfigs.slice(1).forEach(config => {
              const retrieved = dbManager.getConfig(config.key);
              expect(retrieved).toBe(config.value);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * 属性 5 扩展: 配置持久化
     * 验证配置在数据库中正确持久化（通过重新获取实例验证）
     */
    test('属性 5 扩展: 配置应该持久化到数据库', () => {
      fc.assert(
        fc.property(
          fc.record({
            key: fc.string({ minLength: 1, maxLength: 50 }),
            value: fc.string({ maxLength: 200 }),
          }),
          (configData) => {
            // 1. 设置配置
            dbManager.setConfig(configData.key, configData.value);

            // 2. 立即查询验证
            const immediate = dbManager.getConfig(configData.key);
            expect(immediate).toBe(configData.value);

            // 3. 通过同一实例再次查询（模拟后续访问）
            const later = dbManager.getConfig(configData.key);
            expect(later).toBe(configData.value);

            // 4. 验证值保持一致
            expect(later).toBe(immediate);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('属性测试 - 删除操作完整性', () => {
    /**
     * 属性 8: 删除操作完整性
     * Feature: account-pool-management, Property 8: 删除操作完整性
     * 验证需求: 10.4
     * 
     * 对于任何被删除的账号，删除后该账号不应该出现在数据库查询结果中
     */
    test('属性 8: 删除账号后无法通过任何方式查询到该账号', () => {
      fc.assert(
        fc.property(
          // 生成随机账号数据
          fc.record({
            cookie: fc.string({ minLength: 20, maxLength: 200 }),
            status: fc.constantFrom('active' as const, 'disabled' as const),
            supportedModels: fc.array(
              fc.constantFrom('chirp-crow', 'chirp-v3', 'chirp-v2'),
              { maxLength: 3 }
            ),
            note: fc.string({ maxLength: 100 }),
          }),
          (accountData) => {
            // 1. 添加账号
            const addedAccount = dbManager.addAccount(accountData);
            const accountId = addedAccount.id;

            // 2. 验证账号存在
            const beforeDelete = dbManager.getAccount(accountId);
            expect(beforeDelete).not.toBeNull();
            expect(beforeDelete?.id).toBe(accountId);

            // 3. 删除账号
            const deleteResult = dbManager.deleteAccount(accountId);
            expect(deleteResult).toBe(true);

            // 4. 验证通过 getAccount 无法查询到
            const afterDeleteById = dbManager.getAccount(accountId);
            expect(afterDeleteById).toBeNull();

            // 5. 验证通过 getAllAccounts 无法查询到
            const allAccounts = dbManager.getAllAccounts();
            const foundInList = allAccounts.find(acc => acc.id === accountId);
            expect(foundInList).toBeUndefined();

            // 6. 验证删除操作是幂等的（再次删除返回 false）
            const deleteAgain = dbManager.deleteAccount(accountId);
            expect(deleteAgain).toBe(false);
          }
        ),
        { numRuns: 100 } // 运行 100 次迭代
      );
    });

    /**
     * 属性 8 扩展: 批量删除场景
     * 验证多个账号删除后的完整性
     */
    test('属性 8 扩展: 批量删除多个账号后都无法查询到', () => {
      fc.assert(
        fc.property(
          // 生成 1-5 个随机账号
          fc.array(
            fc.record({
              cookie: fc.string({ minLength: 20, maxLength: 200 }),
              status: fc.constantFrom('active' as const, 'disabled' as const),
              supportedModels: fc.array(
                fc.constantFrom('chirp-crow', 'chirp-v3', 'chirp-v2'),
                { maxLength: 3 }
              ),
              note: fc.string({ maxLength: 100 }),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          (accountsData) => {
            // 1. 添加所有账号
            const addedAccounts = accountsData.map(data => dbManager.addAccount(data));
            const accountIds = addedAccounts.map(acc => acc.id);

            // 2. 验证所有账号都存在
            const beforeDeleteCount = dbManager.getAllAccounts().length;
            expect(beforeDeleteCount).toBeGreaterThanOrEqual(accountIds.length);

            // 3. 删除所有账号
            accountIds.forEach(id => {
              const deleted = dbManager.deleteAccount(id);
              expect(deleted).toBe(true);
            });

            // 4. 验证所有账号都无法通过 getAccount 查询到
            accountIds.forEach(id => {
              const account = dbManager.getAccount(id);
              expect(account).toBeNull();
            });

            // 5. 验证所有账号都不在 getAllAccounts 结果中
            const afterDeleteAccounts = dbManager.getAllAccounts();
            accountIds.forEach(id => {
              const found = afterDeleteAccounts.find(acc => acc.id === id);
              expect(found).toBeUndefined();
            });

            // 6. 验证账号数量减少了正确的数量
            const afterDeleteCount = afterDeleteAccounts.length;
            expect(afterDeleteCount).toBe(beforeDeleteCount - accountIds.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * 属性 8 扩展: 删除后更新操作应该失败
     * 验证删除的账号无法被更新
     */
    test('属性 8 扩展: 删除后的账号无法被更新', () => {
      fc.assert(
        fc.property(
          fc.record({
            cookie: fc.string({ minLength: 20, maxLength: 200 }),
            status: fc.constantFrom('active' as const, 'disabled' as const),
            supportedModels: fc.array(
              fc.constantFrom('chirp-crow', 'chirp-v3', 'chirp-v2'),
              { maxLength: 3 }
            ),
            note: fc.string({ maxLength: 100 }),
          }),
          fc.record({
            newStatus: fc.constantFrom('active' as const, 'disabled' as const),
            newNote: fc.string({ maxLength: 100 }),
          }),
          (accountData, updateData) => {
            // 1. 添加账号
            const account = dbManager.addAccount(accountData);
            const accountId = account.id;

            // 2. 删除账号
            const deleted = dbManager.deleteAccount(accountId);
            expect(deleted).toBe(true);

            // 3. 尝试更新已删除的账号
            const updateResult = dbManager.updateAccount(accountId, {
              status: updateData.newStatus,
              note: updateData.newNote,
            });

            // 4. 更新应该失败（返回 false）
            expect(updateResult).toBe(false);

            // 5. 验证账号仍然不存在
            const account2 = dbManager.getAccount(accountId);
            expect(account2).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
