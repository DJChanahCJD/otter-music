import { useState } from "react";
import { SettingItem } from "./SettingItem";
import { UpdateDialog } from "./UpdateDialog";
import { Milestone } from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { Badge } from "@/components/ui/badge";

export function UpdateCheck() {
  const [showDialog, setShowDialog] = useState(false);
  const { currentVersion, hasNewVersion } = useAppStore();

  return (
    <>
      <SettingItem
        icon={Milestone}
        title="版本更新"
        onClick={() => setShowDialog(true)}
        action={
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{currentVersion}</span>
            
            {hasNewVersion && (
              <Badge variant="destructive" className="gap-1 animate-bounce">
                新版本
              </Badge>
            )}
          </div>
        }
        showChevron
      />
      
      <UpdateDialog 
        open={showDialog} 
        onOpenChange={setShowDialog} 
      />
    </>
  );
}
