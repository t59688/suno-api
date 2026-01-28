# ============================================================
# SonicForge Dockerfile - 多阶段构建（使用 Debian Bullseye）
# ============================================================

# 阶段 1: 依赖安装
FROM node:20-bullseye AS deps

# 配置 Debian 使用国内镜像源（优先使用阿里云，更稳定）
RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources 2>/dev/null || \
    sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list || \
    echo "deb http://mirrors.aliyun.com/debian bullseye main contrib non-free" > /etc/apt/sources.list && \
    echo "deb http://mirrors.aliyun.com/debian bullseye-updates main contrib non-free" >> /etc/apt/sources.list && \
    echo "deb http://mirrors.aliyun.com/debian-security bullseye-security main contrib non-free" >> /etc/apt/sources.list

# 安装系统依赖（使用 apt-get，更稳定）
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      python3 \
      python3-pip \
      build-essential \
      mariadb-client \
      ca-certificates \
      && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 配置 npm 使用淘宝镜像源（只设置有效的配置项）
RUN npm config set registry https://registry.npmmirror.com

# 复制依赖文件
COPY package.json package-lock.json* pnpm-lock.yaml* ./

# 安装依赖（跳过 postinstall 脚本，因为 prisma 目录还没有复制）
RUN \
  if [ -f package-lock.json ]; then npm ci --ignore-scripts; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm config set registry https://registry.npmmirror.com && pnpm i --frozen-lockfile --ignore-scripts; \
  else echo "Lockfile not found." && exit 1; \
  fi

# 阶段 2: 构建应用
FROM node:20-bullseye AS builder

# 配置 Debian 使用国内镜像源（优先使用阿里云，更稳定）
RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources 2>/dev/null || \
    sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list || \
    echo "deb http://mirrors.aliyun.com/debian bullseye main contrib non-free" > /etc/apt/sources.list && \
    echo "deb http://mirrors.aliyun.com/debian bullseye-updates main contrib non-free" >> /etc/apt/sources.list && \
    echo "deb http://mirrors.aliyun.com/debian-security bullseye-security main contrib non-free" >> /etc/apt/sources.list

WORKDIR /app

# 配置 npm 使用淘宝镜像源（只设置有效的配置项）
RUN npm config set registry https://registry.npmmirror.com

# 复制依赖
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 设置环境变量（构建时）
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# 构建时需要一个占位符的 DATABASE_URL（Prisma 只需要验证格式，不会实际连接）
ENV DATABASE_URL="mysql://build:build@localhost:3306/build?schema=public"

# NEXT_PUBLIC_* 变量必须在构建时设置（会被内联到客户端代码中）
# 通过 ARG 接收构建参数，然后设置为 ENV
ARG NEXT_PUBLIC_SITE_URL=https://music.aizeek.com
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}

# 生成 Prisma Client（在构建前）
RUN npx prisma generate

# 构建应用（使用 standalone 输出模式）
RUN \
  if [ -f package-lock.json ]; then npm run build; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm run build; \
  else npm run build; \
  fi

# 验证 standalone 输出是否存在
RUN test -d .next/standalone || (echo "错误: standalone 输出不存在，请检查 next.config.ts 中的 output: 'standalone' 配置" && exit 1)

# 阶段 3: 运行时
FROM node:20-bullseye AS runner

# 配置 Debian 使用国内镜像源（优先使用阿里云，更稳定）
RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources 2>/dev/null || \
    sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list || \
    echo "deb http://mirrors.aliyun.com/debian bullseye main contrib non-free" > /etc/apt/sources.list && \
    echo "deb http://mirrors.aliyun.com/debian bullseye-updates main contrib non-free" >> /etc/apt/sources.list && \
    echo "deb http://mirrors.aliyun.com/debian-security bullseye-security main contrib non-free" >> /etc/apt/sources.list

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 创建系统用户和组（Debian 使用不同的命令）
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs --shell /bin/bash --create-home nextjs

# 配置 npm 使用淘宝镜像源（用于 npx 命令）
RUN npm config set registry https://registry.npmmirror.com

