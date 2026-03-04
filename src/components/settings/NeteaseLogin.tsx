import { useState, useEffect, useRef } from "react";
import { User, LogOut, RefreshCw, Check, Loader2, ScanLine } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { SettingItem } from "./SettingItem";
import { getQrKey, checkQrStatus, getMyInfo, NETEASE_COOKIE_KEY } from "@/lib/netease/netease-api";
import { UserProfile } from "@/lib/netease/netease-types";
import toast from "react-hot-toast";

const STATUS_MESSAGES = {
  loading: "正在获取二维码...",
  waiting: "请使用网易云 APP 扫码",
  scanned: "扫描成功，请在手机确认",
  expired: "二维码已过期",
  success: "登录成功！正在获取信息...",
};

type QrStatus = keyof typeof STATUS_MESSAGES;

export function NeteaseLogin() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [qrUrl, setQrUrl] = useState("");
  const [qrStatus, setQrStatus] = useState<QrStatus>("loading");
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    checkLoginStatus();
    return clearTimer;
  }, []);

  const checkLoginStatus = async () => {
    const cookie = localStorage.getItem(NETEASE_COOKIE_KEY);
    if (!cookie) return;

    try {
      const res = await getMyInfo(cookie);
      const userProfile = res?.data?.profile || res?.profile; 
      if (userProfile) setUser(userProfile);
    } catch (e) {
      console.error("Failed to get user info:", e);
    }
  };

  const startLogin = async () => {
    setShowDialog(true);
    setLoading(true);
    setQrStatus("loading");
    
    try {
      const res = await getQrKey();
      const key = res.data?.unikey;
      if (key) {
        setQrUrl(`https://music.163.com/login?codekey=${key}`);
        setQrStatus("waiting");
        
        clearTimer();
        timerRef.current = setInterval(() => pollStatus(key), 2000);
      } else {
        toast.error("获取二维码失败");
        setShowDialog(false);
      }
    } catch (e) {
      console.error("Login init failed:", e);
      toast.error("无法连接到服务器");
      setShowDialog(false);
    } finally {
      setLoading(false);
    }
  };

  const pollStatus = async (key: string) => {
    try {
      const res = await checkQrStatus(key);
      const code = res.data?.code || res.code;
      const cookie = res.cookie || res.data?.cookie;

      if ([800, 8821].includes(code)) {
        setQrStatus("expired");
        clearTimer();
        if (code === 8821) toast.error(res.data?.message || res.message || "登录环境异常，请稍后再试");
      } else if (code === 801) {
        setQrStatus("waiting");
      } else if (code === 802) {
        setQrStatus("scanned");
      } else if (code === 803) {
        setQrStatus("success");
        clearTimer();
        
        if (cookie) {
          localStorage.setItem(NETEASE_COOKIE_KEY, cookie);
          localStorage.setItem("cookie:netease", cookie);
          toast.success("登录成功");
          setShowDialog(false);
          setTimeout(checkLoginStatus, 300);
        } else {
          toast.error("登录成功但未获取到凭证");
        }
      }
    } catch (e) {
      console.error("Poll failed:", e);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(NETEASE_COOKIE_KEY);
    localStorage.removeItem("cookie:netease");
    setUser(null);
    toast.success("已退出登录");
  };

  return (
    <>
      <SettingItem
        icon={User}
        title="网易云账号"
        subtitle={user ? `已登录: ${user.nickname}` : "点击登录以同步歌单"}
        action={
          user ? (
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-destructive hover:text-destructive">
              <LogOut className="w-4 h-4 mr-1" /> 退出
            </Button>
          ) : (
            <Button variant="secondary" size="sm" onClick={startLogin} disabled={loading}>
              {loading && <Loader2 className="w-3 h-3 mr-2 animate-spin" />} 登录
            </Button>
          )
        }
      >
        {user && (
          <div className="mt-4 flex items-center gap-4 p-3 bg-muted/30 rounded-lg">
            <Avatar className="w-12 h-12 border">
              <AvatarImage src={user.avatarUrl} />
              <AvatarFallback>{user.nickname[0]}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{user.nickname}</div>
              <div className="text-xs text-muted-foreground truncate">{user.signature || "暂无签名"}</div>
            </div>
          </div>
        )}
      </SettingItem>

      <Dialog open={showDialog} onOpenChange={(open) => {
        setShowDialog(open);
        if (!open) clearTimer();
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>网易云扫码登录</DialogTitle>
            <DialogDescription>请使用网易云音乐 APP 扫码登录</DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col items-center justify-center py-6 space-y-4">
            {qrStatus === "loading" && (
              <div className="w-[180px] h-[180px] flex items-center justify-center border rounded-lg bg-muted/20">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            )}

            {(qrStatus === "waiting" || qrStatus === "scanned") && qrUrl && (
              <div className="relative group">
                <div className="w-[180px] h-[180px] border rounded-lg overflow-hidden bg-white p-2">
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrUrl)}`}
                    alt="Login QR Code"
                    className="w-full h-full object-contain"
                  />
                </div>
                {qrStatus === "scanned" && (
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white backdrop-blur-[2px] rounded-lg">
                    <Check className="w-10 h-10 mb-2 text-green-400" />
                    <span className="font-medium">扫描成功</span>
                    <span className="text-xs opacity-80 mt-1">请在手机上确认</span>
                  </div>
                )}
              </div>
            )}

            {qrStatus === "expired" && (
              <div className="w-[180px] h-[180px] flex flex-col items-center justify-center border rounded-lg bg-muted/20 gap-3">
                <ScanLine className="w-8 h-8 text-muted-foreground/50" />
                <span className="text-sm text-muted-foreground">二维码已失效</span>
                <Button size="sm" variant="outline" onClick={startLogin}>
                  <RefreshCw className="w-3 h-3 mr-2" /> 刷新
                </Button>
              </div>
            )}

            <div className="text-center space-y-1">
              <p className="text-sm font-medium">{STATUS_MESSAGES[qrStatus]}</p>
              <p className="text-xs text-muted-foreground">为了您的账号安全，我们仅保存登录凭证(Cookie)</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}