
# ==========================================
# 中国大陆网络加速配置
# ==========================================
# APT 镜像: 阿里云 mirrors.aliyun.com
# NPM 镜像: 淘宝 npmmirror registry.npmmirror.com
# Playwright: 使用官方源（国内镜像不完整）
# ==========================================

# ==================== 构建阶段 ====================
FROM node:20-bullseye AS builder
WORKDIR /src

# 配置 APT 使用阿里云镜像源
RUN sed -i 's|deb.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list && \
    sed -i 's|security.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list

# 配置 NPM/PNPM 使用淘宝镜像源
RUN corepack enable pnpm && pnpm config set registry https://registry.npmmirror.com/

# 构建阶段跳过 Playwright 浏览器下载
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

COPY package*.json ./
# 使用 pnpm 安装依赖，并输出更详细日志
RUN corepack enable pnpm && pnpm install --loglevel=debug
COPY . .
# 使用 pnpm 构建
RUN corepack enable pnpm && pnpm run build

# ==================== 运行阶段 ====================
FROM node:20-bullseye
WORKDIR /app

# 配置 APT 使用阿里云镜像源
RUN sed -i 's|deb.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list && \
    sed -i 's|security.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list

# 安装系统依赖（使用阿里云镜像加速）
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y \
    libnss3 \
    libdbus-1-3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libxkbcommon0 \
    libasound2 \
    libcups2 \
    xvfb \
    wget \
    curl \
    ca-certificates \
    git \
    bash \
    net-tools \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# 安装 Clash（参考 other/Dockerfile，尽量保证命令可用）
