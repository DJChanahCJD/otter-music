import { Capacitor } from "@capacitor/core";

export type Platform = "tauri" | "capacitor" | "web";

export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export const isCapacitorNative = Capacitor.isNativePlatform();

export const isWeb = !isTauri && !isCapacitorNative;

export const currentPlatform: Platform = isTauri 
  ? "tauri" 
  : isCapacitorNative 
    ? "capacitor" 
    : "web";

export const getPlatform = (): Platform => currentPlatform;