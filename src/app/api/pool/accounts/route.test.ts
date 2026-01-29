/**
 * 账号池管理 API 属性测试
 * Feature: account-pool-management, Property 7: Cookie 脱敏一致性
 * 验证需求: 10.2
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { DBManager } from '@/lib/pool/db-manager';
import fs from 'fs';

const TEST_DB_PATH = `./data/test-account-pool-${Date.now()}-${Math.random()}.db`;

/**
 * Cookie 脱敏函数（从 route.ts 复制）
 * 只显示前 10 个字符，其余替换为星号
 */
function maskCookie(cookie: string): string {
  if (cookie.length <= 10) {
    return cookie;
  }
  return cookie.slice(0, 10) + '*'.repeat(Math.min(cookie.length - 10, 20));
}

describe('账号池管理 API - 属性测试', () => {
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

    // 创建新的数据库实例
    dbManager = DBManager.getInstance(TEST_DB_PATH);
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

  /**
   * 属性 7: Cookie 脱敏一致性
   * 
   * 对于任何长度大于 10 的 Cookie 字符串，脱敏后的结果应该：
   * 1. 前 10 个字符保持不变
   * 2. 后续字符被替换为星号
   * 3. 星号数量不超过 20 个
   * 4. 总长度为 min(原长度, 30)
   * 
   * **验证需求: 10.2**
   */
  test('属性 7: Cookie 脱敏一致性', () => {
    fc.assert(
      fc.property(
        // 生成长度大于 10 的随机 Cookie 字符串
        fc.string({ minLength: 11, maxLength: 200 }),
        (cookie) => {
          // 执行脱敏
          const masked = maskCookie(cookie);

          // 验证前 10 个字符保持不变
          expect(masked.slice(0, 10)).toBe(cookie.slice(0, 10));

          // 验证后续字符都是星号
          const maskedPart = masked.slice(10);
          expect(maskedPart).toMatch(/^\*+$/);

          // 验证星号数量不超过 20 个
          expect(maskedPart.length).toBeLessThanOrEqual(20);

          // 验证总长度正确
          const expectedLength = Math.min(cookie.length, 30);
          expect(masked.length).toBe(expectedLength);

          // 验证脱敏后的字符串不包含原始 Cookie 的完整内容
          if (cookie.length > 10) {
            expect(masked).not.toBe(cookie);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * 属性 7 的边界情况测试：短 Cookie
   * 
   * 对于长度小于等于 10 的 Cookie，脱敏后应该保持不变
   */
  test('属性 7: 短 Cookie 不脱敏', () => {
    fc.assert(
      fc.property(
        // 生成长度小于等于 10 的随机 Cookie 字符串
        fc.string({ minLength: 1, maxLength: 10 }),
        (cookie) => {
          // 执行脱敏
          const masked = maskCookie(cookie);

          // 验证完全不变
          expect(masked).toBe(cookie);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * 属性 7 的集成测试：通过数据库查询验证脱敏
   * 
   * 对于任何添加到数据库的账号，查询时返回的 Cookie 应该是脱敏的
   */
  test('属性 7: 数据库查询返回脱敏 Cookie', () => {
    fc.assert(
      fc.property(
        // 生成随机账号数据（排除全空格的 Cookie）
        fc.record({
          cookie: fc.string({ minLength: 20, maxLength: 200 }).filter(s => s.trim().length > 0),
          supportedModels: fc.array(
            fc.constantFrom('chirp-crow', 'chirp-v3', 'chirp-v2'),
            { maxLength: 3 }
          ),
          note: fc.string({ maxLength: 100 }),
        }),
        (accountData) => {
          // 添加账号到数据库
          const account = dbManager.addAccount({
            cookie: accountData.cookie,
            status: 'active',
            supportedModels: accountData.supportedModels,
            note: accountData.note,
          });

          // 模拟 API 查询：获取账号并脱敏
          const retrievedAccount = dbManager.getAccount(account.id);
          expect(retrievedAccount).not.toBeNull();

          const maskedCookie = maskCookie(retrievedAccount!.cookie);

          // 验证脱敏后的 Cookie 符合规则
          expect(maskedCookie.slice(0, 10)).toBe(accountData.cookie.slice(0, 10));
          expect(maskedCookie.length).toBeLessThanOrEqual(30);

          // 验证原始 Cookie 未被修改（数据库中仍是完整的）
          expect(retrievedAccount!.cookie).toBe(accountData.cookie);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * 属性 7 的批量测试：多个账号的 Cookie 脱敏
   * 
   * 对于任何账号列表，每个账号的 Cookie 都应该被正确脱敏
   */
  test('属性 7: 批量账号 Cookie 脱敏', () => {
    fc.assert(
      fc.property(
        // 生成随机数量的账号（使用更严格的 Cookie 生成器）
        fc.array(
          fc.record({
            cookie: fc.string({ minLength: 15, maxLength: 150 })
              .filter(s => s.trim().length >= 15), // 确保 trim 后仍然足够长
            supportedModels: fc.array(
              fc.constantFrom('chirp-crow', 'chirp-v3', 'chirp-v2'),
              { maxLength: 3 }
            ),
            note: fc.string({ maxLength: 50 }),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (accountsData) => {
          // 清理之前的测试数据，避免数据污染
          const existingAccounts = dbManager.getAllAccounts();
          existingAccounts.forEach(acc => dbManager.deleteAccount(acc.id));

          // 添加所有账号到数据库
          const addedAccounts = accountsData.map(data =>
            dbManager.addAccount({
              cookie: data.cookie,
              status: 'active',
              supportedModels: data.supportedModels,
              note: data.note,
            })
          );

          // 模拟 API 查询：获取所有账号并脱敏
          const allAccounts = dbManager.getAllAccounts();
          
          // 只验证我们刚添加的账号
          const relevantAccounts = allAccounts.filter(acc => 
            addedAccounts.some(added => added.id === acc.id)
          );

          const maskedAccounts = relevantAccounts.map(account => ({
            ...account,
            cookie: maskCookie(account.cookie),
          }));

          // 验证每个账号的 Cookie 都被正确脱敏
          maskedAccounts.forEach((masked) => {
            // 找到对应的原始数据
            const addedAccount = addedAccounts.find(a => a.id === masked.id);
            expect(addedAccount).toBeDefined();
            
            const original = addedAccount!.cookie;
            
            // 验证前 10 个字符保持不变
            expect(masked.cookie.slice(0, 10)).toBe(original.slice(0, 10));
            
            // 验证脱敏后的长度正确
            expect(masked.cookie.length).toBeLessThanOrEqual(30);
            
            // 验证包含星号
            if (original.length > 10) {
              expect(masked.cookie).toContain('*');
            }
          });

          // 验证数据库中的原始 Cookie 未被修改
          relevantAccounts.forEach((account) => {
            const addedAccount = addedAccounts.find(a => a.id === account.id);
            expect(account.cookie).toBe(addedAccount!.cookie);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * 属性 7 的幂等性测试：多次脱敏结果一致
   * 
   * 对于任何 Cookie，多次脱敏应该得到相同的结果
   */
  test('属性 7: Cookie 脱敏幂等性', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 11, maxLength: 200 }),
        (cookie) => {
          // 执行多次脱敏
          const masked1 = maskCookie(cookie);
          const masked2 = maskCookie(cookie);
          const masked3 = maskCookie(cookie);

          // 验证结果一致
          expect(masked1).toBe(masked2);
          expect(masked2).toBe(masked3);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * 属性 7 的安全性测试：脱敏后无法恢复原始 Cookie
   * 
   * 对于任何 Cookie，脱敏后应该无法通过脱敏结果恢复原始值
   */
  test('属性 7: Cookie 脱敏不可逆', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 11, maxLength: 200 }),
        (cookie) => {
          const masked = maskCookie(cookie);

          // 验证脱敏后的字符串不等于原始字符串
          expect(masked).not.toBe(cookie);

          // 验证脱敏后的字符串包含星号（表示已脱敏）
          expect(masked).toContain('*');

          // 验证脱敏后的字符串不包含原始字符串的完整后半部分
          // 注意：这里只检查后半部分作为完整子串，而不是检查单个字符
          const hiddenPart = cookie.slice(10);
          if (hiddenPart.length > 0 && !hiddenPart.match(/^\*+$/)) {
            // 只有当隐藏部分不全是星号时才检查
            expect(masked.slice(10)).not.toBe(hiddenPart);
          }

          // 验证无法从脱敏结果推断出原始长度（超过 30 的情况）
          if (cookie.length > 30) {
            expect(masked.length).toBe(30);
            // 无法知道原始长度是 31 还是 200
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
