import { app } from './app'
import { handle } from 'hono/cloudflare-pages'

const handler = handle(app)

export const onRequest = async (ctx: any) => {
  const res = await handler(ctx)

  // 只有 Hono 默认的“路由未命中 404”才回退给 Pages（避免Hono接管所有路径导致网站 404）
  // 该解决方式 Hono 不应该返回 html
  if (
    res.status === 404 &&
    !res.headers.get('content-type')?.includes('application/json')
  ) {
    return ctx.next()
  }

  return res
}
