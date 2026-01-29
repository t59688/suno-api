import { NextRequest, NextResponse } from 'next/server';
import { DBManager } from '@/lib/pool/db-manager';
import { MaintenanceService } from '@/lib/pool/maintenance-service';
import { AuthMiddleware } from '@/lib/pool/auth-middleware';

// 初始化单例实例
const dbManager = DBManager.getInstance();
const maintenanceService = new MaintenanceService(dbManager);
const authMiddleware = new AuthMiddleware(dbManager);

/**
 * POST /api/pool/accounts/[id]/maintain
 * 对单个账号执行维护操作
 * 支持对任何状态的账号进行维护,维护成功后自动恢复为 active
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 认证检查
    const authError = await authMiddleware.middleware(req);
    if (authError) {
      return authError;
    }

    const accountId = params.id;

    // 获取账号信息
    const account = dbManager.getAccount(accountId);
    if (!account) {
      return NextResponse.json(
        { error: '账号不存在' },
        { status: 404 }
      );
    }

    console.log(`开始维护账号: ${accountId.slice(0, 8)}... (当前状态: ${account.status})`);

    // 执行维护
    const result = await maintenanceService.keepAlive(account);

    // 记录日志
    dbManager.addLog({
      accountId: account.id,
      operation: 'manual_maintenance',
      status: result.success ? 'success' : 'failed',
      message: result.success 
        ? '手动维护成功' 
        : `手动维护失败: ${result.error}`,
    });

    // 根据维护结果更新账号状态
    if (result.success) {
      // 维护成功,确保账号状态为 active
      if (account.status !== 'active') {
        dbManager.updateAccount(account.id, { status: 'active' });
        console.log(`账号 ${accountId.slice(0, 8)} 维护成功,状态已恢复为 active`);
      }
    } else {
      // 维护失败,标记为 disabled
      dbManager.updateAccount(account.id, { status: 'disabled' });
      console.log(`账号 ${accountId.slice(0, 8)} 维护失败,状态已标记为 disabled`);
    }

    // 获取更新后的账号信息
    const updatedAccount = dbManager.getAccount(accountId);

    return NextResponse.json({
      success: result.success,
      message: result.success ? '维护成功' : `维护失败: ${result.error}`,
      account: updatedAccount ? {
        id: updatedAccount.id,
        cookie: maskCookie(updatedAccount.cookie),
        status: updatedAccount.status,
        supportedModels: updatedAccount.supportedModels,
        note: updatedAccount.note,
        lastUpdated: updatedAccount.lastUpdated,
        creditsLeft: updatedAccount.creditsLeft,
        monthlyLimit: updatedAccount.monthlyLimit,
        monthlyUsage: updatedAccount.monthlyUsage,
        creditsUpdatedAt: updatedAccount.creditsUpdatedAt,
      } : null,
    });
  } catch (error: any) {
    console.error('维护账号失败:', error);
    return NextResponse.json(
      { error: '维护账号失败', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Cookie 脱敏函数
 */
function maskCookie(cookie: string): string {
  if (cookie.length <= 10) {
    return cookie;
  }
  return cookie.slice(0, 10) + '*'.repeat(Math.min(cookie.length - 10, 20));
}
