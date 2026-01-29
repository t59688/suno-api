/**
 * DBManager 验证脚本
 * 用于验证数据库管理器的基本功能
 */

import { DBManager } from './db-manager';
import fs from 'fs';

const TEST_DB_PATH = './data/verify-account-pool.db';

async function verify() {
  console.log('开始验证 DBManager...\n');

  // 清理测试数据库
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }

  try {
    // 1. 测试数据库初始化
    console.log('✓ 测试 1: 数据库初始化');
    const dbManager = DBManager.getInstance(TEST_DB_PATH);
    console.log('  数据库初始化成功\n');

    // 2. 测试添加账号
    console.log('✓ 测试 2: 添加账号');
    const account1 = dbManager.addAccount({
      cookie: 'test-cookie-123456789',
      status: 'active',
      supportedModels: ['chirp-crow', 'chirp-v3'],
      note: '测试账号 1',
    });
    console.log(`  账号 ID: ${account1.id}`);
    console.log(`  Cookie: ${account1.cookie}`);
    console.log(`  状态: ${account1.status}`);
    console.log(`  支持模型: ${account1.supportedModels.join(', ')}\n`);

    // 3. 测试查询账号
    console.log('✓ 测试 3: 查询账号');
    const retrieved = dbManager.getAccount(account1.id);
    if (retrieved && retrieved.id === account1.id) {
      console.log('  查询成功，数据一致\n');
    } else {
      throw new Error('查询失败或数据不一致');
    }

    // 4. 测试添加多个账号
    console.log('✓ 测试 4: 添加多个账号');
    dbManager.addAccount({
      cookie: 'test-cookie-987654321',
      status: 'disabled',
      supportedModels: [],
      note: '测试账号 2',
    });
    const allAccounts = dbManager.getAllAccounts();
    console.log(`  总账号数: ${allAccounts.length}\n`);

    // 5. 测试更新账号
    console.log('✓ 测试 5: 更新账号状态');
    const updated = dbManager.updateAccount(account1.id, {
      status: 'disabled',
      note: '已禁用的测试账号',
    });
    if (updated) {
      const updatedAccount = dbManager.getAccount(account1.id);
      console.log(`  更新后状态: ${updatedAccount?.status}`);
      console.log(`  更新后备注: ${updatedAccount?.note}\n`);
    }

    // 6. 测试系统配置
    console.log('✓ 测试 6: 系统配置');
    dbManager.setConfig('twocaptcha_key', 'test-api-key-12345');
    const configValue = dbManager.getConfig('twocaptcha_key');
    console.log(`  配置值: ${configValue}\n`);

    // 7. 测试日志
    console.log('✓ 测试 7: 添加日志');
    dbManager.addLog({
      accountId: account1.id,
      operation: 'init',
      status: 'success',
      message: '初始化验证成功',
    });
    const logs = dbManager.getLogs({ limit: 10 });
    console.log(`  日志数量: ${logs.length}`);
    if (logs.length > 0) {
      console.log(`  最新日志: ${logs[0].operation} - ${logs[0].message}\n`);
    }

    // 8. 测试删除账号
    console.log('✓ 测试 8: 删除账号');
    const account2 = dbManager.addAccount({
      cookie: 'to-be-deleted',
      status: 'active',
      supportedModels: [],
      note: '待删除账号',
    });
    const deleted = dbManager.deleteAccount(account2.id);
    const afterDelete = dbManager.getAccount(account2.id);
    if (deleted && !afterDelete) {
      console.log('  删除成功\n');
    } else {
      throw new Error('删除失败');
    }

    // 9. 测试事务
    console.log('✓ 测试 9: 事务操作');
    const txResult = dbManager.transaction(() => {
      dbManager.addAccount({
        cookie: 'tx-cookie-1',
        status: 'active',
        supportedModels: [],
        note: '事务测试 1',
      });
      dbManager.addAccount({
        cookie: 'tx-cookie-2',
        status: 'active',
        supportedModels: [],
        note: '事务测试 2',
      });
      return 'success';
    });
    console.log(`  事务结果: ${txResult}\n`);

    // 10. 最终统计
    console.log('✓ 测试 10: 最终统计');
    const finalAccounts = dbManager.getAllAccounts();
    const activeCount = finalAccounts.filter(a => a.status === 'active').length;
    const disabledCount = finalAccounts.filter(a => a.status === 'disabled').length;
    console.log(`  总账号数: ${finalAccounts.length}`);
    console.log(`  活跃账号: ${activeCount}`);
    console.log(`  禁用账号: ${disabledCount}\n`);

    // 关闭数据库
    dbManager.close();

    console.log('✅ 所有测试通过！\n');
    console.log('数据库文件位置:', TEST_DB_PATH);

  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    process.exit(1);
  }
}

// 运行验证
verify();
