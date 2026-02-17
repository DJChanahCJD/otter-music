import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, RotateCcw } from "lucide-react";
import { getApiUrls, setApiUrls, DEFAULT_API_URL } from "@/lib/api/config";
import toast from "react-hot-toast";

interface LoadBalanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LoadBalanceDialog({ open, onOpenChange }: LoadBalanceDialogProps) {
  const [urls, setUrls] = useState<string[]>([]);
  const [newUrl, setNewUrl] = useState("");

  useEffect(() => {
    if (open) {
      setUrls(getApiUrls());
    }
  }, [open]);

  const handleAdd = () => {
    if (!newUrl.trim()) return;
    const url = newUrl.trim();
    
    // 简单的 URL 格式检查
    if (!url.startsWith("http")) {
      toast.error("请输入有效的 URL (以 http/https 开头)");
      return;
    }

    if (urls.includes(url)) {
      toast.error("URL 已存在");
      return;
    }
    setUrls([...urls, url]);
    setNewUrl("");
  };

  const handleRemove = (index: number) => {
    const newUrls = [...urls];
    newUrls.splice(index, 1);
    setUrls(newUrls);
  };

  const handleReset = () => {
    setUrls([DEFAULT_API_URL]);
    toast.success("已恢复默认列表 (需保存生效)");
  };

  const handleSave = () => {
    if (urls.length === 0) {
      toast.error("至少需要一个 API URL");
      return;
    }
    setApiUrls(urls);
    toast.success("设置已保存，即将刷新...");
    
    // 延迟刷新以显示提示
    setTimeout(() => {
      window.location.reload();
    }, 1000);
    
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>API 负载均衡设置</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            添加多个 API 地址，系统将在请求时随机选择以分担负载。
          </p>

          <div className="flex gap-2">
            <Input
              placeholder="输入 API URL (例如 https://api.example.com)"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            <Button onClick={handleAdd} size="icon" variant="secondary">
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {urls.map((url, index) => (
              <div key={index} className="flex items-center gap-2 p-2 rounded-md border bg-muted/50 group">
                <span className="flex-1 text-sm truncate font-mono" title={url}>{url}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleRemove(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {urls.length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-8 border-dashed border rounded-md">
                暂无配置，请添加或重置
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={handleReset} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            重置默认
          </Button>
          <Button onClick={handleSave}>保存并刷新</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
