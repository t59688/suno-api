/**
 * 调度器功能验证脚本
 * 演示轮询算法和模型筛选功能
 */

import { Scheduler } from './scheduler';
import { Account } from './db-manager';

// 创建测试账号
const accounts: Account[] = [
  {
    id: 'account-1',
    cookie: 'cookie-1',
    status: 'active',
    supportedModels: ['chirp-crow', 'chirp-v3'],
    note: '账号1 - 支持 crow 和 v3',
    lastUpdated: Date.now(),
  },
  {
    id: 'account-2',
    cookie: 'cookie-2',
    status: 'active',
    supportedModels: ['chirp-v2'],
    note: '账号2 - 仅支持 v2',
    lastUpdated: Date.now(),
  },
  {
    id: 'account-3',
    cookie: 'cookie-3',
    status: 'active',
    supportedModels: [],
    note: '账号3 - 支持所有模型',
    lastUpdated: Date.now(),
  },
  {
    id: 'account-4',
    cookie: 'cookie-4',
    status: 'active',
    supportedModels: ['chirp-crow'],
    note: '账号4 - 仅支持 crow',
    lastUpdated: Date.now(),
  },
];

const scheduler = new Scheduler();

console.log('=== 调度器功能验证 ===\n');

// 1. 测试轮询算法
console.log('1. 轮询算法测试:');
console.log('连续选择 8 次账号（2 轮完整轮询）:\n');

for (let i = 0; i < 8; i++) {
  const selected = scheduler.roundRobin(accounts);
  console.log(`  第 ${i + 1} 次: ${selected?.note}`);
}

console.log('\n');

// 2. 测试模型筛选
console.log('2. 模型筛选测试:\n');

// 筛选支持 chirp-crow 的账号
console.log('筛选支持 "chirp-crow" 的账号:');
const crowAccounts = scheduler.filterByModel(accounts, 'chirp-crow');
crowAccounts.forEach(acc => {
  console.log(`  - ${acc.note}`);
});

console.log('\n筛选支持 "chirp-v2" 的账号:');
const v2Accounts = scheduler.filterByModel(accounts, 'chirp-v2');
v2Accounts.forEach(acc => {
  console.log(`  - ${acc.note}`);
});

console.log('\n筛选支持 "chirp-v3" 的账号:');
const v3Accounts = scheduler.filterByModel(accounts, 'chirp-v3');
v3Accounts.forEach(acc => {
  console.log(`  - ${acc.note}`);
});

console.log('\n');

// 3. 组合测试：先筛选再轮询
console.log('3. 组合测试（先筛选再轮询）:\n');

scheduler.resetIndex();
console.log('从支持 "chirp-crow" 的账号中轮询选择 6 次:');
for (let i = 0; i < 6; i++) {
  const selected = scheduler.roundRobin(crowAccounts);
  console.log(`  第 ${i + 1} 次: ${selected?.note}`);
}

console.log('\n=== 验证完成 ===');
