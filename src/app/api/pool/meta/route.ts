import { NextRequest, NextResponse } from 'next/server';
import { DBManager } from '@/lib/pool/db-manager';
import { AccountPool } from '@/lib/pool/account-pool';
import { AuthMiddleware } from '@/lib/pool/auth-middleware';

// 初始化单例实例
const dbManager = DBManager.getInstance();
const accountPool = new AccountPool(dbManager);
const authMiddleware = new AuthMiddleware(dbManager);

/**
 * GET /api/pool/meta
 * 获取账号池元数据和统计信息
 */
export async function GET(req: NextRequest) {
  try {
    // 认证检查
    const authError = await authMiddleware.middleware(req);
    if (authError) {
      return authError;
    }

    // 获取统计信息
    const stats = accountPool.getPoolStats();

    // 获取所有账号（用于详细信息）
    const accounts = dbManager.getAllAccounts();

    // Cookie 脱敏处理
    const maskedAccounts = accounts.map(account => ({
      id: account.id,
      cookie: maskCookie(account.cookie),
      status: account.status,
      supportedModels: account.supportedModels,
      note: account.note,
      lastUpdated: account.lastUpdated,
    }));

    // 获取系统配置
    const twocaptchaKey = dbManager.getConfig('twocaptcha_key');
    const maintenanceInterval = dbManager.getConfig('maintenance_interval_minutes');

    // 计算下次维护时间
    let nextMaintenance: number | null = null;
    if (stats.lastMaintenance && maintenanceInterval) {
      const intervalMs = parseInt(maintenanceInterval) * 60 * 1000;
      nextMaintenance = stats.lastMaintenance + intervalMs;
    }

    // 返回完整的元数据
    return NextResponse.json({
      success: true,
      meta: {
        // 统计信息
        stats: {
          total: stats.total,
          active: stats.active,
          disabled: stats.disabled,
          lastMaintenance: stats.lastMaintenance,
          nextMaintenance,
        },
        // 账号列表（脱敏）
        accounts: maskedAccounts,
        // 系统配置
        config: {
          twocaptchaKeyConfigured: !!twocaptchaKey,
          maintenanceIntervalMinutes: maintenanceInterval ? parseInt(maintenanceInterval) : 15,
        },
        // 元数据
        timestamp: Date.now(),
      },
    });
  } catch (error: any) {
    console.error('获取池信息失败:', error);
    return NextResponse.json(
      { error: '获取池信息失败', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Cookie 脱敏函数
 * 只显示前 10 个字符，其余替换为星号
 * @param cookie 完整的 Cookie 字符串
 * @returns 脱敏后的 Cookie 字符串
 */
function maskCookie(cookie: string): string {
  if (cookie.length <= 10) {
    return cookie;
  }
  return cookie.slice(0, 10) + '*'.repeat(Math.min(cookie.length - 10, 20));
}
