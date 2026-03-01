import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import "./assets/global.css"; // Ensure styles are imported
import { useEffect } from "react";
import { useAppStore } from "./store";

export default function App() {
  useEffect(() => {
    // 启动时静默检查更新
    useAppStore.getState().checkUpdate(true);
  }, []);

  return <RouterProvider router={router} />;
}
