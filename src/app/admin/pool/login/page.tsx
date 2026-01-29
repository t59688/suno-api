'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * 登录页面
 * 处理管理员认证和密码管理
 */
export default function LoginPage() {
  const router = useRouter();
  
  // 登录状态
  const [username, setUsername] = useState('super');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 密码修改状态
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changePasswordLoading, setChangePasswordLoading] = useState(false);
  const [changePasswordError, setChangePasswordError] = useState<string | null>(null);
  const [changePasswordSuccess, setChangePasswordSuccess] = useState(false);
  
  // 首次登录强制修改密码标志
  const [forceChangePassword, setForceChangePassword] = useState(false);
  const [tempPassword, setTempPassword] = useState('');

  /**
   * 检查是否已登录
   */
  useEffect(() => {
    const savedPassword = localStorage.getItem('admin_password');
    if (savedPassword) {
      // 尝试验证已保存的密码
      verifyStoredPassword(savedPassword);
    }
  }, []);

  /**
   * 验证已保存的密码
   */
  const verifyStoredPassword = async (savedPassword: string) => {
    try {
      const response = await fetch('/api/pool/meta', {
        headers: {
          'Authorization': 'Basic ' + btoa('super:' + savedPassword),
        },
      });

      if (response.ok) {
        // 密码有效，跳转到仪表盘
        router.push('/admin/pool');
      } else {
        // 密码无效，清除保存的密码
        localStorage.removeItem('admin_password');
      }
    } catch (err) {
      console.error('验证保存的密码失败:', err);
      localStorage.removeItem('admin_password');
    }
  };

  /**
   * 处理登录提交
   */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password.trim()) {
      setError('请输入密码');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // 尝试访问 API 验证凭证
      const response = await fetch('/api/pool/meta', {
        headers: {
          'Authorization': 'Basic ' + btoa(`${username}:${password}`),
        },
      });

      if (response.ok) {
        // 登录成功，保存密码到 localStorage
        localStorage.setItem('admin_password', password);
        
        // 检查是否是临时密码（通过特定标记判断）
        // 这里我们假设如果密码长度为16且是base64格式，可能是临时密码
        if (password.length === 16 && /^[A-Za-z0-9+/]+$/.test(password)) {
          // 可能是临时密码，提示用户修改
          setForceChangePassword(true);
          setTempPassword(password);
          setOldPassword(password);
          setShowChangePassword(true);
          setError('检测到您使用的是临时密码，请立即修改密码以确保安全。');
        } else {
          // 跳转到仪表盘
          router.push('/admin/pool');
        }
      } else if (response.status === 401) {
        setError('用户名或密码错误');
      } else {
        setError('登录失败，请稍后重试');
      }
    } catch (err: any) {
      setError('登录失败: ' + err.message);
      console.error('登录失败:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 处理密码修改提交
   */
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 验证输入
    if (!oldPassword.trim()) {
      setChangePasswordError('请输入当前密码');
      return;
    }
    
    if (!newPassword.trim()) {
      setChangePasswordError('请输入新密码');
      return;
    }
    
    if (newPassword.length < 8) {
      setChangePasswordError('新密码长度必须至少为 8 个字符');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setChangePasswordError('两次输入的新密码不一致');
      return;
    }
    
    if (oldPassword === newPassword) {
      setChangePasswordError('新密码不能与当前密码相同');
      return;
    }

    try {
      setChangePasswordLoading(true);
      setChangePasswordError(null);
      setChangePasswordSuccess(false);

      // 调用密码修改 API
      const response = await fetch('/api/pool/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + btoa(`super:${oldPassword}`),
        },
        body: JSON.stringify({
          oldPassword,
          newPassword,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // 密码修改成功
        setChangePasswordSuccess(true);
        
        // 更新 localStorage 中的密码
        localStorage.setItem('admin_password', newPassword);
        
        // 清空表单
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
        
        // 如果是强制修改密码，2秒后跳转到仪表盘
        if (forceChangePassword) {
          setTimeout(() => {
            router.push('/admin/pool');
          }, 2000);
        } else {
          // 否则3秒后关闭修改密码表单
          setTimeout(() => {
            setShowChangePassword(false);
            setChangePasswordSuccess(false);
          }, 3000);
        }
      } else {
        setChangePasswordError(data.error || '密码修改失败');
      }
    } catch (err: any) {
      setChangePasswordError('密码修改失败: ' + err.message);
      console.error('密码修改失败:', err);
    } finally {
      setChangePasswordLoading(false);
    }
  };

  /**
   * 打开密码修改表单
   */
  const openChangePasswordForm = () => {
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setChangePasswordError(null);
    setChangePasswordSuccess(false);
    setShowChangePassword(true);
  };

  /**
   * 关闭密码修改表单
   */
  const closeChangePasswordForm = () => {
    if (forceChangePassword) {
      // 如果是强制修改密码，不允许关闭
      setChangePasswordError('您必须修改临时密码才能继续使用系统');
      return;
    }
    setShowChangePassword(false);
    setChangePasswordError(null);
    setChangePasswordSuccess(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Logo 和标题 */}
        <div>
          <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-indigo-600">
            <svg className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            账号池管理系统
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            请使用管理员账号登录
          </p>
        </div>

        {/* 登录表单 */}
        {!showChangePassword && (
          <div className="bg-white rounded-lg shadow-xl p-8">
            <form className="space-y-6" onSubmit={handleLogin}>
              {/* 用户名输入 */}
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                  用户名
                </label>
                <div className="mt-1">
                  <input
                    id="username"
                    name="username"
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="super"
                    disabled
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  管理员用户名固定为 &quot;super&quot;
                </p>
              </div>

              {/* 密码输入 */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  密码
                </label>
                <div className="mt-1">
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="请输入密码"
                  />
                </div>
              </div>

              {/* 错误提示 */}
              {error && (
                <div className="rounded-md bg-red-50 p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-red-800">{error}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* 登录按钮 */}
              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      登录中...
                    </>
                  ) : (
                    '登录'
                  )}
                </button>
              </div>

              {/* 修改密码链接 */}
              <div className="text-center">
                <button
                  type="button"
                  onClick={openChangePasswordForm}
                  className="text-sm text-indigo-600 hover:text-indigo-500"
                >
                  修改密码
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 密码修改表单 */}
        {showChangePassword && (
          <div className="bg-white rounded-lg shadow-xl p-8">
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-900">
                {forceChangePassword ? '首次登录 - 必须修改密码' : '修改密码'}
              </h3>
              {forceChangePassword && (
                <p className="mt-2 text-sm text-red-600">
                  检测到您使用的是临时密码，为了账号安全，请立即修改密码。
                </p>
              )}
            </div>

            <form className="space-y-6" onSubmit={handleChangePassword}>
              {/* 当前密码输入 */}
              <div>
                <label htmlFor="old-password" className="block text-sm font-medium text-gray-700">
                  当前密码
                </label>
                <div className="mt-1">
                  <input
                    id="old-password"
                    name="old-password"
                    type="password"
                    required
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="请输入当前密码"
                    disabled={forceChangePassword}
                  />
                </div>
              </div>

              {/* 新密码输入 */}
              <div>
                <label htmlFor="new-password" className="block text-sm font-medium text-gray-700">
                  新密码
                </label>
                <div className="mt-1">
                  <input
                    id="new-password"
                    name="new-password"
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="请输入新密码（至少8个字符）"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  密码长度必须至少为 8 个字符
                </p>
              </div>

              {/* 确认新密码输入 */}
              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700">
                  确认新密码
                </label>
                <div className="mt-1">
                  <input
                    id="confirm-password"
                    name="confirm-password"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="请再次输入新密码"
                  />
                </div>
              </div>

              {/* 错误提示 */}
              {changePasswordError && (
                <div className="rounded-md bg-red-50 p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-red-800">{changePasswordError}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* 成功提示 */}
              {changePasswordSuccess && (
                <div className="rounded-md bg-green-50 p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-green-800">
                        密码修改成功！{forceChangePassword ? '即将跳转到仪表盘...' : ''}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* 按钮组 */}
              <div className="flex space-x-3">
                {!forceChangePassword && (
                  <button
                    type="button"
                    onClick={closeChangePasswordForm}
                    disabled={changePasswordLoading}
                    className="flex-1 py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                  >
                    取消
                  </button>
                )}
                <button
                  type="submit"
                  disabled={changePasswordLoading || changePasswordSuccess}
                  className="flex-1 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {changePasswordLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      修改中...
                    </>
                  ) : changePasswordSuccess ? (
                    '修改成功'
                  ) : (
                    '确认修改'
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 页脚提示 */}
        <div className="text-center">
          <p className="text-xs text-gray-500">
            如果忘记密码，请查看服务器日志获取临时密码
          </p>
        </div>
      </div>
    </div>
  );
}
