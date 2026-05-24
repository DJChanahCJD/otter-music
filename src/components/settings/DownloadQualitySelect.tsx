import { useMusicStore } from "@/store/music-store";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Music } from "lucide-react";
import { SettingItem } from "./SettingItem";

export function DownloadQualitySelect() {
  const { downloadQuality, setDownloadQuality } = useMusicStore();

  return (
    <SettingItem
      icon={Music}
      title="下载音质"
      subtitle="仅影响下载文件，不影响流播音质"
      action={
        <Select value={downloadQuality} onValueChange={setDownloadQuality}>
          <SelectTrigger className="h-7 px-2 bg-transparent border-muted hover:bg-muted/20 w-36">
            <SelectValue placeholder="音质" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="128">标准 (128kbps)</SelectItem>
            <SelectItem value="192">高品 (192kbps)</SelectItem>
            <SelectItem value="320">极高 (320kbps)</SelectItem>
            <SelectItem value="999">无损 (999kbps)</SelectItem>
          </SelectContent>
        </Select>
      }
    />
  );
}
