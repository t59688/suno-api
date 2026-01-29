/**
 * 管理界面仪表盘测试
 * 验证仪表盘页面的基本功能
 */

import { describe, it, expect } from 'vitest';

describe('管理界面仪表盘', () => {
  it('应该导出仪表盘组件', async () => {
    // 动态导入页面组件
    const module = await import('../src/app/admin/pool/page');
    expect(module.default).toBeDefined();
    expect(typeof module.default).toBe('function');
  });

  it('应该导出登录页面组件', async () => {
    // 动态导入登录页面组件
    const module = await import('../src/app/admin/pool/login/page');
    expect(module.default).toBeDefined();
    expect(typeof module.default).toBe('function');
  });
});
