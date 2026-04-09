import { cors } from 'hono/cors';

export const corsMiddleware = cors({
  origin: (origin) => origin || '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowHeaders: ['Content-Type', 'Authorization', 'Range'],
  exposeHeaders: ['Content-Length', 'Content-Range', 'Accept-Ranges'],
  maxAge: 86400,
  credentials: true,
});
