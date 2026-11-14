/**
 * Cloudflare Workers 入口（由 Cloudflare Pages Functions 迁移而来）。
 *
 * 原 functions/[[path]].ts 通过 hono/cloudflare-pages 的 handle(app) 接管所有请求，
 * 未命中路由时用 ctx.next() 回退到 Pages 静态资源。Workers 中由本文件承担同样的职责：
 *  - app.fetch(request, env) 直接运行在 Workers 运行时，c.env 与 Pages 的 ctx.env 等价；
 *  - Hono 默认 404 时通过 ASSETS binding 回退到静态资源（含 SPA 回退）。
 *
 * 入口由 wrangler.jsonc 的 main 指定，Wrangler 会自动用 esbuild 打包，
 * 无需额外的构建步骤；原来的 [[path]].ts 保留，用于兼容 Cloudflare Pages 部署。
 */
import { app } from "./app";
import type { Env } from "./types/hono";

/** 只有 Hono 的“路由未命中 404”才回退，业务主动返回的 JSON 404 必须原样透传。 */
function isUnmatchedRoute(res: Response): boolean {
  return (
    res.status === 404 &&
    !res.headers.get("content-type")?.includes("application/json")
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const res = await app.fetch(request, env);

    if (isUnmatchedRoute(res) && env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return res;
  },
};
