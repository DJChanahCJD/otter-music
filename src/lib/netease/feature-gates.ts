import { isWeb } from "@/lib/platform";

export interface NeteaseFeatureGateContext {
  isWeb: boolean;
  isProd: boolean;
}

export function shouldShowNeteaseEntryPoints({
  isWeb: isWebPlatform,
  isProd,
}: NeteaseFeatureGateContext): boolean {
  return !(isWebPlatform && isProd);  //  Web端由于跨域问题无法直接请求网易云接口，因此隐藏相关组件
}

export const shouldShowNeteaseEntryPointsOnCurrentPlatform =
  shouldShowNeteaseEntryPoints({
    isWeb,
    isProd: import.meta.env.PROD,
  });
