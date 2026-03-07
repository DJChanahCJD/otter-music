import { useState, useEffect, useRef } from "react";
import {
  User,
  RefreshCw,
  Check,
  Loader2,
  ScanLine,
  Cookie,
  Info,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { SettingItem } from "./SettingItem";
import {
  getQrKey,
  checkQrStatus,
  getMyInfo,
  NETEASE_COOKIE_KEY,
} from "@/lib/netease/netease-api";
import { UserProfile } from "@/lib/netease/netease-types";
import toast from "react-hot-toast";
import { QRCodeSVG } from "qrcode.react";

const STATUS_MESSAGES = {
  loading: "正在获取二维码...",
  waiting: "请使用网易云 APP 扫码",
  scanned: "扫描成功，请在手机确认",
  expired: "二维码已过期",
  success: "登录成功，同步中...",
};

type QrStatus = keyof typeof STATUS_MESSAGES;

export function NeteaseLogin() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginMode, setLoginMode] = useState<"qr" | "cookie">("qr");
  const [cookieInput, setCookieInput] = useState("");

  const [qrUrl, setQrUrl] = useState("");
  const [qrStatus, setQrStatus] = useState<QrStatus>("loading");

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef(false);

  const clearTimer = () => {
    isPollingRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  useEffect(() => {
    checkLoginStatus();
    return clearTimer;
  }, []);

  const onLoginSuccess = (cookie: string, profile: UserProfile) => {
    localStorage.setItem(NETEASE_COOKIE_KEY, cookie);
    localStorage.setItem("cookie:netease", cookie);
    setUser(profile);
    setShowDialog(false);
  };

  const checkLoginStatus = async () => {
    const cookie = localStorage.getItem(NETEASE_COOKIE_KEY);
    if (!cookie) return;
    try {
      const res = await getMyInfo(cookie);
      if (res) setUser(res);
    } catch (e) {
      console.error("User info fetch failed:", e);
    }
  };

  const startLogin = async () => {
    setShowDialog(true);
    setLoginMode("qr");
    setLoading(true);
    setQrStatus("loading");

    try {
      const key = await getQrKey();

      setQrUrl(`https://music.163.com/login?codekey=${key}`);
      setQrStatus("waiting");
      clearTimer();
      isPollingRef.current = true;
      pollStatus(key);
    } catch {
      toast.error("获取二维码失败");
      setShowDialog(false);
    } finally {
      setLoading(false);
    }
  };

  const pollStatus = async (key: string) => {
    if (!isPollingRef.current) return;
    try {
      const res = await checkQrStatus(key);
      if (!isPollingRef.current) return;

      const code = res.code;
      const cookie = res.cookie;

      switch (code) {
        case 800:
        case 8821:
          setQrStatus("expired");
          clearTimer();
          if (code === 8821)
            toast.error(res.message || "登录环境异常");
          break;
        case 801:
          setQrStatus("waiting");
          scheduleNextPoll(key);
          break;
        case 802:
          setQrStatus("scanned");
          scheduleNextPoll(key);
          break;
        case 803:
          setQrStatus("success");
          clearTimer();
          if (cookie) {
            const infoRes = await getMyInfo(cookie);
            if (infoRes) {
              onLoginSuccess(cookie, infoRes);
            } else {
              toast.error("获取用户信息失败");
            }
          } else {
            toast.error("未获取到登录凭证");
          }
          break;
        default:
          scheduleNextPoll(key);
      }
    } catch {
      if (isPollingRef.current) scheduleNextPoll(key);
    }
  };

  const scheduleNextPoll = (key: string) => {
    if (!isPollingRef.current) return;
    timerRef.current = setTimeout(
      () => pollStatus(key),
      2000 + Math.random() * 500,
    );
  };

  const handleCookieLogin = async () => {
    if (!cookieInput.trim()) return;
    setLoading(true);
    try {
      const finalCookie = cookieInput.includes("=")
        ? cookieInput.trim()
        : `MUSIC_U=${cookieInput.trim()}`;
      const res = await getMyInfo(finalCookie);

      if (res) {
        onLoginSuccess(finalCookie, res);
        setCookieInput("");
      } else {
        toast.error("Cookie 无效或已过期");
      }
    } catch {
      toast.error("验证失败，请检查 Cookie");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    if (!window.confirm("确定要退出网易云登录吗？")) return;
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
        subtitle={user ? user.nickname : "点击登录以同步歌单"}
        action={
          user ? (
            <Avatar
              className="w-10 h-10 border shadow-sm cursor-pointer hover:opacity-80 transition-opacity"
              onClick={handleLogout}
            >
              <AvatarImage src={user.avatarUrl} />
              <AvatarFallback>{user.nickname?.[0]}</AvatarFallback>
            </Avatar>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={startLogin}
              disabled={loading}
              className="px-4"
            >
              {loading && <Loader2 className="w-3 h-3 mr-2 animate-spin" />}{" "}
              登录
            </Button>
          )
        }
      />

      <Dialog
        open={showDialog}
        onOpenChange={(open) => {
          setShowDialog(open);
          if (!open) {
            clearTimer();
            setCookieInput("");
          }
        }}
      >
        <DialogContent className="sm:max-w-[360px] p-6">
          <DialogHeader className="mb-2">
            <DialogTitle className="text-center text-lg">
              {loginMode === "qr" ? "扫码登录" : "Cookie 登录"}
            </DialogTitle>
            <DialogDescription className="text-center text-xs">
              {loginMode === "qr"
                ? "打开网易云音乐 APP 扫一扫"
                : "输入完整 Cookie 或 MUSIC_U 的值"}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center justify-center space-y-6">
            {loginMode === "qr" ? (
              <>
                <div className="relative flex items-center justify-center w-[180px] h-[180px]">
                  {qrStatus === "loading" && (
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground/50" />
                  )}

                  {(qrStatus === "waiting" ||
                    qrStatus === "scanned" ||
                    qrStatus === "success") &&
                    qrUrl && (
                      <div className="w-full h-full p-2 bg-white rounded-xl shadow-sm border border-black/5">
                        <QRCodeSVG
                          value={qrUrl}
                          size={162}
                          level="M"
                          className="w-full h-full"
                        />
                      </div>
                    )}

                  {qrStatus === "scanned" && (
                    <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex flex-col items-center justify-center rounded-xl transition-all">
                      <Check className="w-10 h-10 text-primary mb-2 drop-shadow-sm" />
                      <span className="font-medium text-sm">扫描成功</span>
                      <span className="text-[11px] text-muted-foreground mt-1">
                        请在手机上确认
                      </span>
                    </div>
                  )}

                  {qrStatus === "expired" && (
                    <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-xl transition-all">
                      <ScanLine className="w-8 h-8 text-muted-foreground mb-3 opacity-50" />
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={startLogin}
                        className="h-8 text-xs rounded-full px-4"
                      >
                        <RefreshCw className="w-3 h-3 mr-1.5" /> 刷新二维码
                      </Button>
                    </div>
                  )}
                </div>

                <div className="text-center space-y-1.5">
                  <p className="text-sm font-medium text-foreground">
                    {STATUS_MESSAGES[qrStatus]}
                  </p>
                  <p className="text-[11px] text-muted-foreground/70">
                    为保障账号安全，我们仅在本地保存登录凭证
                  </p>
                </div>
              </>
            ) : (
              <div className="w-full space-y-3">
                <div className="relative">
                  <Textarea
                    placeholder="粘贴 MUSIC_U 或完整 Cookie 字符串..."
                    value={cookieInput}
                    onChange={(e) => setCookieInput(e.target.value)}
                    className="min-h-[140px] font-mono text-[13px] leading-relaxed resize-none bg-muted/20 border-none focus-visible:ring-1 focus-visible:ring-primary/20 transition-all placeholder:text-muted-foreground/50 p-4 rounded-xl"
                  />
                  <div className="absolute bottom-3 right-3 opacity-20 pointer-events-none">
                    <Cookie className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-muted/30 rounded-lg p-3 space-y-1.5">
                  <p className="text-[11px] font-medium text-muted-foreground flex items-center">
                    <Info className="w-3 h-3 mr-1" /> 如何获取？
                  </p>
                  <ol className="text-[10px] text-muted-foreground/80 leading-relaxed list-decimal list-inside space-y-0.5">
                    <li>
                      以 PC 模式访问官网{" "}
                      <a
                        href="https://music.163.com/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline underline-offset-2"
                      >
                        music.163.com
                      </a>{" "}
                      并登录
                    </li>
                    <li>按 F12 打开开发者工具 → Application</li>
                    <li>
                      在 Cookies 中找到并复制{" "}
                      <code className="bg-background px-1.5 py-0.5 rounded border text-primary font-mono text-[9px]">
                        MUSIC_U
                      </code>{" "}
                      的值
                    </li>
                  </ol>
                </div>

                <Button
                  className="w-full rounded-full shadow-sm"
                  onClick={handleCookieLogin}
                  disabled={loading || !cookieInput.trim()}
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    "验证并登录"
                  )}
                </Button>
              </div>
            )}

            <Button
              variant="link"
              className="text-xs text-muted-foreground/60 hover:text-muted-foreground px-0 h-auto"
              onClick={() => setLoginMode(loginMode === "qr" ? "cookie" : "qr")}
            >
              {loginMode === "qr"
                ? "遇到问题？尝试手动输入 Cookie"
                : "返回扫码登录"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
