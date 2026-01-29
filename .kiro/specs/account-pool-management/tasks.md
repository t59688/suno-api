# 实现计划: 账号池管理系统

## 概述

本实现计划将账号池管理系统分解为离散的编码步骤,每个任务都建立在前面的任务之上。系统采用 TypeScript 实现,使用 SQLite(better-sqlite3)作为持久化存储,集成到现有的 Next.js Suno API 项目中。

## 任务

- [x] 1. 搭建数据库层基础设施
  - 创建 `src/lib/pool/db-manager.ts` 文件
  - 定义 Account、SystemConfig、MaintenanceLog 接口
  - 实现 DBManager 类的基本结构和单例模式
  - 实现数据库初始化和表结构创建
  - 添加 better-sqlite3 依赖到 package.json
  - _需求: 3.1, 3.2, 3.3, 3.4_

- [x] 1.1 为 DBManager 编写属性测试
  - **属性 1: 数据库持久化一致性**
  - **验证需求: 3.1, 3.2, 3.3**
  - **状态: 已完成 ✅**
  - **测试结果: 所有属性测试通过（100次迭代）**

- [x] 2. 实现数据库 CRUD 操作
  - [x] 2.1 实现账号管理方法
    - 实现 addAccount、getAccount、getAllAccounts 方法
    - 实现 updateAccount、deleteAccount 方法
    - 使用 UUID v4 生成账号 ID
    - _需求: 3.1, 3.2, 3.3_

  - [x] 2.2 为账号 CRUD 编写属性测试
    - **属性 8: 删除操作完整性**
    - **验证需求: 10.4**

  - [x] 2.3 实现系统配置方法
    - 实现 getConfig、setConfig 方法
    - _需求: 1.1, 1.2_

  - [x] 2.4 为配置操作编写属性测试
    - **属性 5: 配置更新即时生效**
    - **验证需求: 1.1, 1.2, 1.4**

  - [x] 2.5 实现日志管理方法
    - 实现 addLog、getLogs 方法
    - 支持按账号 ID 和时间范围筛选
    - _需求: 13.1, 13.2, 13.3_

  - [ ]* 2.6 为日志操作编写属性测试
    - **属性 9: 维护日志完整性**
    - **验证需求: 4.4, 7.5, 8.4, 17.4**

- [x] 3. 实现调度器和负载均衡
  - 创建 `src/lib/pool/scheduler.ts` 文件
  - 实现 Scheduler 类
  - 实现轮询算法(roundRobin 方法)
  - 实现基于模型的筛选(filterByModel 方法)
  - _需求: 5.1, 5.2, 5.4, 6.1, 6.2, 6.3_

- [x] 3.1 为调度器编写属性测试
  - **属性 2: 轮询算法公平性**
  - **验证需求: 5.1, 5.2, 5.4**

- [x] 3.2 为模型筛选编写属性测试
  - **属性 3: 模型筛选正确性**
  - **验证需求: 6.1, 6.2, 6.3**

- [x] 4. 实现维护服务
  - 创建 `src/lib/pool/maintenance-service.ts` 文件
  - 实现 MaintenanceService 类
  - 实现 healthCheck 方法(调用 SunoApi.get_limit)
  - 实现 keepAlive 方法
  - 实现 maintainAll 批量维护方法
  - _需求: 4.1, 4.2, 4.3, 7.1, 7.2, 7.3, 7.4_

- [x] 4.1 为维护服务编写单元测试
  - 测试健康检查成功和失败场景
  - 测试保活操作更新 Cookie
  - _需求: 4.1, 4.2, 4.3_

- [x] 5. 实现熔断器
  - 创建 `src/lib/pool/circuit-breaker.ts` 文件
  - 实现 CircuitBreaker 类
  - 实现 shouldBreak 方法(检查 401/403 错误)
  - 实现 handleAuthError 方法(更新账号状态为 disabled)
  - _需求: 8.1, 8.2, 8.3, 8.4_

