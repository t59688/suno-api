import { NextRequest, NextResponse } from 'next/server';
import { DBManager } from '@/lib/pool/db-manager';
import { AuthMiddleware } from '@/lib/pool/auth-middleware';

// 初始化单例实例
const dbManager = DBManager.getInstance();
const authMiddleware = new AuthMiddleware(dbManager);

/**
 * GET /api/pool/logs
 * 查询维护日志，支持筛选和分页
 * 
 * 查询参数:
 * - accountId: 按账号 ID 筛选（可选）
 * - limit: 每页数量，默认 50
 * - offset: 偏移量，默认 0
 * - page: 页码（从 1 开始），如果提供则自动计算 offset
 */
export async function GET(req: NextRequest) {
  try {
    // 认证检查
    const authError = await authMiddleware.middleware(req);
    if (authError) {
      return authError;
    }

    // 解析查询参数
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get('accountId') || undefined;
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');
    const pageParam = searchParams.get('page');

    // 解析分页参数
    let limit = 50; // 默认每页 50 条
    let offset = 0;  // 默认从第一条开始

    if (limitParam) {
      const parsedLimit = parseInt(limitParam);
      if (!isNaN(parsedLimit) && parsedLimit > 0 && parsedLimit <= 200) {
        limit = parsedLimit;
      }
    }

    // 如果提供了 page 参数，优先使用 page 计算 offset
    if (pageParam) {
      const page = parseInt(pageParam);
      if (!isNaN(page) && page > 0) {
        offset = (page - 1) * limit;
      }
    } else if (offsetParam) {
      const parsedOffset = parseInt(offsetParam);
      if (!isNaN(parsedOffset) && parsedOffset >= 0) {
        offset = parsedOffset;
      }
    }

    // 查询日志
    const logs = dbManager.getLogs({
      accountId,
      limit,
      offset,
    });

    // 获取总数（用于分页）
    // 注意：这里简化处理，实际应该查询总数
    const allLogs = dbManager.getLogs({ accountId });
    const total = allLogs.length;

    // 计算分页信息
    const currentPage = Math.floor(offset / limit) + 1;
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = offset + limit < total;
    const hasPrevPage = offset > 0;

    return NextResponse.json({
      success: true,
      logs,
      pagination: {
        total,
        limit,
        offset,
        currentPage,
        totalPages,
        hasNextPage,
        hasPrevPage,
      },
      filters: {
        accountId: accountId || null,
      },
    });
  } catch (error: any) {
    console.error('查询日志失败:', error);
    return NextResponse.json(
      { error: '查询日志失败', details: error.message },
      { status: 500 }
    );
  }
}
