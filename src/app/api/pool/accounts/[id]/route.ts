import { NextRequest, NextResponse } from 'next/server';
import { DBManager } from '@/lib/pool/db-manager';
import { AccountPool } from '@/lib/pool/account-pool';
import { AuthMiddleware } from '@/lib/pool/auth-middleware';

// 初始化单例实例
const dbManager = DBManager.getInstance();
const accountPool = new AccountPool(dbManager);
const authMiddleware = new AuthMiddleware(dbManager);

/**
 * PUT /api/pool/accounts/[id]
 * 更新账号信息
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 认证检查
    const authError = await authMiddleware.middleware(req);
    if (authError) {
      return authError;
    }

    const { id } = params;

    // 检查账号是否存在
    const existingAccount = dbManager.getAccount(id);
    if (!existingAccount) {
      return NextResponse.json(
        { error: '账号不存在' },
        { status: 404 }
      );
    }

    // 解析请求体
    const body = await req.json();
    const { cookie, status, supportedModels, note } = body;

    // 构建更新对象
    const updates: any = {};

    if (cookie !== undefined) {
      if (typeof cookie !== 'string' || cookie.trim() === '') {
        return NextResponse.json(
          { error: 'Cookie 必须是非空字符串' },
          { status: 400 }
        );
      }
      updates.cookie = cookie;
    }

    if (status !== undefined) {
      if (status !== 'active' && status !== 'disabled') {
        return NextResponse.json(
          { error: 'status 必须是 active 或 disabled' },
          { status: 400 }
        );
      }

      // 如果要更新状态，使用 AccountPool 的方法（包含健康检查）
      const statusUpdated = await accountPool.updateAccountStatus(id, status);
      if (!statusUpdated) {
        return NextResponse.json(
          { error: '状态更新失败，可能是健康检查未通过' },
          { status: 400 }
        );
      }
    }

    if (supportedModels !== undefined) {
      if (!Array.isArray(supportedModels)) {
        return NextResponse.json(
          { error: 'supportedModels 必须是数组' },
          { status: 400 }
        );
      }
      updates.supportedModels = supportedModels;
    }

    if (note !== undefined) {
      if (typeof note !== 'string') {
        return NextResponse.json(
          { error: 'note 必须是字符串' },
          { status: 400 }
        );
      }
      updates.note = note;
    }

    // 执行更新（除了 status，因为已经通过 AccountPool 更新了）
    if (Object.keys(updates).length > 0) {
      const updated = dbManager.updateAccount(id, updates);
      if (!updated) {
        return NextResponse.json(
          { error: '更新账号失败' },
          { status: 500 }
        );
      }
    }

    // 获取更新后的账号信息
    const updatedAccount = dbManager.getAccount(id);
    if (!updatedAccount) {
      return NextResponse.json(
        { error: '获取更新后的账号信息失败' },
        { status: 500 }
      );
    }

    // 返回更新后的账号信息（Cookie 脱敏）
    return NextResponse.json({
      success: true,
      account: {
        id: updatedAccount.id,
        cookie: maskCookie(updatedAccount.cookie),
        status: updatedAccount.status,
        supportedModels: updatedAccount.supportedModels,
        note: updatedAccount.note,
        lastUpdated: updatedAccount.lastUpdated,
      },
    });
  } catch (error: any) {
    console.error('更新账号失败:', error);
    return NextResponse.json(
      { error: '更新账号失败', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/pool/accounts/[id]
 * 删除账号
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 认证检查
    const authError = await authMiddleware.middleware(req);
    if (authError) {
      return authError;
    }

    const { id } = params;

    // 检查账号是否存在
    const existingAccount = dbManager.getAccount(id);
    if (!existingAccount) {
      return NextResponse.json(
        { error: '账号不存在' },
        { status: 404 }
      );
    }

    // 删除账号
    const deleted = accountPool.removeAccount(id);

    if (!deleted) {
      return NextResponse.json(
        { error: '删除账号失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '账号已删除',
      accountId: id,
    });
  } catch (error: any) {
    console.error('删除账号失败:', error);
    return NextResponse.json(
      { error: '删除账号失败', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/pool/accounts/[id]
 * 获取单个账号信息
 * 查询参数: full=true 返回完整 Cookie
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 认证检查
    const authError = await authMiddleware.middleware(req);
    if (authError) {
      return authError;
    }

    const { id } = params;
    const { searchParams } = new URL(req.url);
    const showFull = searchParams.get('full') === 'true';

    // 获取账号信息
    const account = dbManager.getAccount(id);

    if (!account) {
      return NextResponse.json(
        { error: '账号不存在' },
        { status: 404 }
      );
    }

    // 返回账号信息（根据参数决定是否脱敏）
    return NextResponse.json({
      success: true,
      account: {
        id: account.id,
        cookie: showFull ? account.cookie : maskCookie(account.cookie),
        status: account.status,
        supportedModels: account.supportedModels,
        note: account.note,
        lastUpdated: account.lastUpdated,
        creditsLeft: account.creditsLeft,
        monthlyLimit: account.monthlyLimit,
        monthlyUsage: account.monthlyUsage,
        creditsUpdatedAt: account.creditsUpdatedAt,
      },
    });
  } catch (error: any) {
    console.error('获取账号信息失败:', error);
    return NextResponse.json(
      { error: '获取账号信息失败', details: error.message },
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