- [x] 5.1 为熔断器编写属性测试
  - **属性 4: 熔断器隔离性**
  - **验证需求: 8.1, 8.2, 8.3**

- [x] 6. 实现账号池管理器
  - 创建 `src/lib/pool/account-pool.ts` 文件
  - 实现 AccountPool 类
  - 实现 initialize 方法(加载账号、执行启动自愈)
  - 实现 selectAccount 方法(集成调度器)
  - 实现 addAccount、updateAccountStatus、removeAccount 方法
  - 实现 startAutoMaintenance、stopAutoMaintenance、performMaintenance 方法
  - 实现 getPoolStats 方法
  - _需求: 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 7.1, 7.2, 7.3, 9.1, 9.2, 9.3, 10.1, 10.3, 10.4, 10.5_

- [x] 6.1 为账号池管理器编写单元测试
  - 测试初始化加载账号
  - 测试启动自愈触发条件
  - 测试定时维护
  - _需求: 4.1, 9.1, 9.2, 7.1_

- [x] 7. 检查点 - 核心业务逻辑完成
  - 确保所有测试通过,如有问题请询问用户

- [x] 8. 实现认证中间件
  - 创建 `src/lib/pool/auth-middleware.ts` 文件
  - 实现 AuthMiddleware 类
  - 实现 initializePassword 方法(生成临时密码)
  - 实现 verify 方法(使用 bcrypt 验证密码)
  - 实现 changePassword 方法
  - 实现 middleware 方法(HTTP Basic Auth)
  - 添加 bcrypt 依赖到 package.json
  - _需求: 14.1, 14.2, 14.3, 14.4, 15.1, 15.2, 15.3, 15.4, 15.5_

- [ ]* 8.1 为认证中间件编写属性测试
  - **属性 10: 密码哈希不可逆性**
  - **验证需求: 15.5**

- [ ]* 8.2 为认证中间件编写属性测试
  - **属性 11: 认证失败拒绝访问**
  - **验证需求: 14.3, 14.4**

- [x] 9. 修改现有 API 端点集成账号池
  - [x] 9.1 修改 generate API
    - 修改 `src/app/api/generate/route.ts`
    - 从账号池获取账号(requireModelFilter: true)
    - 集成熔断器和重试机制
    - _需求: 2.1, 2.2, 2.4, 16.1, 16.2, 16.3, 18.1_

  - [x] 9.2 修改 custom_generate API
    - 修改 `src/app/api/custom_generate/route.ts`
    - 从账号池获取账号(requireModelFilter: true)
    - 集成熔断器和重试机制
    - _需求: 2.1, 2.2, 2.4, 16.1, 16.2, 16.3, 18.1_

  - [x] 9.3 修改查询类 API
    - 修改 `src/app/api/get/route.ts`
    - 修改 `src/app/api/get_limit/route.ts`
    - 从账号池获取账号(requireModelFilter: false)
    - _需求: 2.1, 2.2, 2.4, 18.2_

- [x] 9.4 为 API 集成编写属性测试
  - **属性 13: 重试机制账号切换**
  - **验证需求: 16.1, 16.4**

- [x] 9.5 为 API 集成编写属性测试
  - **属性 15: 接口类型路由差异**
  - **验证需求: 18.1, 18.2**

