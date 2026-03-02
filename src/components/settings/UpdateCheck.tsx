import { useState } from "react";
import { SettingItem } from "./SettingItem";
import { Milestone } from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { Badge } from "@/components/ui/badge";
import { UpdateDialog } from "./update/UpdateDialog";

export function UpdateCheck() {
  const [showDialog, setShowDialog] = useState(false);
  const { currentVersion, latestVersionInfo } = useAppStore();

  const hasUpdate = Boolean(latestVersionInfo);

  return (
    <>
      <SettingItem
        icon={Milestone}
        title="版本更新"
        onClick={() => setShowDialog(true)}
        action={
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {currentVersion}
            </span>

            {hasUpdate && (
              <Badge variant="destructive" className="gap-1 animate-bounce">
                新版本
              </Badge>
            )}
          </div>
        }
        showChevron
      />

      <UpdateDialog open={showDialog} onOpenChange={setShowDialog} />
    </>
  );
}
