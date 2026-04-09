import { Hono } from 'hono';
import type { Env } from '../types/hono';
import { rssRoutes } from './podcast/rss';
import { searchRoutes } from './podcast/search';

export const podcastRoutes = new Hono<{
  Bindings: Env;
}>();

podcastRoutes.route('/rss', rssRoutes);
podcastRoutes.route('/search', searchRoutes);
