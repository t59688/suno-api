# 需求文档

## 简介

账号池管理系统是一个全自动化的多账号管理解决方案，旨在解决 Suno API 项目中单账号限制、手动维护繁琐、缺乏智能调度和稳定性差等问题。系统作为内部实现层，对外部 API 调用方完全透明，无需修改现有 API 接口。系统通过持久化存储、智能负载均衡、自动保活机制和可视化管理界面，实现零感知接入、智能调度、自动维护和完整监控的目标。

**关键设计原则：**
- 对外 API 接口保持完全不变，账号池作为内部实现
- 环境变量不再配置 SUNO_COOKIE，所有 Cookie 由账号池统一管理
- TWOCAPTCHA_KEY 存储在数据库中，支持动态配置

## 术语表

- **Account_Pool**：账号池，管理多个 Suno 账号的核心系统
- **Cookie**：Suno 账号的认证凭证字符串
- **Account**：单个 Suno 账号实体，包含 Cookie、状态、支持模型等信息
- **Active_Status**：活跃状态，表示账号可用且正常工作
- **Disabled_Status**：禁用状态，表示账号不可用或已失效
- **Maintenance**：维护操作，指对账号进行保活和健康检查
- **Round_Robin**：轮询算法，一种负载均衡策略
- **Model**：音乐生成模型类型（如 chirp-crow）
- **Health_Check**：健康检查，验证账号 Cookie 是否有效的操作
- **Circuit_Breaker**：熔断机制，自动隔离失效账号的保护机制
- **Storage**：持久化存储层，用于保存账号数据
- **System_Config**：系统配置，包括 TWOCAPTCHA_KEY 等全局配置项
- **API_Layer**：对外 API 层，保持现有接口不变

## 需求

### 需求 1：系统配置管理

**用户故事：** 作为系统管理员，我希望系统配置（如 TWOCAPTCHA_KEY）能够存储在数据库中，以便动态修改而无需重启服务。

#### 验收标准

1. THE System_Config SHALL 将 TWOCAPTCHA_KEY 存储在 Storage 中而非环境变量
2. WHEN 系统启动时，THE System_Config SHALL 从 Storage 加载 TWOCAPTCHA_KEY
3. WHEN TWOCAPTCHA_KEY 未配置时，THE System_Config SHALL 记录警告日志并允许系统继续运行
4. THE System_Config SHALL 提供 API 接口用于更新 TWOCAPTCHA_KEY，更新后立即生效无需重启
5. THE System_Config SHALL 支持通过管理界面修改 TWOCAPTCHA_KEY

### 需求 2：API 层透明集成

**用户故事：** 作为 API 调用方，我希望使用账号池后现有 API 接口保持完全不变，以便无缝升级而不影响现有集成。

#### 验收标准

1. THE API_Layer SHALL 保持所有现有 API 端点的路径、请求参数和响应格式完全不变
2. WHEN 接收到 API 请求时，THE API_Layer SHALL 从 Account_Pool 获取可用账号而不是从环境变量读取 SUNO_COOKIE
3. WHEN 环境变量中存在 SUNO_COOKIE 时，THE API_Layer SHALL 忽略该配置并使用 Account_Pool
4. THE API_Layer SHALL 在内部透明地处理账号选择、重试和熔断，对外部调用方完全不可见

### 需求 3：账号持久化存储

**用户故事：** 作为系统管理员，我希望账号信息能够持久化存储，以便系统重启后能够自动恢复账号池状态。

#### 验收标准

1. THE Storage SHALL 存储账号的完整信息，包括唯一 ID、Cookie 字符串、状态标识、支持的模型列表、备注信息和最后更新时间
2. WHEN 系统启动时，THE Account_Pool SHALL 从 Storage 加载所有已保存的账号
3. WHEN 账号信息发生变更时，THE Account_Pool SHALL 立即将变更同步到 Storage
4. THE Storage SHALL 支持并发读写操作而不发生数据损坏

### 需求 4：账号初始化与验证

**用户故事：** 作为系统管理员，我希望系统启动时能够自动验证所有账号的有效性，以便及时发现失效账号。

#### 验收标准

1. WHEN 系统启动时，THE Account_Pool SHALL 对所有状态为 Active_Status 的账号执行 Health_Check
2. WHEN Health_Check 失败时，THE Account_Pool SHALL 将该账号状态更新为 Disabled_Status
3. WHEN Health_Check 成功时，THE Account_Pool SHALL 将该账号加入可用账号列表
4. THE Account_Pool SHALL 记录每次初始化验证的结果日志

### 需求 5：负载均衡调度

**用户故事：** 作为 API 调用方，我希望系统能够智能分配请求到不同账号，以便实现负载均衡和高可用性。

#### 验收标准

1. WHEN 接收到不指定 Model 的请求时，THE Account_Pool SHALL 使用 Round_Robin 算法从所有 Active_Status 账号中选择一个
2. WHEN Round_Robin 选择下一个账号时，THE Account_Pool SHALL 确保请求均匀分布到所有可用账号
3. WHEN 所有账号均为 Disabled_Status 时，THE Account_Pool SHALL 返回明确的无可用账号错误
4. THE Account_Pool SHALL 维护轮询计数器以实现公平调度

