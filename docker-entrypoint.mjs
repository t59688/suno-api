#!/usr/bin/env node

/**
 * Docker 容器启动前的 Clash 配置脚本
 *
 * 功能：
 * 1. 如果启用代理（ENABLE_PROXY=true）且配置了 CLASH_SUBSCRIBE_URL：
 *    - 添加 / 更新 Clash 订阅
 *    - 切换到指定订阅
 *    - 启用代理模式
 *
 * 注意：
 * - 本脚本只负责 Clash 相关操作，不做数据库迁移（suno-api 不需要）
 * - 真正的应用启动在 docker-entrypoint.sh 中执行
 */

import { execSync } from 'child_process';

// 仅在显式启用代理且配置了订阅地址时执行
if (process.env.ENABLE_PROXY === 'true' && process.env.CLASH_SUBSCRIBE_URL) {
  console.log('🌐 配置 Clash 代理...');

  try {
    const clashctlScript = '/root/clashctl/scripts/cmd/clashctl.sh';
    const subscriptionIndex = process.env.CLASH_SUBSCRIPTION_INDEX || '1';

    // 使用 sudo 来 source 文件（因为文件在 /root 目录下，需要 root 权限）
    const clashCmd = `sudo bash -c 'source ${clashctlScript} && `;

    // 添加订阅
    console.log('📥 添加 Clash 订阅...');
    execSync(`${clashCmd}clashsub add "${process.env.CLASH_SUBSCRIBE_URL}"'`, {
      stdio: 'inherit',
      env: process.env,
    });

    // 更新订阅
    console.log('🔄 更新 Clash 订阅...');
    execSync(`${clashCmd}clashsub update'`, {
      stdio: 'inherit',
      env: process.env,
    });

    // 使用指定订阅（索引从 1 开始）
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
    console.log('   应用将继续启动，但可能无法访问某些被墙资源');
    console.log('   请检查 CLASH_SUBSCRIBE_URL 和 Clash 安装是否正确');
  }

  console.log('');
} else {
  console.log('ℹ️ 未启用代理或未配置 CLASH_SUBSCRIBE_URL，跳过 Clash 配置');
}

