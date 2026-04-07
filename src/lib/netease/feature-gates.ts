import { isWeb } from "@/lib/platform";

export interface NeteaseFeatureGateContext {
  isWeb: boolean;
  isProd: boolean;
}

export function shouldShowNeteaseEntryPoints({
  isWeb: isWebPlatform,
  isProd,
}: NeteaseFeatureGateContext): boolean {
  return !(isWebPlatform && isProd);
}

export const shouldShowNeteaseEntryPointsOnCurrentPlatform =
  shouldShowNeteaseEntryPoints({
    isWeb,
    isProd: import.meta.env.PROD,
  });
