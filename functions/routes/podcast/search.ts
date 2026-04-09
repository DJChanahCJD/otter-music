import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../../types/hono';
import { searchPodcasts } from '../../utils/podcast/index';

export const searchRoutes = new Hono<{
  Bindings: Env;
}>();

const querySchema = z.object({
  q: z.string().trim().min(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  country: z.string().trim().length(2).optional().default('CN'),
  lang: z.string().trim().optional().default('zh_cn'),
  // 支持多源搜索，以逗号分隔，如 "apple,xyz"
  source: z.string().trim().optional().default('apple'),
});

searchRoutes.get('/', async (c) => {
  const parsed = querySchema.safeParse(c.req.query());

  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: 'Invalid query parameters',
      },
      400
    );
  }

  const { q, limit, country, lang, source } = parsed.data;

  // 解析 source 参数
  const sources = source.split(',').map((s) => s.trim()).filter(Boolean);
  try {
    const data = await searchPodcasts({
      q,
      limit,
      country,
      lang,
      sources,
    });

    return c.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Search route error:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Podcast search failed',
      },
      500
    );
  }
});