### 需求 6：基于模型的智能路由

**用户故事：** 作为 API 调用方，我希望系统能够根据请求的模型类型自动选择支持该模型的账号，以便确保请求能够成功处理。

#### 验收标准

1. WHEN 请求指定了 Model 参数时，THE Account_Pool SHALL 仅从支持该 Model 的 Active_Status 账号中选择
2. WHEN 账号未配置支持模型列表时，THE Account_Pool SHALL 视该账号为支持所有模型
3. WHEN 没有账号支持请求的 Model 时，THE Account_Pool SHALL 返回明确的模型不支持错误信息
4. THE Account_Pool SHALL 在支持指定 Model 的账号间使用 Round_Robin 算法

### 需求 7：定时自动维护

**用户故事：** 作为系统管理员，我希望系统能够定时自动维护所有账号，以便保持 Cookie 的有效性和账号的活跃状态。

#### 验收标准

1. THE Account_Pool SHALL 支持配置维护间隔时间（默认 15 分钟）
2. WHEN 维护间隔时间到达时，THE Account_Pool SHALL 自动对所有 Active_Status 账号执行 Maintenance 操作
3. WHEN Maintenance 成功时，THE Account_Pool SHALL 获取最新的 Cookie 并更新到 Storage
4. WHEN Maintenance 失败时，THE Account_Pool SHALL 将该账号标记为 Disabled_Status 并记录失败原因
5. THE Account_Pool SHALL 记录每次维护操作的开始时间、结束时间和结果

### 需求 8：自动熔断机制

**用户故事：** 作为系统运维人员，我希望系统能够自动识别和隔离失效账号，以便避免失效账号影响服务质量。

#### 验收标准

1. WHEN 账号在请求处理中返回 401 认证错误时，THE Circuit_Breaker SHALL 立即将该账号标记为 Disabled_Status
2. WHEN 账号在请求处理中返回 403 认证错误时，THE Circuit_Breaker SHALL 立即将该账号标记为 Disabled_Status
3. WHEN 账号被标记为 Disabled_Status 时，THE Account_Pool SHALL 立即将其从可用账号列表中移除
4. WHEN 账号被熔断时，THE Account_Pool SHALL 记录详细的失效日志，包括账号 ID、失效时间和错误信息

### 需求 9：启动自愈机制

**用户故事：** 作为系统运维人员，我希望系统重启后能够自动检测是否需要维护，以便确保账号池始终处于健康状态。

#### 验收标准

1. WHEN 系统启动时，THE Account_Pool SHALL 读取上次维护时间戳
2. WHEN 当前时间与上次维护时间的差值超过维护间隔时，THE Account_Pool SHALL 立即触发一次全量 Maintenance
3. WHEN 启动维护完成时，THE Account_Pool SHALL 更新维护时间戳到 Storage
4. THE Account_Pool SHALL 在启动维护期间阻塞外部请求，直到维护完成

### 需求 10：账号管理 API

**用户故事：** 作为系统集成方，我希望通过 RESTful API 管理账号，以便实现自动化运维和集成。

#### 验收标准

1. WHEN 调用添加账号 API 时，THE Account_Pool SHALL 验证 Cookie 有效性，验证成功后生成唯一 ID 并保存到 Storage
2. WHEN 调用查询账号 API 时，THE Account_Pool SHALL 返回账号详细信息，其中 Cookie 字段需进行脱敏处理（仅显示前 10 个字符）
3. WHEN 调用更新账号 API 时，THE Account_Pool SHALL 支持更新 Cookie、支持模型列表、备注和状态
4. WHEN 调用删除账号 API 时，THE Account_Pool SHALL 从 Storage 和内存池中彻底移除该账号
5. WHEN 调用获取池信息 API 时，THE Account_Pool SHALL 返回所有账号列表（脱敏）、统计数据和元数据
6. WHEN 调用触发维护 API 时，THE Account_Pool SHALL 立即执行一次全量 Maintenance 操作

### 需求 11：管理界面仪表盘

**用户故事：** 作为系统管理员，我希望通过可视化仪表盘查看系统状态，以便快速了解账号池的健康状况。

#### 验收标准

1. WHEN 访问仪表盘页面时，THE Dashboard SHALL 显示可用账号数量和总账号数量
2. WHEN 访问仪表盘页面时，THE Dashboard SHALL 显示上次维护时间和距离下次维护的倒计时
3. WHEN 访问仪表盘页面时，THE Dashboard SHALL 提供"立即维护"按钮，点击后触发全量 Maintenance
4. THE Dashboard SHALL 使用颜色区分不同状态的账号（绿色表示 Active_Status，红色表示 Disabled_Status）
5. WHEN 访问仪表盘页面时，THE Dashboard SHALL 显示当前配置的 TWOCAPTCHA_KEY 状态（已配置/未配置）

### 需求 12：账号列表管理

**用户故事：** 作为系统管理员，我希望通过管理界面查看和管理所有账号，以便进行日常运维操作。

#### 验收标准

