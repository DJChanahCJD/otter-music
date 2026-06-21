/// <reference lib="webworker" />
import { precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { NetworkFirst, CacheFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheableResponsePlugin } from "workbox-cacheable-response";
import { clientsClaim } from "workbox-core";
import { AUDIO_STREAM_CACHE_NAME } from "@/lib/sw-cache";

declare let self: ServiceWorkerGlobalScope;

// Auto-update: 立即激活新版本 Service Worker
self.skipWaiting();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);

registerRoute(
  ({ request }) => request.mode === "navigate",
  new NetworkFirst({
    cacheName: "pages-cache",
    networkTimeoutSeconds: 3,
    plugins: [new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 5 * 60 })],
  })
);

registerRoute(
  ({ request }) => {
    const isAudioDestination = request.destination === "audio";
    const hasAudioExt = /\.(mp3|m4a|ogg|wav|flac|aac|mpe?g)(\?|$)/i.test(
      request.url
    );

    if (isAudioDestination || hasAudioExt) return true;

    const secFetchDest = request.headers.get("Sec-Fetch-Dest");
    if (secFetchDest === "empty") return false;
    if (!secFetchDest && request.destination === "") return false;

    return false;
  },
  new CacheFirst({
    cacheName: AUDIO_STREAM_CACHE_NAME,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 300,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200, 206],
      }),
      {
        cacheWillUpdate: async ({ response }) => {
          if (
            response.status === 0 ||
            response.status === 200 ||
            response.status === 206
          ) {
            return response;
          }
          return null;
        },
      },
    ],
    // ! 严禁使用 ignoreSearch， 避免B站音源缓存失效
  })
);
