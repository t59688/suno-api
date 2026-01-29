'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * 系统设置接口
 */
interface SystemSettings {
  maintenanceIntervalMinutes: number;
  lastMaintenanceTime: number;
  twocaptchaKeyConfigured: boolean;
  twocaptchaKey: string;
}

/**
 * 系统设置页面
 */
export default function SettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 表单状态
  const [maintenanceInterval, setMaintenanceInterval] = useState<number>(15);
  const [twocaptchaKey, setTwocaptchaKey] = useState<string>('');
  const [isEditingKey, setIsEditingKey] = useState<boolean>(false);
  const [showFullKey, setShowFullKey] = useState<boolean>(false);
  const [fullTwocaptchaKey, setFullTwocaptchaKey] = useState<string>('');

  /**
   * 获取系统设置
   */
  const fetchSettings = async () => {
    const savedPassword = localStorage.getItem('admin_password');
    if (!savedPassword) {
      router.push('/admin/pool/login');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/pool/settings', {
        headers: {
          'Authorization': 'Basic ' + btoa('super:' + savedPassword),
        },
      });

      if (response.status === 401) {
        localStorage.removeItem('admin_password');
        router.push('/admin/pool/login');
        return;
      }

      if (!response.ok) {
        throw new Error('获取系统设置失败');
      }

      const data = await response.json();
      
      if (data.success) {
        setSettings(data.settings);
        setMaintenanceInterval(data.settings.maintenanceIntervalMinutes);
      } else {
        throw new Error(data.error || '获取系统设置失败');
      }
    } catch (err: any) {
      setError(err.message);
      console.error('获取系统设置失败:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 保存系统设置
   */
  const saveSettings = async () => {
    const savedPassword = localStorage.getItem('admin_password');
    if (!savedPassword) {
      router.push('/admin/pool/login');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const updateData: any = {
        maintenanceIntervalMinutes: maintenanceInterval,
      };

      // 如果正在编辑密钥，包含密钥更新
      if (isEditingKey) {
        updateData.twocaptchaKey = twocaptchaKey;
      }

      const response = await fetch('/api/pool/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + btoa('super:' + savedPassword),
        },
        body: JSON.stringify(updateData),
      });

      if (response.status === 401) {
        localStorage.removeItem('admin_password');
        router.push('/admin/pool/login');
        return;
      }

      if (!response.ok) {
        throw new Error('保存系统设置失败');
      }

      const data = await response.json();
      
      if (data.success) {
        setSuccess('系统设置保存成功');
        setIsEditingKey(false);
        setTwocaptchaKey('');
        await fetchSettings();
      } else {
        throw new Error(data.error || '保存系统设置失败');
      }
    } catch (err: any) {
      setError(err.message);
      console.error('保存系统设置失败:', err);
    } finally {
      setSaving(false);
    }
  };

  /**
   * 查看完整 2Captcha Key
   */
  const viewFullKey = async () => {
    const savedPassword = localStorage.getItem('admin_password');
    if (!savedPassword) {
      router.push('/admin/pool/login');
      return;
    }

    try {
      setError(null);

      const response = await fetch('/api/pool/settings?full=true', {
        headers: {
          'Authorization': 'Basic ' + btoa('super:' + savedPassword),
        },
      });

      if (response.status === 401) {
        localStorage.removeItem('admin_password');
        router.push('/admin/pool/login');
        return;
      }

      if (!response.ok) {
        throw new Error('获取完整密钥失败');
      }

      const data = await response.json();
      
      if (data.success) {
        setFullTwocaptchaKey(data.settings.twocaptchaKey);
        setShowFullKey(true);
      } else {
        throw new Error(data.error || '获取完整密钥失败');
      }
    } catch (err: any) {
      setError(err.message);
      console.error('获取完整密钥失败:', err);
    }
  };

  /**
   * 复制到剪贴板
   */
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setSuccess('已复制到剪贴板');
      setTimeout(() => setSuccess(null), 2000);
    }).catch(() => {
      setError('复制失败');
    });
  };

  /**
   * 格式化时间戳
   */
  const formatTimestamp = (timestamp: number): string => {
    if (!timestamp) return '从未';
    
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // 初始加载
  useEffect(() => {
    fetchSettings();
  }, []);

  if (loading && !settings) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        {/* 页面标题 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">系统设置</h1>
          <p className="mt-2 text-gray-600">配置账号池系统的运行参数</p>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
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

        {/* 成功提示 */}
        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-800">{success}</p>
              </div>
            </div>
          </div>
        )}

        {/* 维护设置 */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">维护设置</h2>
            <p className="mt-1 text-sm text-gray-600">配置账号池自动维护的相关参数</p>
          </div>
          <div className="px-6 py-4 space-y-6">
            {/* 维护间隔 */}
            <div>
              <label htmlFor="maintenanceInterval" className="block text-sm font-medium text-gray-700 mb-2">
                自动维护间隔（分钟）
              </label>
              <input
                type="number"
                id="maintenanceInterval"
                min="1"
                max="1440"
                value={maintenanceInterval}
                onChange={(e) => setMaintenanceInterval(parseInt(e.target.value) || 15)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
              <p className="mt-2 text-sm text-gray-500">
                系统将每隔指定时间自动对账号池进行维护检查，建议设置为 15-60 分钟
              </p>
            </div>

            {/* 上次维护时间 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                上次维护时间
              </label>
              <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-900">
                {formatTimestamp(settings?.lastMaintenanceTime || 0)}
              </div>
            </div>
          </div>
        </div>

        {/* 环境变量配置状态 */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">2Captcha 配置</h2>
            <p className="mt-1 text-sm text-gray-600">配置验证码解决服务的 API 密钥</p>
          </div>
          <div className="px-6 py-4 space-y-4">
            {/* TWOCAPTCHA_KEY */}
            <div>
              <label htmlFor="twocaptchaKey" className="block text-sm font-medium text-gray-700 mb-2">
                2Captcha API 密钥
              </label>
              
              {!isEditingKey ? (
                <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-md">
                  <div className="flex items-center">
                    {settings?.twocaptchaKeyConfigured ? (
                      <>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 mr-3">
                          已配置
                        </span>
                        <span className="text-sm text-gray-500 font-mono">{settings.twocaptchaKey}</span>
                      </>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        未配置
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    {settings?.twocaptchaKeyConfigured && (
                      <button
                        onClick={viewFullKey}
                        className="text-sm text-gray-600 hover:text-gray-700 font-medium"
                      >
                        查看
                      </button>
                    )}
                    <button
                      onClick={() => setIsEditingKey(true)}
                      className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                    >
                      {settings?.twocaptchaKeyConfigured ? '修改' : '配置'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <input
                    type="text"
                    id="twocaptchaKey"
                    value={twocaptchaKey}
                    onChange={(e) => setTwocaptchaKey(e.target.value)}
                    placeholder="请输入 2Captcha API 密钥"
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm font-mono"
                  />
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => {
                        setIsEditingKey(false);
                        setTwocaptchaKey('');
                      }}
                      className="text-sm text-gray-600 hover:text-gray-700"
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}
              
              <p className="mt-2 text-sm text-gray-500">
                用于自动解决 Suno 登录时的 hCaptcha 验证码。可在{' '}
                <a 
                  href="https://2captcha.com" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-indigo-600 hover:text-indigo-700 underline"
                >
                  2captcha.com
                </a>
                {' '}注册并获取 API 密钥
              </p>
            </div>
          </div>
        </div>

        {/* 配置说明 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">配置说明</h3>
              <div className="mt-2 text-sm text-blue-700">
                <ul className="list-disc list-inside space-y-1">
                  <li>所有配置保存在数据库中，修改后立即生效，无需重启服务</li>
                  <li>2Captcha API 密钥用于自动解决验证码，可在 <a href="https://2captcha.com" target="_blank" rel="noopener noreferrer" className="underline">2captcha.com</a> 获取</li>
                  <li>管理员密码存储在数据库中，首次启动时会自动生成临时密码并显示在控制台</li>
                  <li>维护间隔建议设置为 15-60 分钟，根据账号数量和使用频率调整</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* 保存按钮 */}
        <div className="flex justify-end space-x-3">
          <button
            onClick={fetchSettings}
            disabled={loading}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            重置
          </button>
          <button
            onClick={saveSettings}
            disabled={saving}
            className={`px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
              saving
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
            }`}
          >
            {saving ? '保存中...' : '保存设置'}
          </button>
        </div>

        {/* 查看完整密钥弹窗 */}
        {showFullKey && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">查看完整 2Captcha API 密钥</h3>
                <button
                  onClick={() => {
                    setShowFullKey(false);
                    setFullTwocaptchaKey('');
                  }}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      完整 API 密钥
                    </label>
                    <button
                      onClick={() => copyToClipboard(fullTwocaptchaKey)}
                      className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center"
                    >
                      <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      复制
                    </button>
                  </div>
                  <input
                    type="text"
                    value={fullTwocaptchaKey}
                    readOnly
                    className="w-full px-4 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900 font-mono text-sm"
                  />
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                  <div className="flex">
                    <svg className="h-5 w-5 text-yellow-400 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <p className="text-sm text-yellow-800">
                      请妥善保管 API 密钥，不要泄露给他人
                    </p>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    onClick={() => {
                      setShowFullKey(false);
                      setFullTwocaptchaKey('');
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    关闭
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
