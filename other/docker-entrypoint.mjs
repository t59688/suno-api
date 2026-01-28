#!/usr/bin/env node

/**
 * Docker 容器启动脚本
 * 
 * 功能：
 * 1. 配置 clash 代理（如果启用）
 * 2. 运行数据库迁移（prisma migrate deploy）
 * 3. 不创建管理员账号（需要手动执行）
 * 
 * 使用场景：
 * - 首次部署：运行迁移创建表结构
 * - 升级部署：应用新的数据库迁移
 */

import { execSync } from 'child_process';

// 配置 clash 代理（如果启用）
if (process.env.ENABLE_PROXY === 'true' && process.env.CLASH_SUBSCRIBE_URL) {
  console.log('🌐 配置 clash 代理...');
  
  try {
    const clashctlScript = '/root/clashctl/scripts/cmd/clashctl.sh';
    // 使用 sudo 来 source 文件（因为文件在 /root 目录下，需要 root 权限）
    const clashCmd = `sudo bash -c 'source ${clashctlScript} && `;
    
    // 添加订阅
    console.log('📥 添加 clash 订阅...');
    execSync(`${clashCmd}clashsub add "${process.env.CLASH_SUBSCRIBE_URL}"'`, {
      stdio: 'inherit',
      env: process.env,
    });
    
    // 更新订阅
    console.log('🔄 更新 clash 订阅...');
    execSync(`${clashCmd}clashsub update'`, {
      stdio: 'inherit',
      env: process.env,
    });
    
    // 使用第一个订阅（索引从 1 开始）
    const subscriptionIndex = process.env.CLASH_SUBSCRIPTION_INDEX || '1';
    console.log(`📌 使用订阅 ${subscriptionIndex}...`);
    execSync(`${clashCmd}clashsub use ${subscriptionIndex}'`, {
      stdio: 'inherit',
      env: process.env,
    });
    
    // 启用代理模式
    console.log('🔧 启用代理模式...');
    execSync(`${clashCmd}clashctl proxy'`, {
      stdio: 'inherit',
      env: process.env,
    });
    
    console.log('✅ Clash 代理配置完成');
  } catch (error) {
    console.error('⚠️  Clash 代理配置失败:', error.message);
    console.log('   应用将继续启动，但可能无法访问某些资源');
    console.log('   请检查 CLASH_SUBSCRIBE_URL 环境变量是否正确');
  }
  
  console.log('');
}

console.log('🔍 检查数据库连接...');

try {
  // 运行数据库迁移
  console.log('📦 运行数据库迁移...');
  
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: process.env,
  });
  
  console.log('✅ 数据库迁移完成');
} catch (error) {
  console.error('❌ 数据库迁移失败:', error.message);
  console.log('⚠️  应用将继续启动，但某些功能可能不可用');
  console.log('');
  console.log('💡 故障排查：');
  console.log('   1. 检查 DATABASE_URL 环境变量是否正确');
  console.log('   2. 检查数据库服务是否正常运行');
  console.log('   3. 检查数据库用户权限');
  console.log('   4. 查看容器日志: docker-compose logs -f');
}

console.log('');
console.log('⚠️  注意：容器启动不会自动创建管理员账号');
console.log('   首次部署后，请执行以下命令创建管理员：');
console.log('   docker-compose exec app node scripts/production-init.mjs');
console.log('   或单独创建管理员：');
console.log('   docker-compose exec app node scripts/seed-super-admin.mjs');
console.log('');