- [x] 10. 实现账号池管理 API
  - [x] 10.1 实现添加账号 API
    - 创建 `src/app/api/pool/accounts/route.ts`
    - POST 方法: 添加账号,验证 Cookie,返回账号信息
    - 集成认证中间件
    - _需求: 10.1_

  - [x] 10.2 实现查询账号 API
    - GET 方法: 返回所有账号列表,Cookie 脱敏
    - 集成认证中间件
    - _需求: 10.2, 10.5_

  - [x] 10.3 为 Cookie 脱敏编写属性测试
    - **属性 7: Cookie 脱敏一致性**
    - **验证需求: 10.2**

  - [x] 10.4 实现更新和删除账号 API
    - 创建 `src/app/api/pool/accounts/[id]/route.ts`
    - PUT 方法: 更新账号信息
    - DELETE 方法: 删除账号
    - 集成认证中间件
    - _需求: 10.3, 10.4_

  - [x] 10.5 实现获取池信息 API
    - 创建 `src/app/api/pool/meta/route.ts`
    - GET 方法: 返回统计数据和元数据
    - 集成认证中间件
    - _需求: 10.5_

  - [x] 10.6 实现触发维护 API
    - 创建 `src/app/api/pool/maintenance/route.ts`
    - POST 方法: 立即执行全量维护
    - 集成认证中间件
    - _需求: 10.6_

  - [x] 10.7 实现日志查询 API
    - 创建 `src/app/api/pool/logs/route.ts`
    - GET 方法: 查询日志,支持筛选和分页
    - 集成认证中间件
    - _需求: 13.1, 13.2, 13.3, 13.4_

- [ ] 11. 检查点 - API 层完成
  - 确保所有测试通过,如有问题请询问用户

- [x] 12. 实现管理界面 - 仪表盘
  - 创建 `src/app/admin/pool/page.tsx`
  - 显示可用账号数量和总账号数量
  - 显示上次维护时间和倒计时
  - 提供"立即维护"按钮
  - 显示 TWOCAPTCHA_KEY 配置状态
  - _需求: 11.1, 11.2, 11.3, 11.5_

- [x] 13. 实现管理界面 - 账号列表
  - 创建 `src/app/admin/pool/accounts/page.tsx`
  - 显示账号列表表格(ID、状态、Cookie 预览、模型、备注、更新时间)
  - 实现新增账号表单
  - 实现编辑账号表单
  - 实现删除账号确认对话框
  - 使用颜色区分账号状态
  - _需求: 11.4, 12.1, 12.2, 12.3, 12.4, 12.5_

- [x] 14. 实现管理界面 - 日志查看
  - 创建 `src/app/admin/pool/logs/page.tsx`
  - 显示日志列表,按时间倒序
  - 支持按账号 ID 筛选
  - 实现分页(每页 50 条)
  - _需求: 13.1, 13.2, 13.3, 13.4_

- [x] 15. 实现管理界面 - 登录和认证
  - 创建 `src/app/admin/pool/login/page.tsx`
  - 实现登录表单(用户名 "super" + 密码)
  - 实现密码修改功能
  - 处理首次登录强制修改密码
  - _需求: 14.1, 14.2, 14.3, 14.4, 15.1, 15.2, 15.3, 15.4_

- [x] 15.1 为手动恢复功能编写属性测试
  - **属性 14: 手动恢复健康检查**
  - **验证需求: 17.1, 17.2, 17.3**

- [x] 16. 系统集成和启动配置
  - 修改 `src/lib/SunoApi.ts`,集成账号池
  - 在应用启动时初始化账号池
  - 配置定时维护(默认 15 分钟)
  - 更新环境变量文档,说明不再需要 SUNO_COOKIE
  - _需求: 2.1, 2.2, 2.3, 7.1, 7.2_

- [x] 16.1 编写集成测试
  - 测试端到端流程: 启动 → 加载账号 → 处理请求 → 返回响应
  - 测试添加账号流程: 添加 → 验证 → 可被选择
  - 测试熔断和重试流程: 失败 → 熔断 → 切换账号 → 重试

- [x] 17. 最终检查点
  - 确保所有测试通过,如有问题请询问用户
  - 验证管理界面功能完整
  - 验证 API 端点正常工作

## 注意事项

- 标记 `*` 的任务为可选任务,可以跳过以加快 MVP 开发
- 每个任务都引用了具体的需求编号,便于追溯
- 属性测试使用 fast-check 库,每个测试至少运行 100 次迭代
- 所有测试都必须通过才能完成任务
- 检查点任务用于确保增量验证

