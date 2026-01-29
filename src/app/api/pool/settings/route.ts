import { NextRequest, NextResponse } from 'next/server';
import { DBManager } from '@/lib/pool/db-manager';
import { AuthMiddleware } from '@/lib/pool/auth-middleware';

/**
 * 系统设置 API
 * GET: 获取所有系统配置
 * PUT: 更新系统配置
 */

// 初始化单例实例
const dbManager = DBManager.getInstance();
const authMiddleware = new AuthMiddleware(dbManager);

/**
 * GET /api/pool/settings
 * 获取所有系统配置
 * 查询参数: full=true 返回完整 twocaptcha_key
 */
export async function GET(request: NextRequest) {
  try {
    // 认证检查
    const authError = await authMiddleware.middleware(request);
    if (authError) {
      return authError;
    }

    const { searchParams } = new URL(request.url);
    const showFull = searchParams.get('full') === 'true';

    // 获取所有配置项
    const maintenanceInterval = dbManager.getConfig('maintenance_interval_minutes') || '15';
    const lastMaintenanceTime = dbManager.getConfig('last_maintenance_time') || '0';
    const twocaptchaKey = dbManager.getConfig('twocaptcha_key') || '';

    return NextResponse.json({
      success: true,
      settings: {
        maintenanceIntervalMinutes: parseInt(maintenanceInterval),
        lastMaintenanceTime: parseInt(lastMaintenanceTime),
        twocaptchaKeyConfigured: !!twocaptchaKey,
        twocaptchaKey: showFull ? twocaptchaKey : (twocaptchaKey ? '***' + twocaptchaKey.slice(-4) : ''),
        twocaptchaKeyFull: '', // 不返回完整密钥
      },
    });
  } catch (error: any) {
    console.error('获取系统设置失败:', error);
    return NextResponse.json(
      { success: false, error: error.message || '获取系统设置失败' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/pool/settings
 * 更新系统配置
 */
export async function PUT(request: NextRequest) {
  try {
    // 认证检查
    const authError = await authMiddleware.middleware(request);
    if (authError) {
      return authError;
    }

    const body = await request.json();
    const { maintenanceIntervalMinutes, twocaptchaKey } = body;

    // 验证参数
    if (maintenanceIntervalMinutes !== undefined) {
      if (typeof maintenanceIntervalMinutes !== 'number' || maintenanceIntervalMinutes < 1) {
        return NextResponse.json(
          { success: false, error: '维护间隔必须是大于 0 的数字' },
          { status: 400 }
        );
      }
    }

    if (twocaptchaKey !== undefined) {
      if (typeof twocaptchaKey !== 'string') {
        return NextResponse.json(
          { success: false, error: '2Captcha 密钥必须是字符串' },
          { status: 400 }
        );
      }
    }

    // 更新配置
    if (maintenanceIntervalMinutes !== undefined) {
      dbManager.setConfig('maintenance_interval_minutes', maintenanceIntervalMinutes.toString());
    }

    if (twocaptchaKey !== undefined) {
      // 如果是空字符串，删除配置；否则保存
      if (twocaptchaKey.trim() === '') {
        dbManager.setConfig('twocaptcha_key', '');
      } else {
        dbManager.setConfig('twocaptcha_key', twocaptchaKey.trim());
      }
    }

    return NextResponse.json({
      success: true,
      message: '系统设置更新成功',
    });
  } catch (error: any) {
    console.error('更新系统设置失败:', error);
    return NextResponse.json(
      { success: false, error: error.message || '更新系统设置失败' },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS 请求处理（CORS 预检）
 */
export async function OPTIONS() {
  return NextResponse.json({});
}
