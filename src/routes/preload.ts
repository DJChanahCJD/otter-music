/**
 * 首屏空闲后预取高频 tab 的懒加载路由 chunk，减少首次切换时的白屏。
 * 与 RouteWrappers 使用相同模块标识符，会命中同一 chunk；
 * 浏览器模块缓存天然去重，重复调用无副作用。
 * @returns 取消函数：仅在空闲回调尚未触发前有效（导入开始后无法中断）
 */
export function preloadRouteChunks(): () => void {
  const preload = () => {
    void import("@/components/FavoritesView");
    void import("@/components/MinePage");
    void import("@/components/QueuePage");
  };

  if ("requestIdleCallback" in window) {
    const id = window.requestIdleCallback(preload, { timeout: 5000 });
    return () => window.cancelIdleCallback(id);
  }
  const timer = setTimeout(preload, 3000);
  return () => clearTimeout(timer);
}
