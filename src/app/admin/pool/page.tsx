'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * 账号池元数据接口
 */
interface PoolMeta {
  stats: {
    total: number;
    active: number;
    disabled: number;
    lastMaintenance: number | null;
    nextMaintenance: number | null;
  };
  accounts: Array<{
    id: string;
    cookie: string;
    status: 'active' | 'disabled';
    supportedModels: string[];
    note: string;
    lastUpdated: number;
  }>;
  config: {
    twocaptchaKeyConfigured: boolean;
    maintenanceIntervalMinutes: number;
  };
  timestamp: number;
}

/**
 * 账号池管理仪表盘页面
 */
export default function PoolDashboard() {
  const router = useRouter();
  const [poolMeta, setPoolMeta] = useState<PoolMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [maintaining, setMaintaining] = useState(false);
  const [countdown, setCountdown] = useState<string>('');

  /**
   * 获取账号池元数据
   */
  const fetchPoolMeta = async () => {
    // 检查是否有保存的密码
    const savedPassword = localStorage.getItem('admin_password');
    if (!savedPassword) {
      // 没有密码，直接跳转到登录页
      router.push('/admin/pool/login');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/pool/meta', {
        headers: {
          'Authorization': 'Basic ' + btoa('super:' + savedPassword),
        },
      });

      if (response.status === 401) {
        // 未授权，清除密码并跳转到登录页
        localStorage.removeItem('admin_password');
        router.push('/admin/pool/login');
        return;
      }

      if (!response.ok) {
        throw new Error('获取账号池信息失败');
      }

      const data = await response.json();
      
      if (data.success) {
        setPoolMeta(data.meta);
      } else {
        throw new Error(data.error || '获取账号池信息失败');
      }
    } catch (err: any) {
      setError(err.message);
      console.error('获取账号池信息失败:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 触发立即维护
   */
  const triggerMaintenance = async () => {
    if (maintaining) return;

    try {
      setMaintaining(true);
      setError(null);

      const response = await fetch('/api/pool/maintenance', {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa('super:' + (localStorage.getItem('admin_password') || '')),
        },
      });

      if (response.status === 401) {
        router.push('/admin/pool/login');
        return;
      }

      if (!response.ok) {
        throw new Error('触发维护失败');
      }

      const data = await response.json();
      
      if (data.success) {
        // 维护成功，刷新数据
        await fetchPoolMeta();
      } else {
        throw new Error(data.error || '触发维护失败');
      }
    } catch (err: any) {
      setError(err.message);
      console.error('触发维护失败:', err);
    } finally {
      setMaintaining(false);
    }
  };

  /**
   * 计算倒计时
   */
  const calculateCountdown = () => {
    if (!poolMeta?.stats.nextMaintenance) {
      setCountdown('未知');
      return;
    }

    const now = Date.now();
    const next = poolMeta.stats.nextMaintenance;
    const diff = next - now;

    if (diff <= 0) {
      setCountdown('即将维护');
      return;
    }

    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    setCountdown(`${minutes} 分 ${seconds} 秒`);
  };

  /**
   * 格式化时间戳
   */
  const formatTimestamp = (timestamp: number | null): string => {
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
    fetchPoolMeta();
  }, []);

  // 定时刷新倒计时
  useEffect(() => {
    const timer = setInterval(() => {
      calculateCountdown();
    }, 1000);

    return () => clearInterval(timer);
  }, [poolMeta]);

  // 定时刷新数据（每 30 秒）
  useEffect(() => {
    const timer = setInterval(() => {
      fetchPoolMeta();
    }, 30000);

    return () => clearInterval(timer);
  }, []);

  if (loading && !poolMeta) {
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
      <div className="max-w-7xl mx-auto">
        {/* 页面标题 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">账号池管理仪表盘</h1>
          <p className="mt-2 text-gray-600">监控和管理 Suno 账号池状态</p>
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

        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* 总账号数 */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-indigo-100 rounded-md p-3">
                <svg className="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">总账号数</p>
                <p className="text-2xl font-bold text-gray-900">{poolMeta?.stats.total || 0}</p>
              </div>
            </div>
          </div>

          {/* 可用账号数 */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-green-100 rounded-md p-3">
                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">可用账号</p>
                <p className="text-2xl font-bold text-green-600">{poolMeta?.stats.active || 0}</p>
              </div>
            </div>
          </div>

          {/* 禁用账号数 */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-red-100 rounded-md p-3">
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">禁用账号</p>
                <p className="text-2xl font-bold text-red-600">{poolMeta?.stats.disabled || 0}</p>
              </div>
            </div>
          </div>

          {/* TWOCAPTCHA 配置状态 */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className={`flex-shrink-0 rounded-md p-3 ${
                poolMeta?.config.twocaptchaKeyConfigured ? 'bg-green-100' : 'bg-yellow-100'
              }`}>
                <svg className={`h-6 w-6 ${
                  poolMeta?.config.twocaptchaKeyConfigured ? 'text-green-600' : 'text-yellow-600'
                }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">验证码密钥</p>
                <p className={`text-lg font-bold ${
                  poolMeta?.config.twocaptchaKeyConfigured ? 'text-green-600' : 'text-yellow-600'
                }`}>
                  {poolMeta?.config.twocaptchaKeyConfigured ? '已配置' : '未配置'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 维护信息卡片 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* 上次维护时间 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">维护信息</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">上次维护时间:</span>
                <span className="text-sm font-medium text-gray-900">
                  {formatTimestamp(poolMeta?.stats.lastMaintenance || null)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">维护间隔:</span>
                <span className="text-sm font-medium text-gray-900">
                  {poolMeta?.config.maintenanceIntervalMinutes || 15} 分钟
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">距离下次维护:</span>
                <span className="text-sm font-medium text-indigo-600">
                  {countdown}
                </span>
              </div>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">快速操作</h2>
            <div className="space-y-3">
              <button
                onClick={triggerMaintenance}
                disabled={maintaining}
                className={`w-full flex items-center justify-center px-4 py-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                  maintaining
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                }`}
              >
                {maintaining ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    维护中...
                  </>
                ) : (
                  <>
                    <svg className="-ml-1 mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    立即维护
                  </>
                )}
              </button>
              
              <button
                onClick={fetchPoolMeta}
                disabled={loading}
                className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <svg className="-ml-1 mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                刷新数据
              </button>
            </div>
          </div>
        </div>

        {/* 账号状态概览 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">账号状态概览</h2>
          
          {poolMeta?.accounts && poolMeta.accounts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      账号 ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      状态
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      支持模型
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      备注
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      最后更新
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {poolMeta.accounts.map((account) => (
                    <tr key={account.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                        {account.id.slice(0, 8)}...
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          account.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {account.status === 'active' ? '可用' : '禁用'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {account.supportedModels.length > 0
                          ? account.supportedModels.join(', ')
                          : '全部'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {account.note || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatTimestamp(account.lastUpdated)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">暂无账号</h3>
              <p className="mt-1 text-sm text-gray-500">开始添加账号以使用账号池功能</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
