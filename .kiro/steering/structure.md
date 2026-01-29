# 项目结构

## 目录组织

```
suno-api/
├── src/                          # 源代码目录
│   ├── app/                      # Next.js App Router
│   │   ├── api/                  # API 路由端点
│   │   │   ├── generate/         # 音乐生成 API
│   │   │   ├── custom_generate/  # 自定义模式生成
│   │   │   ├── generate_lyrics/  # 歌词生成
│   │   │   ├── extend_audio/     # 音频扩展
│   │   │   ├── generate_stems/   # 音轨分离
│   │   │   ├── get/              # 获取音乐信息
│   │   │   ├── get_limit/        # 获取配额信息
│   │   │   ├── clip/             # 获取片段信息
│   │   │   ├── concat/           # 拼接完整歌曲
│   │   │   └── pool/             # 账户池相关 API
│   │   ├── components/           # React 组件
│   │   ├── docs/                 # API 文档页面
│   │   ├── v1/chat/completions/  # OpenAI 兼容 API
│   │   ├── layout.tsx            # 根布局
│   │   └── page.tsx              # 首页
│   └── lib/                      # 核心库
│       ├── SunoApi.ts            # Suno API 核心实现
│       ├── utils.ts              # 工具函数
│       └── pool/                 # 账户池功能
├── docs/                         # 项目文档
│   ├── auth-requests-reference.md
│   ├── clerk-auth-architecture.md
│   ├── cookie-pool-architecture.md
│   └── suno-pool-plan.md
├── public/                       # 静态资源
│   ├── swagger-suno-api.json     # API 规范
│   └── *.png, *.jpg              # 图片资源
├── test/                         # 测试文件
├── .kiro/                        # Kiro 配置
│   ├── steering/                 # 指导规则
│   └── specs/                    # 规格文档
├── docker-compose.yml            # Docker Compose 配置
├── Dockerfile                    # Docker 镜像定义
├── package.json                  # 项目依赖
└── next.config.mjs               # Next.js 配置
```

## 核心文件说明

### src/lib/SunoApi.ts
- Suno API 的核心实现类
- 处理认证、会话管理、验证码解决
- 实现所有音乐生成相关方法
- 包含浏览器自动化逻辑

### src/app/api/*/route.ts
- Next.js API 路由处理器
- 每个端点一个文件夹
- 导出 POST/GET/OPTIONS 等 HTTP 方法
- 统一错误处理和 CORS 头

### src/lib/utils.ts
- 通用工具函数
- CORS 头配置
- 辅助方法

## API 路由模式

所有 API 路由遵循以下模式：
1. 从请求中提取参数
2. 从 cookies 获取认证信息
3. 调用 SunoApi 实例方法
4. 返回 JSON 响应，包含 CORS 头
5. 统一错误处理

## 命名约定

- **文件名**：kebab-case（如 `custom_generate`）
- **组件**：PascalCase（如 `Header.tsx`）
- **变量/函数**：camelCase（如 `audioInfo`）
- **常量**：UPPER_SNAKE_CASE（如 `DEFAULT_MODEL`）
- **类型/接口**：PascalCase（如 `AudioInfo`）

## 代码组织原则

1. **关注点分离**：API 路由只处理 HTTP，业务逻辑在 SunoApi 类中
2. **类型安全**：所有接口和类型定义在 SunoApi.ts 中
3. **可复用性**：通用逻辑抽取到 utils.ts
4. **文档化**：关键函数使用 JSDoc 注释
