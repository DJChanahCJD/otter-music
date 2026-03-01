import { useState } from "react";
import { SettingItem } from "./SettingItem";
import { UpdateDialog } from "./UpdateDialog";
import { RefreshCw, Milestone } from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { Badge } from "@/components/ui/badge";

export function UpdateCheck() {
  const [showDialog, setShowDialog] = useState(false);
  const { isChecking, latestVersionInfo, hasNewVersion, checkUpdate, currentVersion } = useAppStore();

  const handleCheckWithFeedback = async () => {
    if (isChecking) return;
    
    // 如果已经有新版本信息，直接显示弹窗
    if (hasNewVersion && latestVersionInfo) {
      setShowDialog(true);
      return;
    }

    // 否则进行检查
    await checkUpdate(false);
    
    // 检查完后，如果有新版本，打开弹窗
    const currentStore = useAppStore.getState();
    if (currentStore.hasNewVersion) {
      setShowDialog(true);
    }
  };

  return (
    <>
      <SettingItem
        icon={Milestone}
        title="版本更新"
        onClick={handleCheckWithFeedback}
        action={
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">v{currentVersion}</span>
            
            {hasNewVersion && (
              <Badge variant="destructive" className="gap-1 animate-bounce">
                新版本
              </Badge>
            )}

            {isChecking && (
              <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
        }
        showChevron={!isChecking}
      />
      
      {latestVersionInfo && (
        <UpdateDialog 
          open={showDialog} 
          onOpenChange={setShowDialog} 
          updateInfo={latestVersionInfo} 
        />
      )}
    </>
  );
}
