import { Capacitor } from "@capacitor/core";
import { useMusicStore } from "@/store/music-store";
import { SettingItem } from "./SettingItem";
import { validateDownloadPath } from "@/lib/storage-manager";
import { FolderOpen, RotateCcw } from "lucide-react";
import { useState, useCallback } from "react";

export function DownloadDirectorySelect() {
  if (!Capacitor.isNativePlatform()) return null;

  return <DownloadDirectorySelectInner />;
}

function DownloadDirectorySelectInner() {
  const { downloadDirectory, setDownloadDirectory } = useMusicStore();
  const [inputValue, setInputValue] = useState(downloadDirectory);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = useCallback(() => {
    const err = validateDownloadPath(inputValue);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setDownloadDirectory(inputValue.trim());
  }, [inputValue, setDownloadDirectory]);

  const handleReset = useCallback(() => {
    setInputValue("");
    setDownloadDirectory("");
    setError(null);
  }, [setDownloadDirectory]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") handleConfirm();
    },
    [handleConfirm]
  );

  return (
    <SettingItem
      icon={FolderOpen}
      title="下载目录"
      subtitle={error || (downloadDirectory || "默认目录 (Download/OtterMusic)")}
      action={
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setError(null);
            }}
            onBlur={handleConfirm}
            onKeyDown={handleKeyDown}
            placeholder="默认目录"
            className="h-7 px-2 w-28 text-sm bg-transparent border border-muted rounded-md focus:outline-none focus:border-primary"
          />
          {downloadDirectory && (
            <button
              onClick={handleReset}
              className="p-1 text-muted-foreground hover:text-foreground"
              title="重置为默认"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      }
      className={error ? "border-red-500/50" : undefined}
    />
  );
}
