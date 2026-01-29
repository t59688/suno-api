/**
 * 账号池系统初始化
 * 在 Next.js 应用启动时自动初始化账号池
 */

import { initializeGlobalPool } from './global-pool';
import { migrateCreditsFields } from './migrate-credits';

// 标记是否已初始化
let initialized = false;

/**
 * 初始化账号池系统
 * 这个函数会在应用启动时自动调用
 */
export async function initAccountPoolSystem() {
  if (initialized) {
    console.log('账号池系统已初始化,跳过重复初始化');
    return;
  }

  try {
    console.log('='.repeat(60));
    console.log('账号池管理系统启动中...');
    console.log('='.repeat(60));

    // 执行数据库迁移
    migrateCreditsFields();

    // 初始化全局账号池
    await initializeGlobalPool();

    initialized = true;

    console.log('='.repeat(60));
    console.log('账号池管理系统启动完成');
    console.log('='.repeat(60));
  } catch (error) {
    console.error('账号池系统初始化失败:', error);
    console.error('应用将继续运行,但账号池功能可能不可用');
    // 不抛出错误,允许应用继续运行
  }
}

// 在模块加载时自动初始化
// 注意: 这会在 Next.js 服务器启动时执行
if (typeof window === 'undefined') {
  // 只在服务器端初始化
  initAccountPoolSystem().catch(error => {
    console.error('账号池系统自动初始化失败:', error);
  });
}