1. WHEN 访问账号列表页面时，THE Management_UI SHALL 显示所有账号的 ID、状态、Cookie 脱敏预览、支持模型、备注和最后更新时间
2. WHEN 点击新增账号按钮时，THE Management_UI SHALL 显示表单，要求输入完整 Cookie（必填）、支持模型（多选）和备注
3. WHEN 提交新增账号表单时，THE Management_UI SHALL 调用添加账号 API 并显示验证结果
4. WHEN 点击编辑账号按钮时，THE Management_UI SHALL 显示编辑表单，支持修改状态、模型配置、备注和 Cookie
5. WHEN 点击删除账号按钮时，THE Management_UI SHALL 显示确认对话框，确认后调用删除账号 API

### 需求 13：日志查询功能

**用户故事：** 作为系统运维人员，我希望查询系统运行日志，以便排查问题和审计操作。

#### 验收标准

1. WHEN 访问日志页面时，THE Log_Viewer SHALL 显示系统日志，包括账号初始化、维护结果和异常报错
2. WHEN 选择账号 ID 筛选时，THE Log_Viewer SHALL 仅显示与该账号相关的日志
3. WHEN 显示日志时，THE Log_Viewer SHALL 按时间倒序排列，最新日志在最前
4. THE Log_Viewer SHALL 支持分页显示，每页显示 50 条日志

### 需求 14：访问控制与管理员认证

**用户故事：** 作为系统安全管理员，我希望管理界面具备访问控制和管理员认证，以便防止未授权访问。

#### 验收标准

1. THE Access_Control SHALL 使用固定的管理员用户名"super"进行身份验证
2. WHEN 系统首次启动且未设置管理员密码时，THE Access_Control SHALL 要求初始化管理员密码
3. WHEN 访问管理页面时，THE Access_Control SHALL 验证请求是否包含有效的用户名和密码
4. WHEN 认证凭证无效或缺失时，THE Access_Control SHALL 返回 401 未授权错误
5. THE Access_Control SHALL 提供重置管理员密码的功能，需要验证旧密码后才能设置新密码
6. THE Access_Control SHALL 将管理员密码以加密形式存储到 Storage
7. THE Access_Control SHALL 支持通过环境变量配置允许访问的 IP 地址白名单

### 需求 15：管理员密码管理

**用户故事：** 作为系统管理员，我希望能够初始化和重置管理员密码，以便安全地管理系统访问权限。

#### 验收标准

1. WHEN 系统首次启动且 Storage 中不存在管理员密码时，THE Access_Control SHALL 生成一个临时密码并记录到日志
2. WHEN 使用临时密码首次登录时，THE Access_Control SHALL 强制要求修改密码
3. WHEN 管理员请求重置密码时，THE Access_Control SHALL 验证当前密码，验证成功后允许设置新密码
4. WHEN 新密码长度小于 8 个字符时，THE Access_Control SHALL 拒绝密码设置并返回错误信息
5. THE Access_Control SHALL 使用安全的哈希算法（如 bcrypt）存储密码
6. THE Access_Control SHALL 记录所有密码修改操作的日志，包括操作时间和 IP 地址

### 需求 16：请求级重试机制

**用户故事：** 作为 API 调用方，我希望当某个账号失败时系统能够自动切换到其他账号重试，以便提高请求成功率。

#### 验收标准

1. WHEN 使用某个账号处理请求时发生认证错误，THE Account_Pool SHALL 尝试从池中选择另一个可用账号重试
2. WHEN 重试次数达到最大限制（3 次）时，THE Account_Pool SHALL 返回请求失败错误
3. WHEN 重试成功时，THE Account_Pool SHALL 记录重试日志，包括失败账号 ID 和成功账号 ID
4. THE Account_Pool SHALL 在重试前将失败账号标记为 Disabled_Status

### 需求 17：手动恢复功能

**用户故事：** 作为系统管理员，我希望能够手动恢复被禁用的账号，以便在问题解决后重新启用账号。

#### 验收标准

1. WHEN 通过管理界面或 API 将 Disabled_Status 账号状态改为 Active_Status 时，THE Account_Pool SHALL 立即对该账号执行 Health_Check
2. WHEN Health_Check 成功时，THE Account_Pool SHALL 将该账号加入可用账号列表
3. WHEN Health_Check 失败时，THE Account_Pool SHALL 保持该账号为 Disabled_Status 并返回验证失败信息
4. THE Account_Pool SHALL 记录手动恢复操作的日志

### 需求 18：接口差异化处理

**用户故事：** 作为系统架构师，我希望系统能够区分不同类型的 API 接口，以便对需要模型筛选和不需要模型筛选的接口采用不同的调度策略。

#### 验收标准

1. WHEN 调用生成类接口（generate、custom_generate）时，THE Account_Pool SHALL 根据 Model 参数进行账号筛选
2. WHEN 调用查询类接口（get、get_limit、get_lyrics）时，THE Account_Pool SHALL 使用 Round_Robin 算法而不进行模型筛选
3. THE Account_Pool SHALL 维护一个接口类型配置表，明确标识哪些接口需要模型筛选
4. THE Account_Pool SHALL 允许通过配置文件或环境变量自定义接口类型配置
