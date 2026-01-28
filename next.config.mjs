/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    config.module.rules.push({
      test: /\.(ttf|html)$/i,
      type: 'asset/resource'
    });

    // 在服务端构建时，排除 Node.js 原生模块，避免 webpack 打包导致 __dirname 被替换成模块 ID
    if (isServer) {
      config.externals = config.externals || [];
      
      // 将 externals 数组转换为函数形式，以便添加自定义逻辑
      const originalExternals = config.externals;
      config.externals = [
        ...Array.isArray(originalExternals) ? originalExternals : [originalExternals],
        // 排除 Playwright 和相关浏览器自动化库
        'rebrowser-playwright-core',
        'playwright',
        'playwright-core',
        // 排除 2Captcha solver
        '@2captcha/captcha-solver',
        // 排除 ghost-cursor（依赖 Playwright）
        'ghost-cursor-playwright',
        // 排除其他可能有问题的原生模块
        'pino-pretty',
      ];
    }

    return config;
  },
  experimental: {
    serverMinification: false, // the server minification unfortunately breaks the selector class names
  },
};  

export default nextConfig;
