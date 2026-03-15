import { useState, FormEvent } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import toast from "react-hot-toast";

interface AddByUrlDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (title: string, url: string) => void;
}

export function AddByUrlDialog({
  isOpen,
  onClose,
  onConfirm,
}: AddByUrlDialogProps) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");

  const clearFields = () => {
    setTitle("");
    setUrl("");
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault(); // 阻止表单默认刷新
    
    const cleanTitle = title.trim();
    const cleanUrl = url.trim();

    if (!cleanTitle) return toast.error("请输入标题");
    if (!cleanUrl) return toast.error("请输入链接");

    try {
      new URL(cleanUrl);
    } catch {
      return toast.error("请输入有效的 HTTP/HTTPS 链接");
    }

    onConfirm(cleanTitle, cleanUrl);
    clearFields();
    onClose();
  };

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader>
          <DrawerTitle>URL 添加</DrawerTitle>
        </DrawerHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 px-4 pb-4">
            <div className="grid gap-2">
              <Label htmlFor="url-title">标题</Label>
              <Input
                id="url-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="请输入歌曲标题"
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="url-link">链接</Label>
              <Input
                id="url-link"
                type="url" // 触发移动端 URL 专属键盘
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="请输入音频链接 (http/https)"
              />
            </div>
          </div>
          
          <DrawerFooter className="pt-0 flex-row gap-3">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 h-11">
              取消
            </Button>
            <Button type="submit" className="flex-1 h-11">
              添加
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}