import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from "@/components/ui/drawer";
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
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[70vh]">
        <DrawerHeader>
          <DrawerTitle>文件管理授权</DrawerTitle>
        </DrawerHeader>

        <DrawerDescription className="px-4">
          请在系统设置中开启「授权管理所有文件的权限」后返回。
        </DrawerDescription>

        <DrawerFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="h-11">
            取消
          </Button>
          <Button onClick={handleOpenSettings} className="h-11">
            打开设置
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