RUN cd /tmp && \
    (git clone --branch master --depth 1 https://gh-proxy.org/https://github.com/nelvko/clash-for-linux-install.git 2>/dev/null || \
     git clone --branch master --depth 1 https://github.com/nelvko/clash-for-linux-install.git 2>/dev/null || \
     (echo "⚠️  Clash 安装脚本下载失败，将在运行时处理" && exit 1)) && \
    if [ -d "clash-for-linux-install" ]; then \
        cd clash-for-linux-install && \
        set +e; \
        echo "" | bash install.sh 2>&1; \
        INSTALL_EXIT_CODE=$?; \
        set -e; \
        if [ -d "/root/clashctl" ]; then \
            echo "✅ 检测到 /root/clashctl 目录，Clash 核心已安装"; \
            CLASH_AVAILABLE=true; \
        else \
            CLASH_COMMANDS="clashctl clashlog clashoff clashproxy clashsecret clashsub clashui clashhelp clashmixin clashon clashrestart clashstatus clashtun clashupgrade"; \
            CLASH_AVAILABLE=false; \
            for cmd in $CLASH_COMMANDS; do \
                if command -v "$cmd" >/dev/null 2>&1 || \
                   [ -f "/usr/local/bin/$cmd" ]; then \
                    CLASH_AVAILABLE=true; \
                    break; \
                fi; \
            done; \
        fi; \
        if [ "$CLASH_AVAILABLE" = "true" ]; then \
            echo "✅ Clash 核心安装成功（clash 命令可用，交互式订阅配置将在容器启动时完成）"; \
            if [ -d "/root/clashctl" ]; then \
                for cmd_file in /root/clashctl/*; do \
                    if [ -f "$cmd_file" ] && [ ! -d "$cmd_file" ]; then \
                        cmd_name=$(basename "$cmd_file"); \
                        chmod +x "$cmd_file" 2>/dev/null || true; \
                        if ! command -v "$cmd_name" >/dev/null 2>&1; then \
                            ln -sf "$cmd_file" "/usr/local/bin/$cmd_name" 2>/dev/null || true; \
                        fi; \
                    fi; \
                done; \
                if [ -d "/root/clashctl/scripts/cmd" ]; then \
                    chmod -R a+r /root/clashctl/scripts/cmd/*.sh 2>/dev/null || true; \
                    chmod +x /root/clashctl/scripts/cmd/*.sh 2>/dev/null || true; \
                    for cmd_file in /root/clashctl/scripts/cmd/*.sh; do \
                        if [ -f "$cmd_file" ]; then \
                            cmd_name=$(basename "$cmd_file" .sh); \
                            if ! command -v "$cmd_name" >/dev/null 2>&1; then \
                                echo "#!/bin/bash" > "/usr/local/bin/$cmd_name" && \
                                echo "source $cmd_file" >> "/usr/local/bin/$cmd_name" && \
                                echo "\$$cmd_name \"\$@\"" >> "/usr/local/bin/$cmd_name" && \
                                chmod +x "/usr/local/bin/$cmd_name" 2>/dev/null || true; \
                            fi; \
                        fi; \
                    done; \
                fi; \
            fi; \
        else \
            echo "❌ Clash 核心安装失败（clash 命令不可用）"; \
            echo "调试信息：查找 clash 相关文件..."; \
            find /root -name "clash*" 2>/dev/null | head -10 || true; \
            find /usr/local -name "clash*" 2>/dev/null | head -10 || true; \
            exit 1; \
        fi; \
        cd / && \
        rm -rf /tmp/clash-for-linux-install; \
    else \
        echo "⚠️  Clash 安装脚本下载失败，请确保服务器可以访问 GitHub 或配置代理"; \
        exit 1; \
    fi

# 配置 NPM/PNPM 使用淘宝镜像源
RUN corepack enable pnpm && pnpm config set registry https://registry.npmmirror.com/

COPY package*.json ./

ARG SUNO_COOKIE
RUN if [ -z "$SUNO_COOKIE" ]; then echo "Warning: SUNO_COOKIE is not set. You will have to set the cookies in the Cookie header of your requests."; fi
ENV SUNO_COOKIE=${SUNO_COOKIE}

# Disable GPU acceleration, as with it suno-api won't work in a Docker environment
ENV BROWSER_DISABLE_GPU=true

# npm install 时跳过 Playwright 浏览器下载（避免国内镜像不完整问题）
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# 使用 pnpm 安装运行时依赖（仅生产环境），并输出更详细日志
RUN corepack enable pnpm && pnpm install --prod --loglevel=debug

# 单独安装 Playwright 浏览器
# 注意：国内镜像 npmmirror 缺少部分文件，使用官方源下载
# 如果网络环境允许，可以设置代理加速：
# ENV HTTPS_PROXY=http://your-proxy:port

RUN pnpm install
ENV PLAYWRIGHT_DOWNLOAD_HOST=https://npmmirror.com/mirrors/playwright
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=0
RUN npx playwright install chromium
# RUN npx playwright install firefox

COPY --from=builder /src/.next ./.next
COPY --from=builder /src/public ./public

# 配置 sudo，允许无密码执行 bash 命令（用于 Clash 配置）
RUN apt-get update && \
    apt-get install -y --no-install-recommends sudo && \
    echo "root ALL=(ALL) NOPASSWD: /bin/bash" >> /etc/sudoers && \
    rm -rf /var/lib/apt/lists/*

EXPOSE 3000

# 复制启动脚本（Node 层）并创建 shell 入口脚本，统一配置代理和启动应用
COPY docker-entrypoint.mjs ./docker-entrypoint.mjs

RUN echo '#!/bin/bash' > /app/docker-entrypoint.sh && \
    echo 'set -e' >> /app/docker-entrypoint.sh && \
    echo '' >> /app/docker-entrypoint.sh && \
    echo '# 如果启用代理，则先配置 Clash 订阅' >> /app/docker-entrypoint.sh && \
    echo 'if [ "${ENABLE_PROXY:-false}" = "true" ] && [ -n "${CLASH_SUBSCRIBE_URL:-}" ]; then' >> /app/docker-entrypoint.sh && \
    echo '  echo "🌐 配置 Clash 订阅..."' >> /app/docker-entrypoint.sh && \
    echo '  node /app/docker-entrypoint.mjs || echo "⚠️ Clash 配置失败，继续启动应用"' >> /app/docker-entrypoint.sh && \
    echo 'fi' >> /app/docker-entrypoint.sh && \
    echo '' >> /app/docker-entrypoint.sh && \
    echo '# 如果启用代理，则设置代理环境变量' >> /app/docker-entrypoint.sh && \
    echo 'if [ "${ENABLE_PROXY:-false}" = "true" ]; then' >> /app/docker-entrypoint.sh && \
    echo '  export HTTP_PROXY="${PROXY_HTTP:-http://127.0.0.1:7890}"' >> /app/docker-entrypoint.sh && \
    echo '  export HTTPS_PROXY="${PROXY_HTTPS:-http://127.0.0.1:7890}"' >> /app/docker-entrypoint.sh && \
    echo '  export ALL_PROXY="${PROXY_ALL:-socks5://127.0.0.1:7890}"' >> /app/docker-entrypoint.sh && \
    echo '  export NO_PROXY="${PROXY_NO_PROXY:-localhost,127.0.0.1,::1}"' >> /app/docker-entrypoint.sh && \
    echo '  echo "🔧 代理环境变量已设置: HTTP_PROXY=$HTTP_PROXY"' >> /app/docker-entrypoint.sh && \
    echo 'fi' >> /app/docker-entrypoint.sh && \
    echo '' >> /app/docker-entrypoint.sh && \
    echo 'echo "🚀 启动 suno-api 应用..."' >> /app/docker-entrypoint.sh && \
    echo 'exec pnpm run start' >> /app/docker-entrypoint.sh && \
    chmod +x /app/docker-entrypoint.sh

ENTRYPOINT ["/app/docker-entrypoint.sh"]
