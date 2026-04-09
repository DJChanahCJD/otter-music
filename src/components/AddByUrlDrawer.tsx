import { useState, FormEvent, useEffect } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, Music2, User } from "lucide-react";
import toast from "react-hot-toast";

interface AddByUrlDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (title: string, url: string, artist?: string) => void;
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function extractTitleFromUrl(url: string) {
  try {
    const { pathname } = new URL(url);
    const name = pathname.split("/").filter(Boolean).pop() || "";
    return safeDecode(name).replace(/\.[^/.]+$/, "").trim();
  } catch {
    return "";
  }
}

function parseInput(text: string) {
  const raw = text.trim();
  const urlMatch = raw.match(/https?:\/\/[^\s]+/i);
  if (!urlMatch) return { url: "", title: "" };

  const url = urlMatch[0];
  const title = raw
    .replace(url, "")
    .replace(/^[【[](.*?)[】\]]\s*/, "")
    .trim();

  return {
    url,
    title: title || extractTitleFromUrl(url),
  };
}

async function readClipboardText() {
  return navigator.clipboard?.readText?.() || "";
}

export function AddByUrlDrawer({ isOpen, onClose, onConfirm }: AddByUrlDrawerProps) {
  const [formData, setFormData] = useState({ title: "", url: "", artist: "" });

  const updateField = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };

      if (field === "url") {
        const parsed = parseInput(value);
        if (parsed.url) {
          next.url = parsed.url;
          if (!prev.title.trim()) next.title = parsed.title;
        }
      }

      return next;
    });
  };

  useEffect(() => {
    if (!isOpen || formData.url) return;

    readClipboardText()
      .then((text) => {
        const parsed = parseInput(text);
        if (!parsed.url) return;

        setFormData((prev) => ({
          ...prev,
          url: parsed.url,
          title: prev.title || parsed.title,
        }));

        toast.success(parsed.title ? `识别到：${parsed.title}` : "已自动填充链接", {
          id: "clipboard",
        });
      })
      .catch(() => {});
  }, [isOpen, formData.url]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const parsed = parseInput(formData.url);
    const url = (parsed.url || formData.url).trim();
    const title = formData.title.trim() || parsed.title;
    const artist = formData.artist.trim();

    if (!url) return toast.error("请输入链接");

    try {
      new URL(url);
    } catch {
      return toast.error("链接格式不正确");
    }

    if (!title) return toast.error("请输入标题");

    onConfirm(title, url, artist);
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
            <div className="relative">
              <Music2 className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9 h-11 bg-muted/40 border-none rounded-xl focus-visible:ring-1"
                placeholder="歌曲标题"
                value={formData.title}
                onChange={(e) => updateField("title", e.target.value)}
              />
            </div>

            <div className="relative">
              <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9 h-11 bg-muted/40 border-none rounded-xl focus-visible:ring-1"
                placeholder="歌手 (可选)"
                value={formData.artist}
                onChange={(e) => updateField("artist", e.target.value)}
              />
            </div>

            <div className="relative">
              <Link className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9 h-11 bg-muted/40 border-none rounded-xl focus-visible:ring-1 font-mono text-sm"
                type="text"
                placeholder="音频 URL 或 标题 + URL"
                value={formData.url}
                onChange={(e) => updateField("url", e.target.value)}
              />
            </div>
          </div>

          <DrawerFooter className="px-0 pt-2 pb-8">
            <Button type="submit" className="h-12 rounded-2xl shadow-lg shadow-primary/20">
              添加
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}