import { NextRequest, NextResponse } from 'next/server';
import { DBManager } from '@/lib/pool/db-manager';
import { AccountPool } from '@/lib/pool/account-pool';
import { AuthMiddleware } from '@/lib/pool/auth-middleware';

// 初始化单例实例
const dbManager = DBManager.getInstance();
const accountPool = new AccountPool(dbManager);
const authMiddleware = new AuthMiddleware(dbManager);

/**
 * POST /api/pool/accounts
 * 添加新账号到账号池
 */
export async function POST(req: NextRequest) {
  try {
    // 认证检查
    const authError = await authMiddleware.middleware(req);
    if (authError) {
      return authError;
    }

    // 解析请求体
    const body = await req.json();
    const { cookie, supportedModels = [], note = '' } = body;

    // 验证必填字段
    if (!cookie || typeof cookie !== 'string') {
      return NextResponse.json(
        { error: 'Cookie 字段是必填的且必须是字符串' },
        { status: 400 }
      );
    }

    // 验证 supportedModels 格式
    if (!Array.isArray(supportedModels)) {
      return NextResponse.json(
        { error: 'supportedModels 必须是数组' },
        { status: 400 }
      );
    }

    // 添加账号（包含健康检查）
    const account = await accountPool.addAccount(cookie, supportedModels, note);

    // 返回账号信息（Cookie 脱敏）
    return NextResponse.json({
      success: true,
      account: {
        id: account.id,
        cookie: maskCookie(account.cookie),
        status: account.status,
        supportedModels: account.supportedModels,
        note: account.note,
        lastUpdated: account.lastUpdated,
      },
    });
  } catch (error: any) {
    console.error('添加账号失败:', error);

    // 处理特定错误
    if (error.message?.includes('INVALID_COOKIE')) {
      return NextResponse.json(
        { error: 'Cookie 验证失败，账号无效' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: '添加账号失败', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/pool/accounts
 * 获取所有账号列表
 */
export async function GET(req: NextRequest) {
  try {
    // 认证检查
    const authError = await authMiddleware.middleware(req);
    if (authError) {
      return authError;
    }

    // 获取所有账号
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

    return NextResponse.json({
      success: true,
      accounts: maskedAccounts,
      total: accounts.length,
    });
  } catch (error: any) {
    console.error('查询账号列表失败:', error);
    return NextResponse.json(
      { error: '查询账号列表失败', details: error.message },
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
