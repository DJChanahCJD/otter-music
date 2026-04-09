import { Hono, type Context } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { proxyGet } from '@utils/proxy';
import type { Env } from '../types/hono';
import { fail } from '@utils/response';

export const proxyRoutes = new Hono<{ Bindings: Env }>();

const PROXY_RECURSION_HEADER = 'X-Otter-Proxy-Request';

const proxySchema = z.object({
  url: z.string().url(),
  headers: z.string().optional(),
  filename: z.string().optional(),
});

type ProxyQuery = z.infer<typeof proxySchema>;

// --- 辅助函数 ---

// 1. 错误处理
const handleError = (c: Context, e: any) => {
  console.error('Proxy error:', e);
  const status = e.message?.includes('Recursive') ? 400 : (e.status || 500);
  return fail(c, `Proxy error: ${e.message || 'Unknown error'}`, status);
};

// 2. 统一处理响应头
const applyCommonHeaders = (c: Context, headers: Headers, filename?: string) => {
  if (filename) {
    const encoded = encodeURIComponent(filename);
    headers.set('Content-Disposition', `attachment; filename="${filename.replace(/"/g, '')}"; filename*=UTF-8''${encoded}`);
  }
  
  const origin = c.req.header('origin');
  headers.set('Access-Control-Allow-Origin', origin && origin !== 'null' ? origin : '*');
  headers.set('Access-Control-Allow-Credentials', 'true');
  headers.set('Vary', 'Origin');
  headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Range, If-Range, Content-Type, Authorization');
  headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
  
  return headers;
};

// 3. 解析与校验参数
const parseProxyParams = (c: Context, query: ProxyQuery) => {
  const { url: targetUrl, headers: headersParam, filename } = query;
  const targetHost = new URL(targetUrl).host;

  // 严苛的递归拦截
  if (c.req.header(PROXY_RECURSION_HEADER) || c.req.header('host') === targetHost) {
    throw new Error('Recursive proxy request detected');
  }

  const customHeaders: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    [PROXY_RECURSION_HEADER]: '1', // 标记代理请求
  };

  // 过滤敏感 Header 注入
  if (headersParam) {
    try {
      const parsed = JSON.parse(headersParam);
      const forbiddenKeys = ['host', 'referer', PROXY_RECURSION_HEADER.toLowerCase()];
      for (const [k, v] of Object.entries(parsed)) {
        if (!forbiddenKeys.includes(k.toLowerCase())) {
          customHeaders[k.toLowerCase()] = String(v);
        }
      }
    } catch {}
  }

  const range = c.req.header('range');
  if (range) customHeaders['range'] = range;
  const ifRange = c.req.header('if-range');
  if (ifRange) customHeaders['if-range'] = ifRange;

  return { targetUrl, customHeaders, filename };
};

// --- 路由处理 ---

const validator = zValidator('query', proxySchema);

proxyRoutes.get('/', validator, async (c) => {
  try {
    const { targetUrl, customHeaders, filename } = parseProxyParams(c, c.req.valid('query'));
    const response = await proxyGet(targetUrl, customHeaders);

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: applyCommonHeaders(c, new Headers(response.headers), filename),
    });
  } catch (e: any) {
    return handleError(c, e);
  }
});
