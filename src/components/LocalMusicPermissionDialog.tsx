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
          访问本地音乐需要授予"允许管理所有文件"权限。请在系统设置中开启此权限后返回。
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
