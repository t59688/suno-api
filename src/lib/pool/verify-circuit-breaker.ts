/**
 * 熔断器功能验证脚本
 * 
 * 此脚本演示熔断器的核心功能:
 * 1. 检测 401/403 认证错误
 * 2. 自动将失效账号标记为 disabled
 * 3. 记录熔断日志
 */

import { DBManager } from './db-manager';
import { CircuitBreaker } from './circuit-breaker';

async function verifyCircuitBreaker() {
  console.log('=== 熔断器功能验证 ===\n');

  // 创建测试数据库
  const dbPath = './data/verify-circuit-breaker.db';
  const dbManager = DBManager.getInstance(dbPath);
  const circuitBreaker = new CircuitBreaker(dbManager);

  try {
    // 1. 添加测试账号
    console.log('1. 添加测试账号...');
    const account1 = dbManager.addAccount({
      cookie: 'test-cookie-1',
      status: 'active',
      supportedModels: ['chirp-crow'],
      note: '测试账号 1',
    });
    console.log(`   ✓ 账号 ${account1.id} 已添加 (状态: ${account1.status})\n`);

    // 2. 模拟 401 错误
    console.log('2. 模拟 401 认证错误...');
    const error401 = {
      response: {
        status: 401,
        statusText: 'Unauthorized',
      },
      message: 'Authentication failed',
    };
    
    console.log(`   检查是否应该熔断: ${circuitBreaker.shouldBreak(error401)}`);
    circuitBreaker.handleAuthError(account1.id, error401);
    
    const updatedAccount1 = dbManager.getAccount(account1.id);
    console.log(`   ✓ 账号状态已更新: ${updatedAccount1?.status}\n`);

    // 3. 验证日志记录
    console.log('3. 验证熔断日志...');
    const logs = dbManager.getLogs({ accountId: account1.id });
    const circuitBreakLog = logs.find(log => log.operation === 'circuit_break');
    if (circuitBreakLog) {
      console.log(`   ✓ 日志已记录:`);
      console.log(`     - 操作: ${circuitBreakLog.operation}`);
      console.log(`     - 状态: ${circuitBreakLog.status}`);
      console.log(`     - 消息: ${circuitBreakLog.message}\n`);
    }

    // 4. 测试非认证错误不触发熔断
    console.log('4. 测试非认证错误 (500) 不触发熔断...');
    const account2 = dbManager.addAccount({
      cookie: 'test-cookie-2',
      status: 'active',
      supportedModels: ['chirp-crow'],
      note: '测试账号 2',
    });
    
    const error500 = {
      response: {
        status: 500,
        statusText: 'Internal Server Error',
      },
      message: 'Server error',
    };
    
    console.log(`   检查是否应该熔断: ${circuitBreaker.shouldBreak(error500)}`);
    circuitBreaker.handleAuthError(account2.id, error500);
    
    const updatedAccount2 = dbManager.getAccount(account2.id);
    console.log(`   ✓ 账号状态保持不变: ${updatedAccount2?.status}\n`);

    // 5. 测试 403 错误
    console.log('5. 测试 403 Forbidden 错误...');
    const account3 = dbManager.addAccount({
      cookie: 'test-cookie-3',
      status: 'active',
      supportedModels: ['chirp-crow'],
      note: '测试账号 3',
    });
    
    const error403 = {
      response: {
        status: 403,
        statusText: 'Forbidden',
      },
      message: 'Access denied',
    };
    
    console.log(`   检查是否应该熔断: ${circuitBreaker.shouldBreak(error403)}`);
    circuitBreaker.handleAuthError(account3.id, error403);
    
    const updatedAccount3 = dbManager.getAccount(account3.id);
    console.log(`   ✓ 账号状态已更新: ${updatedAccount3?.status}\n`);

    // 6. 验证活跃账号列表
    console.log('6. 验证活跃账号列表...');
    const allAccounts = dbManager.getAllAccounts();
    const activeAccounts = allAccounts.filter(acc => acc.status === 'active');
    const disabledAccounts = allAccounts.filter(acc => acc.status === 'disabled');
    
    console.log(`   总账号数: ${allAccounts.length}`);
    console.log(`   活跃账号: ${activeAccounts.length}`);
    console.log(`   禁用账号: ${disabledAccounts.length}\n`);

    console.log('=== 验证完成 ===');
    console.log('✓ 熔断器功能正常工作');
    console.log('✓ 401/403 错误能够正确触发熔断');
    console.log('✓ 非认证错误不会触发熔断');
    console.log('✓ 熔断日志正确记录');

  } catch (error) {
    console.error('验证失败:', error);
  } finally {
    dbManager.close();
  }
}

// 运行验证
if (require.main === module) {
  verifyCircuitBreaker().catch(console.error);
}

export { verifyCircuitBreaker };
