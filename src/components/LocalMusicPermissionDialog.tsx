import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LocalMusicPlugin } from "@/plugins/local-music";

interface LocalMusicPermissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LocalMusicPermissionDialog({ open, onOpenChange }: LocalMusicPermissionDialogProps) {
  const handleOpenSettings = async () => {
    await LocalMusicPlugin.openManageStorageSettings();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>文件管理授权</DialogTitle>
        </DialogHeader>

        <DialogDescription>
          请在系统设置中开启「授权管理所有文件的权限」后返回。
        </DialogDescription>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleOpenSettings}>
            打开设置
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
