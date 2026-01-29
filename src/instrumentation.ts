/**
 * Next.js Instrumentation
 * 在服务器启动时执行初始化逻辑
 * 
 * 文档: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // 只在 Node.js 运行时执行(服务器端)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // 动态导入账号池初始化模块
    const { initAccountPoolSystem } = await import('./lib/pool/init');
    
    // 初始化账号池系统
    await initAccountPoolSystem();
  }
}
