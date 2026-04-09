import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { signJWT } from '@utils/auth';

import type { Env } from '../types/hono';
import { fail, ok } from '@utils/response';

export const authRoutes = new Hono<{ Bindings: Env }>();

authRoutes.post(
  '/login',
  zValidator(
    'json',
    z.object({
      password: z.string().min(1, 'Password required'),
    })
  ),
  async (c) => {
    const { password } = c.req.valid('json');
    const env = c.env;

    if (!password || password !== env.PASSWORD) {
      return fail(c, 'Unauthorized', 401);
    }

    const secret = env.PASSWORD || 'secret';
    const token = await signJWT(secret);

    const isSecure = c.req.url.startsWith("https");
    // Set Cookie
    const cookie = [
      `auth=${token}`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      "Max-Age=86400",
      isSecure ? "Secure" : "",
    ]
      .filter(Boolean)
      .join("; ");

    c.header('Set-Cookie', cookie);
    return ok(c, { token }, 'Login successful', 200);
  }
);

authRoutes.post('/logout', (c) => {
    const isSecure = c.req.url.startsWith("https");
    const cookie = [
      "auth=",
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      "Max-Age=0",
      isSecure ? "Secure" : "",
    ]
      .filter(Boolean)
      .join("; ");
  
  c.header('Set-Cookie', cookie);
  return ok(c, null, 'Logout successful', 200);
});

