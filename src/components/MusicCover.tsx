"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Music2, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { forceHttps } from "@otter-music/shared";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { ensurePermission, triggerBlobDownload } from "@/lib/utils/download";
import { blobToBase64 } from "@/lib/utils/base64";
import { useExitLayer } from "@/hooks/useExitLayer";
import toast from "react-hot-toast";
import { IS_NATIVE } from "@/lib/api/config";

interface MusicCoverProps {
  src?: string | null;
  alt?: string;
  className?: string;
  iconClassName?: string;
  fallbackIcon?: React.ReactNode;
  previewable?: boolean;
  /** 受控：外部控制预览浮层开关（配合 onPreviewOpenChange），不传则走内部状态 */
  previewOpen?: boolean;
  onPreviewOpenChange?: (open: boolean) => void;
}

export function MusicCover({
  src,
  alt = "Cover",
  className,
  iconClassName,
  fallbackIcon,
  previewable = false,
  previewOpen,
  onPreviewOpenChange,
}: MusicCoverProps) {
  const [error, setError] = useState(false);
  const [internalPreviewOpen, setInternalPreviewOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { push, pop } = useExitLayer();
  const coverUrl = forceHttps(src);

  // 受控时以外界状态为准，否则使用内部开关
  const isPreviewOpen = previewOpen ?? internalPreviewOpen;

  // 打开预览：外部控制时通知父组件；自管时更新内部状态
  const openPreview = useCallback(() => {
    if (previewOpen === undefined) setInternalPreviewOpen(true);
    onPreviewOpenChange?.(true);
  }, [previewOpen, onPreviewOpenChange]);

  const closePreview = useCallback(() => {
    if (previewOpen === undefined) setInternalPreviewOpen(false);
    onPreviewOpenChange?.(false);
  }, [previewOpen, onPreviewOpenChange]);

  // src 变化时重置错误状态，让新的封面 URL 有机会重新加载
  useEffect(() => {
    setError(false);
  }, [src]);

  useEffect(() => {
    if (!isPreviewOpen) return;
    const id = push({ close: closePreview });
    return () => {
      pop(id);
    };
  }, [isPreviewOpen, push, pop, closePreview]);

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!coverUrl || isSaving) return;
    setIsSaving(true);

    try {
      const filename = `${alt.replace(/[\\/:*?"<>|]/g, "_")}.jpg`;

      if (IS_NATIVE) {
        await ensurePermission();
        const response = await fetch(coverUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        const base64 = await blobToBase64(blob);
        await Filesystem.writeFile({
          path: `Pictures/OtterMusic/${filename}`,
          data: base64,
          directory: Directory.ExternalStorage,
          recursive: true,
        });
        toast.success(`已保存到 Pictures/OtterMusic`);
      } else {
        const response = await fetch(coverUrl);
        const blob = await response.blob();
        triggerBlobDownload(blob, filename);
      }
    } catch {
      toast.error("保存失败，请重试");
    } finally {
      setIsSaving(false);
    }
  };

  if (!src || error) {
    return (
      <div
        className={cn(
          "w-full h-full bg-muted flex items-center justify-center shrink-0",
          className
        )}
      >
        {fallbackIcon || (
          <Music2 className={cn("text-muted-foreground/50", iconClassName)} />
        )}
      </div>
    );
  }

  return (
    <>
      <img
        src={coverUrl}
        alt={alt}
        className={cn(
          "w-full h-full object-cover shrink-0",
          previewable && "cursor-pointer",
          className
        )}
        draggable={false}
        onError={() => setError(true)}
        onClick={() => previewable && openPreview()}
        onContextMenu={(e) => e.preventDefault()}
      />

      {isPreviewOpen &&
        createPortal(
          <div
            data-testid="cover-preview-portal"
            className="fixed inset-0 z-500 flex flex-col items-center justify-center bg-black select-none animate-in fade-in duration-200"
            onClick={closePreview}
          >
            <img
              src={coverUrl}
              alt={alt}
              className="max-w-full max-h-[80vh] object-contain pointer-events-none"
            />

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="absolute bottom-5 flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full text-sm transition-colors border border-white/10 disabled:opacity-50"
            >
              <Download size={16} />
              {isSaving ? "保存中..." : "保存图片"}
            </button>
          </div>,
          document.body
        )}
    </>
  );
}
