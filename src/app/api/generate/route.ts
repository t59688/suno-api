import { NextResponse, NextRequest } from "next/server";
import { DEFAULT_MODEL, sunoApi } from "@/lib/SunoApi";
import { corsHeaders } from "@/lib/utils";
import { DBManager } from "@/lib/pool/db-manager";
import { AccountPool } from "@/lib/pool/account-pool";

export const dynamic = "force-dynamic";

// 最大重试次数
const MAX_RETRIES = 3;

export async function POST(req: NextRequest) {
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      const { prompt, make_instrumental, model, wait_audio } = body;

      // 获取账号池实例
      const dbManager = DBManager.getInstance();
      const accountPool = new AccountPool(dbManager);
      const circuitBreaker = accountPool.getCircuitBreaker();

      const targetModel = model || DEFAULT_MODEL;
      let lastError: any = null;

      // 重试机制: 最多尝试 3 次
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        // 从账号池选择账号 (需要模型筛选)
        const account = accountPool.selectAccount({
          model: targetModel,
          requireModelFilter: true,
        });

        if (!account) {
          // 没有可用账号
          return new NextResponse(
            JSON.stringify({ 
              error: 'NO_AVAILABLE_ACCOUNTS',
              message: '没有可用的账号,请稍后重试或联系管理员添加账号'
            }), 
            {
              status: 503,
              headers: {
                'Content-Type': 'application/json',
                ...corsHeaders
              }
            }
          );
        }

        try {
          // 使用选中的账号调用 API
          const audioInfo = await (await sunoApi(account.cookie)).generate(
            prompt,
            Boolean(make_instrumental),
            targetModel,
            Boolean(wait_audio)
          );

          // 成功,返回结果
          return new NextResponse(JSON.stringify(audioInfo), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        } catch (error: any) {
          lastError = error;
          const errorStatus = error.response?.status || error.status || 500;

          // 检查是否是认证错误,触发熔断
          if (circuitBreaker.shouldBreak(error)) {
            console.log(`账号 ${account.id} 认证失败,触发熔断`);
            circuitBreaker.handleAuthError(account.id, error);

            // 记录重试日志
            dbManager.addLog({
              accountId: account.id,
              operation: 'generate_retry',
              status: 'failed',
              message: `认证失败 (${errorStatus}),尝试切换账号重试 (尝试 ${attempt + 1}/${MAX_RETRIES})`,
            });

            // 继续重试
            continue;
          }

          // 其他错误,不重试,直接返回
          const errorMessage = error.response?.data?.detail || error.message || 'Unknown error';
          console.error('Error generating audio:', errorMessage);
          console.error('[DEBUG] Error stack:', error.stack);

          if (errorStatus === 402) {
            return new NextResponse(JSON.stringify({ error: errorMessage }), {
              status: 402,
              headers: {
                'Content-Type': 'application/json',
                ...corsHeaders
              }
            });
          }

          return new NextResponse(JSON.stringify({ error: 'Internal server error: ' + errorMessage }), {
            status: errorStatus,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }
      }

      // 重试次数用尽
      const errorMessage = lastError?.response?.data?.detail || lastError?.message || 'Unknown error';
      console.error(`所有重试尝试均失败: ${errorMessage}`);

      return new NextResponse(
        JSON.stringify({ 
          error: 'MAX_RETRIES_EXCEEDED',
          message: `请求失败,已尝试 ${MAX_RETRIES} 次: ${errorMessage}`
        }), 
        {
          status: 503,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      );
    } catch (error: any) {
      console.error('Unexpected error in generate API:', error);
      return new NextResponse(JSON.stringify({ error: 'Internal server error: ' + error.message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
  } else {
    return new NextResponse('Method Not Allowed', {
      headers: {
        Allow: 'POST',
        ...corsHeaders
      },
      status: 405
    });
  }
}


export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 200,
    headers: corsHeaders
  });
}