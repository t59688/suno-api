/**
 * Scheduler 调度器测试
 * 验证负载均衡算法和模型筛选功能
 */

import { Scheduler } from './scheduler';
import { Account } from './db-manager';
import fc from 'fast-check';

describe('Scheduler', () => {
  let scheduler: Scheduler;

  beforeEach(() => {
    scheduler = new Scheduler();
  });

  describe('轮询调度', () => {
    test('空账号列表应该返回 null', () => {
      const result = scheduler.roundRobin([]);
      expect(result).toBeNull();
    });

    test('单个账号应该总是返回该账号', () => {
      const account: Account = {
        id: 'test-1',
        cookie: 'cookie-1',
        status: 'active',
        supportedModels: [],
        note: '',
        lastUpdated: Date.now(),
      };

      const result1 = scheduler.roundRobin([account]);
      const result2 = scheduler.roundRobin([account]);
      const result3 = scheduler.roundRobin([account]);

      expect(result1).toBe(account);
      expect(result2).toBe(account);
      expect(result3).toBe(account);
    });

    test('两个账号应该交替返回', () => {
      const account1: Account = {
        id: 'test-1',
        cookie: 'cookie-1',
        status: 'active',
        supportedModels: [],
        note: '',
        lastUpdated: Date.now(),
      };

      const account2: Account = {
        id: 'test-2',
        cookie: 'cookie-2',
        status: 'active',
        supportedModels: [],
        note: '',
        lastUpdated: Date.now(),
      };

      const accounts = [account1, account2];

      const result1 = scheduler.roundRobin(accounts);
      const result2 = scheduler.roundRobin(accounts);
      const result3 = scheduler.roundRobin(accounts);
      const result4 = scheduler.roundRobin(accounts);

      expect(result1).toBe(account1);
      expect(result2).toBe(account2);
      expect(result3).toBe(account1);
      expect(result4).toBe(account2);
    });
  });

  describe('模型筛选', () => {
    test('空模型列表的账号应该支持所有模型', () => {
      const account: Account = {
        id: 'test-1',
        cookie: 'cookie-1',
        status: 'active',
        supportedModels: [],
        note: '',
        lastUpdated: Date.now(),
      };

      const result = scheduler.filterByModel([account], 'chirp-crow');
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(account);
    });

    test('应该筛选出支持指定模型的账号', () => {
      const account1: Account = {
        id: 'test-1',
        cookie: 'cookie-1',
        status: 'active',
        supportedModels: ['chirp-crow'],
        note: '',
        lastUpdated: Date.now(),
      };

      const account2: Account = {
        id: 'test-2',
        cookie: 'cookie-2',
        status: 'active',
        supportedModels: ['chirp-v3'],
        note: '',
        lastUpdated: Date.now(),
      };

      const result = scheduler.filterByModel([account1, account2], 'chirp-crow');
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(account1);
    });

    test('不支持指定模型的账号应该被过滤掉', () => {
      const account: Account = {
        id: 'test-1',
        cookie: 'cookie-1',
        status: 'active',
        supportedModels: ['chirp-v3'],
        note: '',
        lastUpdated: Date.now(),
      };

      const result = scheduler.filterByModel([account], 'chirp-crow');
      expect(result).toHaveLength(0);
    });
  });

  describe('属性测试 - 轮询算法公平性', () => {
    /**
     * 属性 2: 轮询算法公平性
     * Feature: account-pool-management, Property 2: 轮询算法公平性
     * 验证需求: 5.1, 5.2, 5.4
     * 
     * 对于任何包含 N 个活跃账号的账号池，连续调用 N 次账号选择(不指定模型)，
     * 每个账号应该被选中恰好一次
     */
    test('属性 2: 连续 N 次调用应该公平地选择每个账号恰好一次', () => {
      fc.assert(
        fc.property(
          // 生成 1-10 个随机账号
          fc.array(
            fc.record({
              id: fc.uuid(),
              cookie: fc.string({ minLength: 20, maxLength: 200 }),
              status: fc.constant('active' as const),
              supportedModels: fc.array(
                fc.constantFrom('chirp-crow', 'chirp-v3', 'chirp-v2'),
                { maxLength: 3 }
              ),
              note: fc.string({ maxLength: 100 }),
              lastUpdated: fc.integer({ min: 1000000000000, max: 9999999999999 }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (accounts) => {
            // 重置调度器索引
            scheduler.resetIndex();

            // 记录每个账号被选中的次数
            const selectionCount = new Map<string, number>();
            accounts.forEach(acc => selectionCount.set(acc.id, 0));

            // 连续调用 N 次
            const N = accounts.length;
            for (let i = 0; i < N; i++) {
              const selected = scheduler.roundRobin(accounts);
              
              // 验证返回的账号不为 null
              expect(selected).not.toBeNull();
              
              // 增加该账号的选中计数
              const currentCount = selectionCount.get(selected!.id) || 0;
              selectionCount.set(selected!.id, currentCount + 1);
            }

            // 验证每个账号被选中恰好一次
            accounts.forEach(acc => {
              const count = selectionCount.get(acc.id);
              expect(count).toBe(1);
            });
          }
        ),
        { numRuns: 100 } // 运行 100 次迭代
      );
    });

    /**
     * 属性 2 扩展: 多轮轮询的公平性
     * 验证多轮轮询中每个账号被选中的次数相等
     */
    test('属性 2 扩展: 多轮轮询中每个账号应该被选中相同次数', () => {
      fc.assert(
        fc.property(
          // 生成 2-5 个账号
          fc.array(
            fc.record({
              id: fc.uuid(),
              cookie: fc.string({ minLength: 20, maxLength: 200 }),
              status: fc.constant('active' as const),
              supportedModels: fc.array(
                fc.constantFrom('chirp-crow', 'chirp-v3', 'chirp-v2'),
                { maxLength: 3 }
              ),
              note: fc.string({ maxLength: 100 }),
              lastUpdated: fc.integer({ min: 1000000000000, max: 9999999999999 }),
            }),
            { minLength: 2, maxLength: 5 }
          ),
          // 生成轮数 (2-5 轮)
          fc.integer({ min: 2, max: 5 }),
          (accounts, rounds) => {
            // 重置调度器索引
            scheduler.resetIndex();

            // 记录每个账号被选中的次数
            const selectionCount = new Map<string, number>();
            accounts.forEach(acc => selectionCount.set(acc.id, 0));

            // 执行多轮选择
            const totalSelections = accounts.length * rounds;
            for (let i = 0; i < totalSelections; i++) {
              const selected = scheduler.roundRobin(accounts);
              expect(selected).not.toBeNull();
              
              const currentCount = selectionCount.get(selected!.id) || 0;
              selectionCount.set(selected!.id, currentCount + 1);
            }

            // 验证每个账号被选中的次数相等（都是 rounds 次）
            accounts.forEach(acc => {
              const count = selectionCount.get(acc.id);
              expect(count).toBe(rounds);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * 属性 2 扩展: 轮询顺序的确定性
     * 验证相同的账号列表产生相同的轮询顺序
     */
    test('属性 2 扩展: 相同账号列表应该产生确定的轮询顺序', () => {
      fc.assert(
        fc.property(
          // 生成 2-5 个账号
          fc.array(
            fc.record({
              id: fc.uuid(),
              cookie: fc.string({ minLength: 20, maxLength: 200 }),
              status: fc.constant('active' as const),
              supportedModels: fc.array(
                fc.constantFrom('chirp-crow', 'chirp-v3', 'chirp-v2'),
                { maxLength: 3 }
              ),
              note: fc.string({ maxLength: 100 }),
              lastUpdated: fc.integer({ min: 1000000000000, max: 9999999999999 }),
            }),
            { minLength: 2, maxLength: 5 }
          ),
          (accounts) => {
            // 第一轮选择
            scheduler.resetIndex();
            const firstRound: string[] = [];
            for (let i = 0; i < accounts.length; i++) {
              const selected = scheduler.roundRobin(accounts);
              expect(selected).not.toBeNull();
              firstRound.push(selected!.id);
            }

            // 第二轮选择（应该产生相同的顺序）
            scheduler.resetIndex();
            const secondRound: string[] = [];
            for (let i = 0; i < accounts.length; i++) {
              const selected = scheduler.roundRobin(accounts);
              expect(selected).not.toBeNull();
              secondRound.push(selected!.id);
            }

            // 验证两轮选择的顺序完全相同
            expect(secondRound).toEqual(firstRound);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * 属性 2 扩展: 轮询索引的循环性
     * 验证轮询索引正确循环
     */
    test('属性 2 扩展: 轮询索引应该正确循环', () => {
      fc.assert(
        fc.property(
          // 生成 1-10 个账号
          fc.array(
            fc.record({
              id: fc.uuid(),
              cookie: fc.string({ minLength: 20, maxLength: 200 }),
              status: fc.constant('active' as const),
              supportedModels: fc.array(
                fc.constantFrom('chirp-crow', 'chirp-v3', 'chirp-v2'),
                { maxLength: 3 }
              ),
              note: fc.string({ maxLength: 100 }),
              lastUpdated: fc.integer({ min: 1000000000000, max: 9999999999999 }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (accounts) => {
            // 重置调度器索引
            scheduler.resetIndex();

            const N = accounts.length;
            
            // 第一次选择应该是第一个账号
            const first = scheduler.roundRobin(accounts);
            expect(first).toBe(accounts[0]);

            // 选择 N-1 次，到达最后一个账号
            for (let i = 1; i < N; i++) {
              scheduler.roundRobin(accounts);
            }

            // 下一次选择应该循环回第一个账号
            const cycled = scheduler.roundRobin(accounts);
            expect(cycled).toBe(accounts[0]);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('属性测试 - 模型筛选正确性', () => {
    /**
     * 属性 3: 模型筛选正确性
     * Feature: account-pool-management, Property 3: 模型筛选正确性
     * 验证需求: 6.1, 6.2, 6.3
     * 
     * 对于任何指定模型 M 的请求，返回的账号要么支持模型列表为空(支持所有模型)，
     * 要么支持模型列表包含 M
     */
    test('属性 3: 筛选结果中的账号必须支持指定模型或支持所有模型', () => {
      fc.assert(
        fc.property(
          // 生成随机账号列表
          fc.array(
            fc.record({
              id: fc.uuid(),
              cookie: fc.string({ minLength: 20, maxLength: 200 }),
              status: fc.constant('active' as const),
              supportedModels: fc.array(
                fc.constantFrom('chirp-crow', 'chirp-v3', 'chirp-v2'),
                { maxLength: 3 }
              ),
              note: fc.string({ maxLength: 100 }),
              lastUpdated: fc.integer({ min: 1000000000000, max: 9999999999999 }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          // 生成随机模型名称
          fc.constantFrom('chirp-crow', 'chirp-v3', 'chirp-v2', 'unknown-model'),
          (accounts, model) => {
            // 执行模型筛选
            const filtered = scheduler.filterByModel(accounts, model);

            // 验证筛选结果中的每个账号
            filtered.forEach(account => {
              // 账号要么支持所有模型（supportedModels 为空）
              // 要么支持模型列表包含指定模型
              const supportsAllModels = account.supportedModels.length === 0;
              const supportsSpecificModel = account.supportedModels.includes(model);
              
              expect(supportsAllModels || supportsSpecificModel).toBe(true);
            });
          }
        ),
        { numRuns: 100 } // 运行 100 次迭代
      );
    });

    /**
     * 属性 3 扩展: 筛选结果是原列表的子集
     * 验证筛选结果中的所有账号都来自原始列表
     */
    test('属性 3 扩展: 筛选结果应该是原始账号列表的子集', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              cookie: fc.string({ minLength: 20, maxLength: 200 }),
              status: fc.constant('active' as const),
              supportedModels: fc.array(
                fc.constantFrom('chirp-crow', 'chirp-v3', 'chirp-v2'),
                { maxLength: 3 }
              ),
              note: fc.string({ maxLength: 100 }),
              lastUpdated: fc.integer({ min: 1000000000000, max: 9999999999999 }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          fc.constantFrom('chirp-crow', 'chirp-v3', 'chirp-v2'),
          (accounts, model) => {
            const filtered = scheduler.filterByModel(accounts, model);

            // 验证筛选结果的长度不超过原始列表
            expect(filtered.length).toBeLessThanOrEqual(accounts.length);

            // 验证筛选结果中的每个账号都在原始列表中
            filtered.forEach(filteredAccount => {
              const foundInOriginal = accounts.some(acc => acc.id === filteredAccount.id);
              expect(foundInOriginal).toBe(true);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * 属性 3 扩展: 空模型列表账号总是被包含
     * 验证 supportedModels 为空的账号总是通过筛选
     */
    test('属性 3 扩展: supportedModels 为空的账号应该支持任何模型', () => {
      fc.assert(
        fc.property(
          // 生成至少包含一个空模型列表账号的列表
          fc.array(
            fc.record({
              id: fc.uuid(),
              cookie: fc.string({ minLength: 20, maxLength: 200 }),
              status: fc.constant('active' as const),
              supportedModels: fc.constant([]), // 强制为空数组
              note: fc.string({ maxLength: 100 }),
              lastUpdated: fc.integer({ min: 1000000000000, max: 9999999999999 }),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          fc.constantFrom('chirp-crow', 'chirp-v3', 'chirp-v2', 'unknown-model'),
          (accounts, model) => {
            const filtered = scheduler.filterByModel(accounts, model);

            // 验证所有空模型列表的账号都在筛选结果中
            accounts.forEach(account => {
              if (account.supportedModels.length === 0) {
                const foundInFiltered = filtered.some(acc => acc.id === account.id);
                expect(foundInFiltered).toBe(true);
              }
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * 属性 3 扩展: 不支持模型的账号被排除
     * 验证不支持指定模型的账号不在筛选结果中
     */
    test('属性 3 扩展: 不支持指定模型的账号应该被排除', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              cookie: fc.string({ minLength: 20, maxLength: 200 }),
              status: fc.constant('active' as const),
              supportedModels: fc.array(
                fc.constantFrom('chirp-crow', 'chirp-v3', 'chirp-v2'),
                { minLength: 1, maxLength: 3 } // 至少有一个模型
              ),
              note: fc.string({ maxLength: 100 }),
              lastUpdated: fc.integer({ min: 1000000000000, max: 9999999999999 }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          fc.constantFrom('chirp-crow', 'chirp-v3', 'chirp-v2'),
          (accounts, model) => {
            const filtered = scheduler.filterByModel(accounts, model);

            // 验证不支持指定模型的账号不在筛选结果中
            accounts.forEach(account => {
              const supportsModel = account.supportedModels.includes(model);
              const inFiltered = filtered.some(acc => acc.id === account.id);

              if (!supportsModel) {
                // 如果账号不支持该模型，它不应该在筛选结果中
                expect(inFiltered).toBe(false);
              }
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * 属性 3 扩展: 筛选保持账号顺序
     * 验证筛选操作保持账号在原列表中的相对顺序
     */
    test('属性 3 扩展: 筛选应该保持账号的相对顺序', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              cookie: fc.string({ minLength: 20, maxLength: 200 }),
              status: fc.constant('active' as const),
              supportedModels: fc.array(
                fc.constantFrom('chirp-crow', 'chirp-v3', 'chirp-v2'),
                { maxLength: 3 }
              ),
              note: fc.string({ maxLength: 100 }),
              lastUpdated: fc.integer({ min: 1000000000000, max: 9999999999999 }),
            }),
            { minLength: 2, maxLength: 10 }
          ),
          fc.constantFrom('chirp-crow', 'chirp-v3', 'chirp-v2'),
          (accounts, model) => {
            const filtered = scheduler.filterByModel(accounts, model);

            // 如果筛选结果少于 2 个，无法验证顺序
            if (filtered.length < 2) {
              return;
            }

            // 验证筛选结果中相邻账号在原列表中的相对位置
            for (let i = 0; i < filtered.length - 1; i++) {
              const currentId = filtered[i].id;
              const nextId = filtered[i + 1].id;

              const currentIndex = accounts.findIndex(acc => acc.id === currentId);
              const nextIndex = accounts.findIndex(acc => acc.id === nextId);

              // 当前账号在原列表中的位置应该在下一个账号之前
              expect(currentIndex).toBeLessThan(nextIndex);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
