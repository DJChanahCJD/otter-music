import { useState, useEffect } from "react";
import { Network } from "@capacitor/network";
import { Capacitor } from "@capacitor/core";

export function useNetwork() {
  const [isOnline, setIsOnline] = useState(true);
  const [networkType, setNetworkType] = useState<string>("wifi");

  useEffect(() => {
    let mounted = true;

    const initNetwork = async () => {
      try {
        const status = await Network.getStatus();
        if (mounted) {
          setIsOnline(status.connected);
          setNetworkType(status.connectionType);
        }
      } catch (error) {
        console.error("Failed to get network status:", error);
        if (mounted) {
          setIsOnline(navigator.onLine);
        }
      }
    };

    initNetwork();

    const networkListener = Network.addListener("networkStatusChange", (status) => {
      if (mounted) {
        setIsOnline(status.connected);
        setNetworkType(status.connectionType);
      }
    });

    const handleOnline = () => {
      if (mounted) {
        setIsOnline(true);
      }
    };

    const handleOffline = () => {
      if (mounted) {
        setIsOnline(false);
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      mounted = false;
      networkListener.then((listener) => listener.remove());
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return {
    isOnline,
    networkType,
    isNative: Capacitor.isNativePlatform(),
  };
}
