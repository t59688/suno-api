'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * 账号接口
 */
interface Account {
  id: string;
  cookie: string;
  status: 'active' | 'disabled';
  supportedModels: string[];
  note: string;
  lastUpdated: number;
  creditsLeft?: number;
  monthlyLimit?: number;
  monthlyUsage?: number;
  creditsUpdatedAt?: number;
}

/**
 * 账号管理页面
 */
export default function AccountsPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // 添加账号表单
  const [showAddForm, setShowAddForm] = useState(false);
  const [addFormData, setAddFormData] = useState({
    cookie: '',
    supportedModels: '',
    note: '',
  });
  const [addLoading, setAddLoading] = useState(false);

  // 编辑账号
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [editFormData, setEditFormData] = useState({
    cookie: '',
    supportedModels: '',
    note: '',
  });
  const [editLoading, setEditLoading] = useState(false);

  // 查看完整 Cookie
  const [viewingAccount, setViewingAccount] = useState<Account | null>(null);
  const [fullCookie, setFullCookie] = useState<string>('');
  const [loadingFullCookie, setLoadingFullCookie] = useState(false);

  // 维护账号
  const [maintainingAccountId, setMaintainingAccountId] = useState<string | null>(null);

  /**
   * 获取账号列表
   */
  const fetchAccounts = async () => {
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

      const response = await fetch('/api/pool/accounts', {
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
        throw new Error('获取账号列表失败');
      }

      const data = await response.json();
      
      if (data.success) {
        setAccounts(data.accounts);
      } else {
        throw new Error(data.error || '获取账号列表失败');
      }
    } catch (err: any) {
      setError(err.message);
      console.error('获取账号列表失败:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 添加账号
   */
  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!addFormData.cookie.trim()) {
      setError('Cookie 不能为空');
      return;
    }

    try {
      setAddLoading(true);
      setError(null);

      const supportedModels = addFormData.supportedModels
        .split(',')
        .map(m => m.trim())
        .filter(m => m);

      const response = await fetch('/api/pool/accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + btoa('super:' + (localStorage.getItem('admin_password') || '')),
        },
        body: JSON.stringify({
          cookie: addFormData.cookie,
          supportedModels,
          note: addFormData.note,
        }),
      });

      if (response.status === 401) {
        router.push('/admin/pool/login');
        return;
      }

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || '添加账号失败');
      }

      setSuccessMessage('账号添加成功');
      setShowAddForm(false);
      setAddFormData({ cookie: '', supportedModels: '', note: '' });
      await fetchAccounts();
      
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message);
      console.error('添加账号失败:', err);
    } finally {
      setAddLoading(false);
    }
  };

  /**
   * 开始编辑账号
   */
  const startEdit = (account: Account) => {
    setEditingAccount(account);
    setEditFormData({
      cookie: account.cookie,
      supportedModels: account.supportedModels.join(', '),
      note: account.note,
    });
    setError(null);
  };

  /**
   * 更新账号
   */
  const handleUpdateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingAccount) return;

    try {
      setEditLoading(true);
      setError(null);

      const supportedModels = editFormData.supportedModels
        .split(',')
        .map(m => m.trim())
        .filter(m => m);

      const response = await fetch(`/api/pool/accounts/${editingAccount.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + btoa('super:' + (localStorage.getItem('admin_password') || '')),
        },
        body: JSON.stringify({
          cookie: editFormData.cookie,
          supportedModels,
          note: editFormData.note,
        }),
      });

      if (response.status === 401) {
        router.push('/admin/pool/login');
        return;
      }

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || '更新账号失败');
      }

      setSuccessMessage('账号更新成功');
      setEditingAccount(null);
      await fetchAccounts();
      
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message);
      console.error('更新账号失败:', err);
    } finally {
      setEditLoading(false);
    }
  };

  /**
   * 切换账号状态
   */
  const toggleAccountStatus = async (account: Account) => {
    const newStatus = account.status === 'active' ? 'disabled' : 'active';
    
    try {
      setError(null);

      const response = await fetch(`/api/pool/accounts/${account.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + btoa('super:' + (localStorage.getItem('admin_password') || '')),
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.status === 401) {
        router.push('/admin/pool/login');
        return;
      }

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || '更新状态失败');
      }

      setSuccessMessage(`账号已${newStatus === 'active' ? '启用' : '禁用'}`);
      await fetchAccounts();
      
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message);
      console.error('更新状态失败:', err);
    }
  };

  /**
   * 删除账号
   */
  const handleDeleteAccount = async (account: Account) => {
    if (!confirm(`确定要删除账号 ${account.id.slice(0, 8)}... 吗？此操作不可恢复。`)) {
      return;
    }

    try {
      setError(null);

      const response = await fetch(`/api/pool/accounts/${account.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': 'Basic ' + btoa('super:' + (localStorage.getItem('admin_password') || '')),
        },
      });

      if (response.status === 401) {
        router.push('/admin/pool/login');
        return;
      }

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || '删除账号失败');
      }

      setSuccessMessage('账号已删除');
      await fetchAccounts();
      
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message);
      console.error('删除账号失败:', err);
    }
  };

  /**
   * 维护账号
   */
  const handleMaintainAccount = async (account: Account) => {
    const savedPassword = localStorage.getItem('admin_password');
    if (!savedPassword) {
      router.push('/admin/pool/login');
      return;
    }

    try {
      setMaintainingAccountId(account.id);
      setError(null);

      const response = await fetch(`/api/pool/accounts/${account.id}/maintain`, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa('super:' + savedPassword),
        },
      });

      if (response.status === 401) {
        localStorage.removeItem('admin_password');
        router.push('/admin/pool/login');
        return;
      }

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || '维护失败');
      }

      setSuccessMessage(data.message || '维护成功');
      await fetchAccounts();
      
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message);
      console.error('维护账号失败:', err);
    } finally {
      setMaintainingAccountId(null);
    }
  };

  /**
   * 查看完整 Cookie
   */
  const viewFullCookie = async (account: Account) => {
    const savedPassword = localStorage.getItem('admin_password');
    if (!savedPassword) {
      router.push('/admin/pool/login');
      return;
    }

    try {
      setLoadingFullCookie(true);
      setError(null);

      const response = await fetch(`/api/pool/accounts/${account.id}?full=true`, {
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
        throw new Error('获取完整 Cookie 失败');
      }

      const data = await response.json();
      
      if (data.success) {
        setViewingAccount(account);
        setFullCookie(data.account.cookie);
      } else {
        throw new Error(data.error || '获取完整 Cookie 失败');
      }
    } catch (err: any) {
      setError(err.message);
      console.error('获取完整 Cookie 失败:', err);
    } finally {
      setLoadingFullCookie(false);
    }
  };

  /**
   * 复制到剪贴板
   */
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setSuccessMessage('已复制到剪贴板');
      setTimeout(() => setSuccessMessage(null), 2000);
    }).catch(() => {
      setError('复制失败');
    });
  };

  /**
   * 格式化时间戳
   */
  const formatTimestamp = (timestamp: number): string => {
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
    fetchAccounts();
  }, []);

  if (loading && accounts.length === 0) {
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
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">账号管理</h1>
            <p className="mt-2 text-gray-600">管理 Suno 账号池中的所有账号</p>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-6 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 flex items-center"
          >
            <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            添加账号
          </button>
        </div>

        {/* 成功提示 */}
        {successMessage && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-800">{successMessage}</p>
              </div>
            </div>
          </div>
        )}

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

        {/* 添加账号表单 */}
        {showAddForm && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">添加新账号</h3>
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    setAddFormData({ cookie: '', supportedModels: '', note: '' });
                  }}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <form onSubmit={handleAddAccount} className="space-y-4">
                <div>
                  <label htmlFor="add-cookie" className="block text-sm font-medium text-gray-700 mb-2">
                    Cookie <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="add-cookie"
                    value={addFormData.cookie}
                    onChange={(e) => setAddFormData({ ...addFormData, cookie: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="输入完整的 Suno Cookie"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="add-models" className="block text-sm font-medium text-gray-700 mb-2">
                    支持的模型（可选）
                  </label>
                  <input
                    type="text"
                    id="add-models"
                    value={addFormData.supportedModels}
                    onChange={(e) => setAddFormData({ ...addFormData, supportedModels: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="用逗号分隔，留空表示支持所有模型"
                  />
                  <p className="mt-1 text-sm text-gray-500">例如: chirp-v3-5, chirp-v3-0</p>
                </div>

                <div>
                  <label htmlFor="add-note" className="block text-sm font-medium text-gray-700 mb-2">
                    备注（可选）
                  </label>
                  <input
                    type="text"
                    id="add-note"
                    value={addFormData.note}
                    onChange={(e) => setAddFormData({ ...addFormData, note: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="添加备注信息"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      setAddFormData({ cookie: '', supportedModels: '', note: '' });
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={addLoading}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-gray-400"
                  >
                    {addLoading ? '添加中...' : '添加账号'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 编辑账号表单 */}
        {editingAccount && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">编辑账号</h3>
                <button
                  onClick={() => setEditingAccount(null)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <form onSubmit={handleUpdateAccount} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    账号 ID
                  </label>
                  <input
                    type="text"
                    value={editingAccount.id}
                    disabled
                    className="w-full px-4 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                  />
                </div>

                <div>
                  <label htmlFor="edit-cookie" className="block text-sm font-medium text-gray-700 mb-2">
                    Cookie
                  </label>
                  <textarea
                    id="edit-cookie"
                    value={editFormData.cookie}
                    onChange={(e) => setEditFormData({ ...editFormData, cookie: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label htmlFor="edit-models" className="block text-sm font-medium text-gray-700 mb-2">
                    支持的模型
                  </label>
                  <input
                    type="text"
                    id="edit-models"
                    value={editFormData.supportedModels}
                    onChange={(e) => setEditFormData({ ...editFormData, supportedModels: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="用逗号分隔，留空表示支持所有模型"
                  />
                </div>

                <div>
                  <label htmlFor="edit-note" className="block text-sm font-medium text-gray-700 mb-2">
                    备注
                  </label>
                  <input
                    type="text"
                    id="edit-note"
                    value={editFormData.note}
                    onChange={(e) => setEditFormData({ ...editFormData, note: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setEditingAccount(null)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={editLoading}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-gray-400"
                  >
                    {editLoading ? '更新中...' : '更新账号'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 查看完整 Cookie 弹窗 */}
        {viewingAccount && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-full max-w-3xl shadow-lg rounded-md bg-white">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">查看完整 Cookie</h3>
                <button
                  onClick={() => {
                    setViewingAccount(null);
                    setFullCookie('');
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    账号 ID
                  </label>
                  <input
                    type="text"
                    value={viewingAccount.id}
                    disabled
                    className="w-full px-4 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 font-mono text-sm"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      完整 Cookie
                    </label>
                    <button
                      onClick={() => copyToClipboard(fullCookie)}
                      className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center"
                    >
                      <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      复制
                    </button>
                  </div>
                  {loadingFullCookie ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    </div>
                  ) : (
                    <textarea
                      value={fullCookie}
                      readOnly
                      rows={8}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900 font-mono text-sm"
                    />
                  )}
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                  <div className="flex">
                    <svg className="h-5 w-5 text-yellow-400 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <p className="text-sm text-yellow-800">
                      请妥善保管 Cookie 信息，不要泄露给他人
                    </p>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    onClick={() => {
                      setViewingAccount(null);
                      setFullCookie('');
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

        {/* 账号列表 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {accounts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      账号 ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cookie
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      状态
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      积分信息
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
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {accounts.map((account) => (
                    <tr key={account.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                        {account.id.slice(0, 8)}...
                      </td>
                      <td className="px-6 py-4 text-sm font-mono text-gray-500 max-w-xs truncate">
                        <div className="flex items-center">
                          <span className="truncate">{account.cookie}</span>
                          <button
                            onClick={() => viewFullCookie(account)}
                            className="ml-2 text-indigo-600 hover:text-indigo-700 text-xs whitespace-nowrap"
                          >
                            查看
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => toggleAccountStatus(account)}
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer ${
                            account.status === 'active'
                              ? 'bg-green-100 text-green-800 hover:bg-green-200'
                              : 'bg-red-100 text-red-800 hover:bg-red-200'
                          }`}
                        >
                          {account.status === 'active' ? '可用' : '禁用'}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {account.creditsLeft !== undefined ? (
                          <div className="space-y-1">
                            <div className="flex items-center">
                              <span className="font-medium text-indigo-600">{account.creditsLeft}</span>
                              <span className="text-gray-500 ml-1">积分</span>
                            </div>
                            {account.monthlyUsage !== undefined && account.monthlyLimit !== undefined && (
                              <div className="text-xs text-gray-500">
                                月度: {account.monthlyUsage}/{account.monthlyLimit}
                              </div>
                            )}
                            {account.creditsUpdatedAt && (
                              <div className="text-xs text-gray-400">
                                {new Date(account.creditsUpdatedAt).toLocaleString('zh-CN', {
                                  month: '2-digit',
                                  day: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">未检测</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {account.supportedModels.length > 0
                          ? account.supportedModels.join(', ')
                          : '全部'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                        {account.note || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatTimestamp(account.lastUpdated)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleMaintainAccount(account)}
                          disabled={maintainingAccountId === account.id}
                          className={`mr-3 ${
                            maintainingAccountId === account.id
                              ? 'text-gray-400 cursor-not-allowed'
                              : account.status === 'active'
                              ? 'text-green-600 hover:text-green-900'
                              : 'text-orange-600 hover:text-orange-900'
                          }`}
                          title={
                            maintainingAccountId === account.id
                              ? '维护中...'
                              : account.status === 'active'
                              ? '立即维护此账号'
                              : '尝试恢复此账号'
                          }
                        >
                          {maintainingAccountId === account.id ? '维护中...' : '维护'}
                        </button>
                        <button
                          onClick={() => startEdit(account)}
                          className="text-indigo-600 hover:text-indigo-900 mr-3"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => handleDeleteAccount(account)}
                          className="text-red-600 hover:text-red-900"
                        >
                          删除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">暂无账号</h3>
              <p className="mt-1 text-sm text-gray-500">点击右上角"添加账号"按钮开始添加</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
