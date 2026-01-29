import { NextRequest, NextResponse } from 'next/server';
import { DBManager } from '@/lib/pool/db-manager';
import { AuthMiddleware } from '@/lib/pool/auth-middleware';

/**
 * 修改管理员密码 API
 * POST /api/pool/auth/change-password
 */
export async function POST(req: NextRequest) {
  try {
    // 获取数据库管理器实例
    const dbManager = DBManager.getInstance();
    
    // 创建认证中间件实例
    const authMiddleware = new AuthMiddleware(dbManager);
    
    // 验证认证
    const authError = await authMiddleware.middleware(req);
    if (authError) {
      return authError;
    }
    
    // 解析请求体
    const body = await req.json();
    const { oldPassword, newPassword } = body;
    
    // 验证输入
    if (!oldPassword || !newPassword) {
      return NextResponse.json(
        {
          success: false,
          error: '缺少必需参数: oldPassword 和 newPassword',
        },
        { status: 400 }
      );
    }
    
    // 调用密码修改方法
    try {
      const success = await authMiddleware.changePassword(oldPassword, newPassword);
      
      if (success) {
        return NextResponse.json({
          success: true,
          message: '密码修改成功',
        });
      } else {
        return NextResponse.json(
          {
            success: false,
            error: '密码修改失败',
          },
          { status: 400 }
        );
      }
    } catch (error: any) {
      // 处理密码修改过程中的错误
      return NextResponse.json(
        {
          success: false,
          error: error.message || '密码修改失败',
        },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('修改密码 API 错误:', error);
    return NextResponse.json(
      {
        success: false,
        error: '服务器内部错误: ' + error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS 请求处理（CORS 预检）
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
