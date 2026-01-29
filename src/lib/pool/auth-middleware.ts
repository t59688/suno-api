import { DBManager } from './db-manager';
import bcrypt from 'bcrypt';
import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';

/**
 * 认证凭证接口
 */
export interface AuthCredentials {
  username: string;
  password: string;
}

/**
 * 认证中间件类
 * 负责管理员认证和密码管理
 */
export class AuthMiddleware {
  private dbManager: DBManager;
  private readonly ADMIN_USERNAME = 'super';
  private readonly PASSWORD_CONFIG_KEY = 'admin_password_hash';
  private readonly SALT_ROUNDS = 12;

  /**
   * 构造函数
   * @param dbManager 数据库管理器实例
   */
  constructor(dbManager: DBManager) {
    this.dbManager = dbManager;
  }

  /**
   * 初始化管理员密码
   * 如果数据库中不存在密码，生成一个临时密码并记录到日志
   * @returns 临时密码（仅在首次初始化时返回）
   */
  public async initializePassword(): Promise<string> {
    try {
      // 检查是否已存在密码
      const existingHash = this.dbManager.getConfig(this.PASSWORD_CONFIG_KEY);
      
      if (existingHash) {
        throw new Error('管理员密码已存在，无需初始化');
      }

      // 生成随机临时密码（16字符，包含字母和数字）
      const tempPassword = randomBytes(12).toString('base64').slice(0, 16);
      
      // 哈希密码
      const hash = await bcrypt.hash(tempPassword, this.SALT_ROUNDS);
      
      // 保存到数据库
      this.dbManager.setConfig(this.PASSWORD_CONFIG_KEY, hash);
      
      // 记录日志
      console.log('='.repeat(60));
      console.log('管理员账号初始化成功');
      console.log(`用户名: ${this.ADMIN_USERNAME}`);
      console.log(`临时密码: ${tempPassword}`);
      console.log('请立即登录并修改密码！');
      console.log('='.repeat(60));
      
      return tempPassword;
    } catch (error) {
      console.error('初始化密码失败:', error);
      throw error;
    }
  }

  /**
   * 验证认证凭证
   * @param credentials 用户名和密码
   * @returns 是否验证成功
   */
  public async verify(credentials: AuthCredentials): Promise<boolean> {
    try {
      // 验证用户名
      if (credentials.username !== this.ADMIN_USERNAME) {
        return false;
      }

      // 获取密码哈希
      const hash = this.dbManager.getConfig(this.PASSWORD_CONFIG_KEY);
      
      if (!hash) {
        // 如果没有密码，自动初始化
        await this.initializePassword();
        return false;
      }

      // 验证密码
      return await bcrypt.compare(credentials.password, hash);
    } catch (error) {
      console.error('验证凭证失败:', error);
      return false;
    }
  }

  /**
   * 修改密码
   * @param oldPassword 旧密码
   * @param newPassword 新密码
   * @returns 是否修改成功
   */
  public async changePassword(oldPassword: string, newPassword: string): Promise<boolean> {
    try {
      // 验证新密码长度
      if (newPassword.length < 8) {
        throw new Error('新密码长度必须至少为 8 个字符');
      }

      // 验证旧密码
      const isValid = await this.verify({
        username: this.ADMIN_USERNAME,
        password: oldPassword,
      });

      if (!isValid) {
        throw new Error('旧密码验证失败');
      }

      // 哈希新密码
      const hash = await bcrypt.hash(newPassword, this.SALT_ROUNDS);
      
      // 保存到数据库
      this.dbManager.setConfig(this.PASSWORD_CONFIG_KEY, hash);
      
      console.log('管理员密码已成功修改');
      
      return true;
    } catch (error) {
      console.error('修改密码失败:', error);
      throw error;
    }
  }

  /**
   * 检查是否需要初始化密码
   * @returns 是否需要初始化
   */
  public needsInitialization(): boolean {
    const hash = this.dbManager.getConfig(this.PASSWORD_CONFIG_KEY);
    return !hash;
  }

  /**
   * 从 Authorization 头解析 Basic Auth 凭证
   * @param authHeader Authorization 头的值
   * @returns 解析后的凭证或 null
   */
  private parseBasicAuth(authHeader: string): AuthCredentials | null {
    try {
      // 检查是否是 Basic Auth
      if (!authHeader.startsWith('Basic ')) {
        return null;
      }

      // 解码 Base64
      const base64Credentials = authHeader.slice(6);
      const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
      
      // 分割用户名和密码
      const [username, password] = credentials.split(':');
      
      if (!username || !password) {
        return null;
      }

      return { username, password };
    } catch (error) {
      console.error('解析 Basic Auth 失败:', error);
      return null;
    }
  }

  /**
   * Next.js 中间件函数
   * 验证请求的认证信息
   * @param req Next.js 请求对象
   * @returns 如果认证失败返回 401 响应，否则返回 null
   */
  public async middleware(req: NextRequest): Promise<NextResponse | null> {
    try {
      // 获取 Authorization 头
      const authHeader = req.headers.get('authorization');
      
      if (!authHeader) {
        return new NextResponse('需要认证', {
          status: 401,
          headers: {
            'WWW-Authenticate': 'Basic realm="Account Pool Management"',
          },
        });
      }

      // 解析凭证
      const credentials = this.parseBasicAuth(authHeader);
      
      if (!credentials) {
        return new NextResponse('认证格式无效', {
          status: 401,
          headers: {
            'WWW-Authenticate': 'Basic realm="Account Pool Management"',
          },
        });
      }

      // 验证凭证
      const isValid = await this.verify(credentials);
      
      if (!isValid) {
        return new NextResponse('认证失败', {
          status: 401,
          headers: {
            'WWW-Authenticate': 'Basic realm="Account Pool Management"',
          },
        });
      }

      // 认证成功，返回 null 表示继续处理请求
      return null;
    } catch (error) {
      console.error('中间件执行失败:', error);
      return new NextResponse('服务器内部错误', {
        status: 500,
      });
    }
  }

  /**
   * 创建认证响应辅助函数
   * 用于 API 路由中快速返回认证错误
   * @param message 错误消息
   * @returns 401 响应
   */
  public static createAuthErrorResponse(message: string = '需要认证'): NextResponse {
    return new NextResponse(message, {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Account Pool Management"',
      },
    });
  }
}
