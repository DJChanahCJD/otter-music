import { useState, FormEvent, useEffect } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, Music2, User } from "lucide-react";
import toast from "react-hot-toast";

interface AddByUrlDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (title: string, url: string, artist?: string) => void;
}

export function AddByUrlDialog({ isOpen, onClose, onConfirm }: AddByUrlDialogProps) {
  const [formData, setFormData] = useState({ title: "", url: "", artist: "" });

  // 1. 极简状态管理
  const updateField = (field: keyof typeof formData, value: string) => 
    setFormData(prev => ({ ...prev, [field]: value }));

  // 2. 智能剪贴板辅助 (针对移动端高效优化)
  useEffect(() => {
    if (isOpen && !formData.url) {
      navigator.clipboard.readText().then(text => {
        if (text.startsWith('http')) {
          updateField('url', text);
          toast.success("已自动填充剪贴板链接", { id: "clipboard" });
        }
      }).catch(() => {}); // 忽略权限拒绝
    }
  }, [isOpen]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const { title, url, artist } = formData;
    const cleanUrl = url.trim();

    if (!title.trim()) return toast.error("请输入标题");
    if (!cleanUrl) return toast.error("请输入链接");

    try {
      new URL(cleanUrl);
    } catch {
      return toast.error("链接格式不正确");
    }

    onConfirm(title.trim(), cleanUrl, artist.trim());
    setFormData({ title: "", url: "", artist: "" });
    onClose();
  };

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-h-[92vh] outline-none">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="text-center text-lg font-bold">通过 URL 添加</DrawerTitle>
        </DrawerHeader>
        
        <form onSubmit={handleSubmit} className="px-5 space-y-5">
          <div className="space-y-4">
            <div className="relative group">
              <Music2 className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9 pr-9 h-11 bg-muted/40 border-none rounded-xl focus-visible:ring-1"
                placeholder="歌曲标题"
                value={formData.title}
                onChange={(e) => updateField('title', e.target.value)}
                enterKeyHint="next"
              />
            </div>

            <div className="relative group">
              <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9 pr-9 h-11 bg-muted/40 border-none rounded-xl focus-visible:ring-1"
                placeholder="歌手 (可选，通过逗号分隔)"
                value={formData.artist}
                onChange={(e) => updateField('artist', e.target.value)}
                enterKeyHint="next"
              />
            </div>

            <div className="relative group">
              <Link className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9 pr-9 h-11 bg-muted/40 border-none rounded-xl focus-visible:ring-1 font-mono text-sm"
                type="url"
                placeholder="音频 URL"
                value={formData.url}
                onChange={(e) => updateField('url', e.target.value)}
                enterKeyHint="done"
              />
            </div>
          </div>
          
          <DrawerFooter className="px-0 pt-2 pb-8 flex-row gap-3">
            <Button type="submit" className="flex-2 h-12 rounded-2xl shadow-lg shadow-primary/20">
              添加
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}