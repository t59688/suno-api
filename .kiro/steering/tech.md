# 技术栈

## 核心框架

- **Next.js 14.1.4**：React 全栈框架，用于构建 Web 应用和 API
- **React 18**：前端 UI 库
- **TypeScript 5**：类型安全的 JavaScript 超集

## 关键依赖

### 浏览器自动化
- **rebrowser-playwright-core 1.49.1**：用于浏览器自动化和验证码处理
- **ghost-cursor-playwright**：模拟平滑的鼠标移动
- **@playwright/browser-chromium**：Chromium 浏览器支持

### 验证码处理
- **@2captcha/captcha-solver**：2Captcha 验证码解决服务集成

### HTTP 客户端
- **axios**：HTTP 请求库
- **cookie**：Cookie 解析和序列化

### 日志
- **pino**：高性能日志库
- **pino-pretty**：日志美化输出

### UI 组件
- **Tailwind CSS 3**：实用优先的 CSS 框架
- **swagger-ui-react**：API 文档展示
- **next-swagger-doc**：Next.js Swagger 文档生成

## 构建系统

### 开发命令
```bash
npm run dev      # 启动开发服务器（端口 3000）
npm run build    # 构建生产版本
npm start        # 启动生产服务器
npm run lint     # 运行 ESLint 代码检查
```

### Docker 命令
```bash
docker compose build    # 构建容器
docker compose up -d    # 后台运行
docker compose logs -f  # 查看日志
docker compose down     # 停止容器
```

## 配置文件

- **next.config.mjs**：Next.js 配置，包含 webpack 自定义和外部模块排除
- **tsconfig.json**：TypeScript 配置，使用 ESNext 模块和 bundler 解析
- **tailwind.config.ts**：Tailwind CSS 配置
- **.eslintrc.json**：ESLint 代码规范配置
- **postcss.config.js**：PostCSS 配置

## 环境变量

必需的环境变量：
- `SUNO_COOKIE`：Suno 账户的 Cookie
- `TWOCAPTCHA_KEY`：2Captcha API 密钥
- `BROWSER`：浏览器类型（chromium 或 firefox）
- `BROWSER_GHOST_CURSOR`：是否使用 ghost-cursor
- `BROWSER_LOCALE`：浏览器语言（推荐 en 或 ru）
- `BROWSER_HEADLESS`：是否无头模式运行

## 部署选项

1. **Vercel**：一键部署，适合快速上线
2. **本地运行**：npm install + npm run dev
3. **Docker**：容器化部署，注意 GPU 加速在 Docker 中会被禁用
