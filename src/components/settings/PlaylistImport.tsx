import { FileInput } from "lucide-react";
import { useRef } from "react";
import { useMusicStore } from "@/store/music-store";
import { importPlaylist } from "@/lib/utils/playlist-backup";
import { toastUtils } from "@/lib/utils/toast";
import { SettingItem } from "./SettingItem";

export function PlaylistImport() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { name, tracks } = await importPlaylist(file);
      const playlistId = useMusicStore.getState().createPlaylist(name);
      useMusicStore.getState().setPlaylistTracks(playlistId, tracks);
      toastUtils.success(`成功导入歌单「${name}」\n共 ${tracks.length} 首歌曲`);
    } catch (error: any) {
      console.error("Import failed:", error);
      toastUtils.error(error.message || "导入失败");
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <SettingItem
      icon={FileInput}
      title="导入歌单"
      action={<span className="text-xs">支持 .json 格式</span>}
      onClick={() => fileInputRef.current?.click()}
      showChevron
    >
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".json"
        onChange={handleImport}
      />
    </SettingItem>
  );
}
