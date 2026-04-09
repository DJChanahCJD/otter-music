// utils/response.ts
import type { Context } from 'hono'
import type { ApiResponse } from '@otter-music/shared'
import { ContentfulStatusCode } from 'hono/utils/http-status'

export function ok<T>(
  c: Context,
  data?: T,
  message?: string,
  status: ContentfulStatusCode = 200
) {
  const res: ApiResponse<T> = {
    success: true,
    data,
    message,
  }

  return c.json(res, status)
}

export function fail(
  c: Context,
  message: string,
  status: ContentfulStatusCode = 500
) {
  const res: ApiResponse<null> = {
    success: false,
    data: null,
    message,
  }

  return c.json(res, status)
}

/**
 * 编码 Content-Disposition header 中的文件名（支持中文等非 ASCII 字符）
 * 使用 RFC 5987 标准：filename*=UTF-8''<percent-encodedfilename>
 */
export function encodeContentDisposition(fileName: string, inline = true): string {
  const disposition = inline ? 'inline' : 'attachment';
  // 使用 RFC 5987 编码：filename*=UTF-8''<percent-encoded>
  const encodedFileName = encodeURIComponent(fileName)
    .replace(/['()]/g, escape) // 额外转义特殊字符
    .replace(/\*/g, '%2A');
  return `${disposition}; filename*=UTF-8''${encodedFileName}`;
}
