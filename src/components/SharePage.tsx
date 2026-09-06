import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CircleAlert, Loader2, Music } from "lucide-react";
import { MusicProviderFactory } from "@/lib/music-provider/factory";
import { logger } from "@/lib/logger";
import { checkUpdate, type UpdateInfo } from "@/lib/api/update";
import { DEEP_LINK_SCHEME } from "@/lib/share-service";
import type { MusicSource, MusicTrack } from "@/types/music";

/** 快速构造 Track 对象 */
const buildRefetchTrack = (source: string, id: string): MusicTrack => ({
  id,
  name: "",
  artist: [],
  album: "",
  pic_id: "",
  url_id: id,
  lyric_id: "",
  source: source as MusicSource,
});

/** 重新解析音频 URL */
const refetchAudioUrl = async (source: string, id: string) => {
  try {
    const provider = MusicProviderFactory.getProvider(source as MusicSource);
    return await provider.getUrl(buildRefetchTrack(source, id));
  } catch (e) {
    logger.error("SharePage", "重新解析音频地址失败:", e);
    return null;
  }
};

/** 设置页面标题与基础 OG Metadata（无 SSR，仅运行时写入） */
function useShareMeta(title: string, artist: string, cover: string | null) {
  useEffect(() => {
    document.title = `${title}${artist ? ` - ${artist}` : ""} | Otter Music`;

    const setMeta = (property: string, content: string) => {
      let el = document.querySelector<HTMLMetaElement>(
        `meta[property="${property}"]`
      );
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute("property", property);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };

    setMeta("og:title", title);
    setMeta(
      "og:description",
      artist ? `${artist} 的歌曲 - Otter Music` : "Otter Music 分享的歌曲"
    );
    if (cover) setMeta("og:image", cover);
    setMeta("og:url", window.location.href);
  }, [title, artist, cover]);
}

export function SharePage() {
  const [searchParams] = useSearchParams();

  // URL Query 携带的歌曲信息
  const media = {
    title: searchParams.get("title") ?? "未知歌曲",
    artist: searchParams.get("artist") ?? "",
    cover: searchParams.get("cover") || null,
    source: searchParams.get("source") ?? "",
    id: searchParams.get("id") ?? "",
    initialUrl: searchParams.get("url") ?? "",
  };

  const [audioUrl, setAudioUrl] = useState(media.initialUrl);
  // 无初始 url 时需先重解析：参数齐备进入 loading，缺失直接报错
  const [status, setStatus] = useState<"idle" | "loading" | "error">(() => {
    if (media.initialUrl) return "idle";
    return media.source && media.id ? "loading" : "error";
  });
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

  const retriedRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useShareMeta(media.title, media.artist, media.cover);

  // 深链：携带同样参数跳转到 App（已安装用户直接插入播放）
  const deepLink = useMemo(() => {
    const params = new URLSearchParams();
    ["source", "id", "url", "title", "artist", "cover"].forEach((key) => {
      const val = searchParams.get(key);
      if (val) params.set(key, val);
    });
    return `${DEEP_LINK_SCHEME}share?${params.toString()}`;
  }, [searchParams]);

  /** 将重解析结果应用到状态 */
  const applyResolvedUrl = useCallback((url: string | null) => {
    if (url) {
      setAudioUrl(url);
      setStatus("idle");
    } else {
      setStatus("error");
    }
  }, []);

  // 无初始 url：挂载后立即重解析一次
  useEffect(() => {
    if (media.initialUrl || !media.source || !media.id) return;
    retriedRef.current = true;
    refetchAudioUrl(media.source, media.id).then(applyResolvedUrl);
  }, [media.initialUrl, media.source, media.id, applyResolvedUrl]);

  // 静默获取 APP 版本信息，用于展示下载入口（失败时隐藏）
  useEffect(() => {
    checkUpdate()
      .then(setUpdateInfo)
      .catch((e) => logger.warn("SharePage", "获取版本信息失败:", e));
  }, []);

  /** 音频加载失败：重新解析一次，仍失败则保持错误态 */
  const handleAudioError = async () => {
    if (retriedRef.current) {
      setStatus("error");
      return;
    }
    retriedRef.current = true;
    setStatus("loading");
    applyResolvedUrl(await refetchAudioUrl(media.source, media.id));
    requestAnimationFrame(() => {
      audioRef.current?.load();
      // 自动播放被浏览器策略拦截时静默忽略，等待用户手动点击
      audioRef.current?.play().catch(() => {});
    });
  };

  return (
    <div className="min-h-dvh bg-background text-foreground flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm flex flex-col items-center gap-6">
        {/* 封面 */}
        {media.cover ? (
          <img
            src={media.cover}
            alt={media.title}
            className="w-48 h-48 rounded-2xl object-cover ring-1 ring-border shadow-lg"
          />
        ) : (
          <div className="w-48 h-48 rounded-2xl bg-muted flex items-center justify-center">
            <Music className="h-16 w-16 text-muted-foreground" />
          </div>
        )}

        {/* 歌曲信息 */}
        <div className="text-center min-w-0">
          <h1 className="text-lg font-semibold truncate">{media.title}</h1>
          {media.artist && (
            <p className="text-sm text-muted-foreground truncate">
              {media.artist}
            </p>
          )}
        </div>

        {/* 播放状态展示 */}
        {status === "loading" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            正在获取音频...
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center gap-2 text-center">
            <CircleAlert className="h-6 w-6 text-destructive" />
            <p className="text-sm text-muted-foreground">
              音频链接已失效，暂时无法播放
            </p>
          </div>
        )}

        {status === "idle" && audioUrl && (
          <audio
            ref={audioRef}
            src={audioUrl}
            controls
            autoPlay
            className="w-full"
            onError={handleAudioError}
          />
        )}

        {/* 操作入口 */}
        <a
          href={deepLink}
          className="w-full text-center text-sm font-medium bg-primary text-primary-foreground rounded-full py-2.5 hover:opacity-90 transition-opacity"
        >
          在 App 中播放
        </a>

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <a href="/" className="underline-offset-4 hover:underline">
            返回首页
          </a>
          {updateInfo && (
            <a
              href={updateInfo.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline-offset-4 hover:underline"
            >
              下载 App
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
