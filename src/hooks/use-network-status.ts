import { useState, useEffect } from "react";
import { Network } from "@capacitor/network";
import { IS_NATIVE, getApiUrl } from "@/lib/api/config";

function checkReachability(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  const healthUrl = IS_NATIVE ? `${getApiUrl()}/health` : "/health";

  return fetch(healthUrl, { method: "HEAD", signal: controller.signal })
    .then((resp) => resp.ok)
    .catch(() => false)
    .finally(() => clearTimeout(timer));
}

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    let cancelled = false;

    if (!IS_NATIVE) {
      if (navigator.onLine) {
        checkReachability().then((ok) => {
          if (!cancelled) setIsOnline(ok);
        });
      }
      const handleOnline = () => {
        checkReachability().then((ok) => {
          if (!cancelled) setIsOnline(ok);
        });
      };
      const handleOffline = () => setIsOnline(false);
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
      return () => {
        cancelled = true;
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }

    let listener: Awaited<ReturnType<typeof Network.addListener>> | null = null;

    Network.getStatus().then((status) => {
      if (cancelled) return;
      if (status.connected) {
        checkReachability().then((ok) => {
          if (!cancelled) setIsOnline(ok);
        });
      } else {
        setIsOnline(false);
      }
    });

    Network.addListener("networkStatusChange", (status) => {
      if (cancelled) return;
      if (status.connected) {
        checkReachability().then((ok) => {
          if (!cancelled) setIsOnline(ok);
        });
      } else {
        setIsOnline(false);
      }
    }).then((handle) => {
      listener = handle;
    });

    return () => {
      cancelled = true;
      listener?.remove();
    };
  }, []);

  return isOnline;
}