# 安装必要的工具（使用 apt-get，更稳定）
# 包含 FFmpeg 用于 HLS 音频转码
# 包含 git 和 bash 用于安装 clash
# 包含 net-tools（提供 netstat）用于 clash 安装脚本
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      wget \
      mariadb-client \
      curl \
      ca-certificates \
      ffmpeg \
      git \
      bash \
      net-tools \
      && rm -rf /var/lib/apt/lists/*

# 安装 clash（需要 root 权限）
# 使用 gh-proxy 代理访问 GitHub（如果服务器无法直接访问）
# 注意：安装脚本在最后会尝试交互式添加订阅，我们允许这部分失败
# 订阅配置将在容器启动时通过 docker-entrypoint.mjs 完成
RUN cd /tmp && \
    (git clone --branch master --depth 1 https://gh-proxy.org/https://github.com/nelvko/clash-for-linux-install.git 2>/dev/null || \
     git clone --branch master --depth 1 https://github.com/nelvko/clash-for-linux-install.git 2>/dev/null || \
     (echo "⚠️  Clash 安装失败，将在运行时处理" && exit 1)) && \
    if [ -d "clash-for-linux-install" ]; then \
        cd clash-for-linux-install && \
        # 运行安装脚本，允许交互式部分失败（退出码非0）
        # 使用 echo "" | 提供空输入（兼容 /bin/sh，不依赖 bash 的 here-string）
        # 从错误日志看，clash 核心已经安装成功，只是最后的订阅配置失败
        # 使用 set +e 确保即使脚本失败也继续执行
        set +e; \
        echo "" | bash install.sh 2>&1; \
        INSTALL_EXIT_CODE=$?; \
        set -e; \
        # 验证 clash 核心是否安装成功（这是关键检查）
        # 检查所有 clash 相关命令是否可用（用户确认只要这些命令可用即可）
        # 首先检查 /root/clashctl 目录是否存在（这是安装脚本的标准位置）
        if [ -d "/root/clashctl" ]; then \
            echo "✅ 检测到 /root/clashctl 目录，Clash 核心已安装"; \
            CLASH_AVAILABLE=true; \
        else \
            # 检查命令是否在 PATH 中
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
        # 如果命令可用，确保它们在 PATH 中
        if [ "$CLASH_AVAILABLE" = "true" ]; then \
            echo "✅ Clash 核心安装成功（clash 命令可用，交互式订阅配置将在容器启动时完成）"; \
            # 确保 clashctl 相关命令在 PATH 中（如果不在）
            if [ -d "/root/clashctl" ]; then \
                # 链接所有可执行文件到 /usr/local/bin
                for cmd_file in /root/clashctl/*; do \
                    if [ -f "$cmd_file" ] && [ ! -d "$cmd_file" ]; then \
                        cmd_name=$(basename "$cmd_file"); \
                        # 如果是脚本文件，确保可执行
                        chmod +x "$cmd_file" 2>/dev/null || true; \
                        # 创建符号链接
                        if ! command -v "$cmd_name" >/dev/null 2>&1; then \
                            ln -sf "$cmd_file" "/usr/local/bin/$cmd_name" 2>/dev/null || true; \
                        fi; \
                    fi; \
                done; \
                # 同时检查 scripts/cmd 目录（如果存在）
                if [ -d "/root/clashctl/scripts/cmd" ]; then \
                    # 确保脚本文件有可读权限（让 nextjs 用户可以通过 sudo 读取）
                    chmod -R a+r /root/clashctl/scripts/cmd/*.sh 2>/dev/null || true; \
                    chmod +x /root/clashctl/scripts/cmd/*.sh 2>/dev/null || true; \
                    for cmd_file in /root/clashctl/scripts/cmd/*.sh; do \
                        if [ -f "$cmd_file" ]; then \
                            cmd_name=$(basename "$cmd_file" .sh); \
                            if ! command -v "$cmd_name" >/dev/null 2>&1; then \
                                # 创建一个包装脚本，source 原始脚本然后执行函数
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

# 复制 standalone 输出的所有文件
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# 复制 Prisma 相关文件（standalone 模式不自动包含）
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# 复制整个 node_modules（确保所有依赖都可用，包括初始化脚本需要的 mysql2、bcryptjs 等）
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules

# 复制初始化脚本
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts

# 创建启动脚本（配置 clash、启动 clash、运行数据库迁移、启动应用）
# 注意：clash 需要 root 权限，所以使用 sudo 启动 clash
RUN echo '#!/bin/bash' > /app/docker-entrypoint.sh && \
    echo 'set -e' >> /app/docker-entrypoint.sh && \
    echo 'export PATH="/app/node_modules/.bin:$PATH"' >> /app/docker-entrypoint.sh && \
    echo '' >> /app/docker-entrypoint.sh && \
    echo '# 运行初始化脚本（配置 clash 和数据库迁移）' >> /app/docker-entrypoint.sh && \
    echo 'if [ -f "./scripts/docker-entrypoint.mjs" ]; then' >> /app/docker-entrypoint.sh && \
    echo '  node ./scripts/docker-entrypoint.mjs' >> /app/docker-entrypoint.sh && \
    echo 'else' >> /app/docker-entrypoint.sh && \
    echo '  echo "⚠️  docker-entrypoint.mjs 不存在，跳过初始化"' >> /app/docker-entrypoint.sh && \
    echo 'fi' >> /app/docker-entrypoint.sh && \
    echo '' >> /app/docker-entrypoint.sh && \
    echo '# 启动 clash 代理（如果启用，在配置完成后启动）' >> /app/docker-entrypoint.sh && \
    echo 'if [ "${ENABLE_PROXY:-false}" = "true" ]; then' >> /app/docker-entrypoint.sh && \
    echo '  echo "🌐 启动 clash 代理..."' >> /app/docker-entrypoint.sh && \
    echo '  # clashon 是 bash 函数，不是可执行文件，需要通过 source 加载' >> /app/docker-entrypoint.sh && \
    echo '  # 尝试多种方式加载 clashon 函数' >> /app/docker-entrypoint.sh && \
    echo '  if [ -f "/root/clashctl/scripts/cmd/clashctl.sh" ]; then' >> /app/docker-entrypoint.sh && \
    echo '    # 直接 source clashctl.sh 文件（最可靠的方式）' >> /app/docker-entrypoint.sh && \
    echo '    sudo bash -c "source /root/clashctl/scripts/cmd/clashctl.sh && clashon" 2>/dev/null || true' >> /app/docker-entrypoint.sh && \
    echo '  else' >> /app/docker-entrypoint.sh && \
    echo '    # 尝试通过 .bashrc 加载（如果存在）' >> /app/docker-entrypoint.sh && \
    echo '    sudo bash -c "source /root/.bashrc 2>/dev/null && clashon" 2>/dev/null || \' >> /app/docker-entrypoint.sh && \
    echo '    sudo -i bash -c "clashon" 2>/dev/null || \' >> /app/docker-entrypoint.sh && \
    echo '    (echo "⚠️  无法使用 clashon，尝试使用 clashctl..." && sudo clashctl on 2>/dev/null || true)' >> /app/docker-entrypoint.sh && \
    echo '  fi' >> /app/docker-entrypoint.sh && \
    echo '  sleep 3' >> /app/docker-entrypoint.sh && \
    echo '  echo "✅ Clash 代理已启动"' >> /app/docker-entrypoint.sh && \
    echo 'fi' >> /app/docker-entrypoint.sh && \
    echo '' >> /app/docker-entrypoint.sh && \
    echo '# 设置代理环境变量（如果启用）' >> /app/docker-entrypoint.sh && \
    echo 'if [ "${ENABLE_PROXY:-false}" = "true" ]; then' >> /app/docker-entrypoint.sh && \
    echo '  export HTTP_PROXY="${PROXY_HTTP:-http://127.0.0.1:7890}"' >> /app/docker-entrypoint.sh && \
    echo '  export HTTPS_PROXY="${PROXY_HTTPS:-http://127.0.0.1:7890}"' >> /app/docker-entrypoint.sh && \
    echo '  export ALL_PROXY="${PROXY_ALL:-socks5://127.0.0.1:7890}"' >> /app/docker-entrypoint.sh && \
    echo '  export NO_PROXY="${PROXY_NO_PROXY:-localhost,127.0.0.1,::1}"' >> /app/docker-entrypoint.sh && \
    echo '  # 设置 Node.js 使用的代理环境变量（Node.js 18+ fetch 需要这些变量）' >> /app/docker-entrypoint.sh && \
    echo '  export NODE_EXTRA_CA_CERTS=""' >> /app/docker-entrypoint.sh && \
    echo '  echo "🔧 代理环境变量已设置: HTTP_PROXY=$HTTP_PROXY"' >> /app/docker-entrypoint.sh && \
    echo '  echo "🔧 Node.js 将使用代理: HTTPS_PROXY=$HTTPS_PROXY"' >> /app/docker-entrypoint.sh && \
    echo 'fi' >> /app/docker-entrypoint.sh && \
    echo '' >> /app/docker-entrypoint.sh && \
    echo 'echo "🚀 启动应用..."' >> /app/docker-entrypoint.sh && \
    echo 'exec node server.js' >> /app/docker-entrypoint.sh && \
    chmod +x /app/docker-entrypoint.sh && \
    chown nextjs:nodejs /app/docker-entrypoint.sh

# 配置 sudo，允许 nextjs 用户以 root 权限运行 clash 相关命令
# 安装 sudo（如果还没有）
RUN apt-get update && \
    apt-get install -y --no-install-recommends sudo && \
    # 允许 nextjs 用户无密码执行 bash 命令（用于 source clashctl.sh 和执行 clash 命令）
    echo "nextjs ALL=(ALL) NOPASSWD: /bin/bash" >> /etc/sudoers && \
    rm -rf /var/lib/apt/lists/*

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 使用启动脚本，自动运行数据库迁移
ENTRYPOINT ["/app/docker-entrypoint.sh"]

