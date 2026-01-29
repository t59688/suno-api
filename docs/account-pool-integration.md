# 账号池系统集成指南

## 概述

账号池管理系统已集成到 Suno API 项目中,提供全自动化的多账号管理功能。系统对外部 API 调用方完全透明,无需修改现有 API 接口。

## 主要变化

### 1. 环境变量配置

**不再需要的环境变量:**
- `SUNO_COOKIE` - 所有账号 Cookie 现在通过账号池管理
- `TWOCAPTCHA_KEY` - 可以通过管理界面配置,存储在数据库中

**新增的环境变量:**
- `POOL_MAINTENANCE_INTERVAL` - 账号池维护间隔(分钟),默认 15 分钟

**向后兼容:**
- 如果设置了 `SUNO_COOKIE` 环境变量,系统仍然可以使用(用于测试或单账号模式)
- 如果设置了 `TWOCAPTCHA_KEY` 环境变量,会作为默认值使用

### 2. 系统启动

账号池系统在 Next.js 应用启动时自动初始化:

1. 加载数据库中的所有账号
2. 对活跃账号执行健康检查
3. 检查是否需要启动自愈(如果上次维护时间超过间隔)
4. 启动定时维护任务

### 3. API 集成

现有 API 端点已自动集成账号池:

- **生成类接口** (generate, custom_generate): 根据模型参数筛选账号
- **查询类接口** (get, get_limit): 使用轮询算法选择账号
- **自动重试**: 当账号失败时自动切换到其他账号重试(最多 3 次)
- **自动熔断**: 认证错误(401/403)时自动禁用失效账号

## 使用方式

### 方式 1: 通过管理界面

1. 访问 `/admin/pool/login` 登录管理界面
2. 在账号管理页面添加账号
3. 系统自动验证账号并加入账号池
4. API 请求会自动使用账号池中的账号

### 方式 2: 通过 API

```bash
# 添加账号
curl -X POST http://localhost:3000/api/pool/accounts \
  -H "Authorization: Basic c3VwZXI6eW91cl9wYXNzd29yZA==" \
  -H "Content-Type: application/json" \
  -d '{
    "cookie": "your_suno_cookie_here",
    "supportedModels": ["chirp-crow"],
    "note": "生产账号 1"
  }'

# 查询账号列表
curl http://localhost:3000/api/pool/accounts \
  -H "Authorization: Basic c3VwZXI6eW91cl9wYXNzd29yZA=="

# 触发维护
curl -X POST http://localhost:3000/api/pool/maintenance \
  -H "Authorization: Basic c3VwZXI6eW91cl9wYXNzd29yZA=="
```

### 方式 3: 在代码中使用

```typescript
import { getSunoApiFromPool, callWithRetry } from '@/lib/pool/pool-api-helper';

// 直接获取 API 实例
const { api, account } = await getSunoApiFromPool({
  model: 'chirp-crow',
  requireModelFilter: true
});

// 使用带重试的 API 调用
const result = await callWithRetry(
  { model: 'chirp-crow', requireModelFilter: true },
  async (api) => {
    return await api.generate('test prompt');
  }
);
```

## 数据库结构

账号池数据存储在 `./data/account-pool.db` SQLite 数据库中:

- **accounts** - 账号信息表
- **system_config** - 系统配置表(包括 TWOCAPTCHA_KEY)
- **maintenance_logs** - 维护日志表

## 维护机制

### 自动维护

- 默认每 15 分钟执行一次
- 对所有活跃账号执行保活操作
- 更新 Cookie 并记录日志
- 失败的账号自动标记为禁用

### 启动自愈

系统启动时检查:
- 如果上次维护时间超过维护间隔
- 自动触发一次全量维护
- 确保账号池始终处于健康状态

### 手动维护

- 通过管理界面点击"立即维护"按钮
- 通过 API 调用 `/api/pool/maintenance`

## 熔断机制

当账号在请求中返回认证错误时:

1. 自动将账号标记为禁用
2. 从可用账号列表中移除
3. 记录熔断日志
4. 自动切换到其他账号重试

## 监控和日志

### 查看日志

- 管理界面: `/admin/pool/logs`
- API: `GET /api/pool/logs`

### 统计信息

- 管理界面: `/admin/pool`
- API: `GET /api/pool/meta`

包含:
- 总账号数
- 活跃账号数
- 禁用账号数
- 上次维护时间

## 故障排查

### 问题: 没有可用账号

**原因:**
- 所有账号都被禁用
- 没有账号支持请求的模型

**解决:**
1. 检查账号列表,查看账号状态
2. 查看日志,了解账号失效原因
3. 手动恢复账号或添加新账号

### 问题: 账号频繁失效

**原因:**
- Cookie 过期
- 账号被 Suno 限制
- 网络问题

**解决:**
1. 更新账号 Cookie
2. 增加维护间隔
3. 检查网络连接

### 问题: 维护失败

**原因:**
- TWOCAPTCHA_KEY 未配置
- 网络问题
- Suno 服务异常

**解决:**
1. 配置 TWOCAPTCHA_KEY
2. 检查网络连接
3. 查看详细日志

## 性能优化

### 缓存机制

- SunoApi 实例按 Cookie 缓存
- 避免重复初始化
- 提高响应速度

### 并发控制

- 数据库使用 WAL 模式
- 支持并发读写
- 事务保证数据一致性

### 负载均衡

- 轮询算法确保公平分配
- 模型筛选提高成功率
- 自动重试提高可用性

## 安全性

### 认证保护

- 管理 API 使用 HTTP Basic Auth
- 密码使用 bcrypt 哈希存储
- 首次启动生成临时密码

### Cookie 脱敏

- API 返回的 Cookie 只显示前 10 个字符
- 日志中的敏感信息自动脱敏
- 数据库中存储完整 Cookie

## 迁移指南

### 从单账号模式迁移

1. 备份现有的 `SUNO_COOKIE` 环境变量
2. 通过管理界面或 API 添加账号到账号池
3. 移除 `.env` 文件中的 `SUNO_COOKIE` 配置
4. 重启应用

### 数据迁移

如果需要迁移现有数据:

```bash
# 备份数据库
cp data/account-pool.db data/account-pool.db.backup

# 恢复数据库
cp data/account-pool.db.backup data/account-pool.db
```

## 最佳实践

1. **定期检查账号状态** - 通过管理界面或 API 监控账号健康
2. **配置合理的维护间隔** - 根据使用频率调整维护间隔
3. **保持多个活跃账号** - 至少 3-5 个账号以确保高可用性
4. **及时更新失效账号** - 发现失效账号及时更新 Cookie
5. **监控日志** - 定期查看日志,了解系统运行状况
6. **备份数据库** - 定期备份账号池数据库

## 技术支持

如有问题,请查看:
- 项目 README.md
- GitHub Issues
- 管理界面日志页面
