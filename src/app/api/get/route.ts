import { NextResponse, NextRequest } from 'next/server';
import { sunoApi } from '@/lib/SunoApi';
import { corsHeaders } from '@/lib/utils';
import { DBManager } from '@/lib/pool/db-manager';
import { AccountPool } from '@/lib/pool/account-pool';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (req.method === 'GET') {
    try {
      const url = new URL(req.url);
      const songIds = url.searchParams.get('ids');
      const page = url.searchParams.get('page');

      // 获取账号池实例
      const dbManager = DBManager.getInstance();
      const accountPool = new AccountPool(dbManager);

      // 从账号池选择账号 (不需要模型筛选)
      const account = accountPool.selectAccount({
        requireModelFilter: false,
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

      let audioInfo = [];
      if (songIds && songIds.length > 0) {
        const idsArray = songIds.split(',');
        audioInfo = await (await sunoApi(account.cookie)).get(idsArray, page);
      } else {
        audioInfo = await (await sunoApi(account.cookie)).get(undefined, page);
      }

      return new NextResponse(JSON.stringify(audioInfo), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    } catch (error) {
      console.error('Error fetching audio:', error);

      return new NextResponse(
        JSON.stringify({ error: 'Internal server error' }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      );
    }
  } else {
    return new NextResponse('Method Not Allowed', {
      headers: {
        Allow: 'GET',
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
