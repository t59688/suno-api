import { NextRequest, NextResponse } from 'next/server';
import { DBManager } from '@/lib/pool/db-manager';
import { AccountPool } from '@/lib/pool/account-pool';
import { AuthMiddleware } from '@/lib/pool/auth-middleware';

// 初始化单例实例
const dbManager = DBManager.getInstance();
const accountPool = new AccountPool(dbManager);
const authMiddleware = new AuthMiddleware(dbManager);

/**
 * POST /api/pool/maintenance
 * 立即触发全量维护操作
 */
export async function POST(req: NextRequest) {
  try {
    // 认证检查
    const authError = await authMiddleware.middleware(req);
    if (authError) {
      return authError;
    }

    console.log('收到手动维护请求');

    // 记录维护开始时间
    const startTime = Date.now();

    // 执行维护
    await accountPool.performMaintenance();

    // 计算维护耗时
    const duration = Date.now() - startTime;

    // 获取维护后的统计信息
    const stats = accountPool.getPoolStats();

    // 获取最近的维护日志
    const recentLogs = dbManager.getLogs({ limit: 10 });
    const maintenanceLogs = recentLogs.filter(log => log.operation === 'maintenance');

    // 统计维护结果
    const successCount = maintenanceLogs.filter(log => log.status === 'success').length;
    const failedCount = maintenanceLogs.filter(log => log.status === 'failed').length;

    console.log(`维护完成: 成功 ${successCount}, 失败 ${failedCount}, 耗时 ${duration}ms`);

    return NextResponse.json({
      success: true,
      message: '维护操作已完成',
      result: {
        duration,
        stats: {
          total: stats.total,
          active: stats.active,
          disabled: stats.disabled,
          lastMaintenance: stats.lastMaintenance,
        },
        maintenanceResults: {
          success: successCount,
          failed: failedCount,
        },
      },
    });
  } catch (error: any) {
    console.error('触发维护失败:', error);
    return NextResponse.json(
      { error: '触发维护失败', details: error.message },
      { status: 500 }
    );
  }
}
