import { useState, useEffect, useRef, useCallback } from "react";
import { User, RefreshCw, Check, Loader2, ScanLine, Info } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
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
import type { UserProfile } from "@/lib/netease/netease-types";
import toast from "react-hot-toast";
import { QRCodeSVG } from "qrcode.react";

const STATUS_MESSAGES = {
  loading: "正在获取二维码...",
  waiting: "请使用网易云 APP 扫码",
  scanned: "扫描成功，请在手机确认",
  expired: "二维码已过期",
  success: "登录成功，同步中...",
} as const;

type QrStatus = keyof typeof STATUS_MESSAGES;
type LoginMode = "qr" | "cookie";

export function NeteaseLogin() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginMode, setLoginMode] = useState<LoginMode>("qr");
  const [cookieInput, setCookieInput] = useState("");
  const [qrUrl, setQrUrl] = useState("");
  const [qrStatus, setQrStatus] = useState<QrStatus>("loading");

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const pollingRef = useRef(false);

  const clearTimer = useCallback(() => {
    pollingRef.current = false;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const resetDialogState = useCallback(() => {
    clearTimer();
    setCookieInput("");
    setQrUrl("");
    setQrStatus("loading");
    setLoading(false);
  }, [clearTimer]);

  const onLoginSuccess = useCallback(
    (cookie: string, profile: UserProfile) => {
      localStorage.setItem(NETEASE_COOKIE_KEY, cookie);
      localStorage.setItem("cookie:netease", cookie);
      setUser(profile);
      setShowDialog(false);
      resetDialogState();
    },
    [resetDialogState],
  );

  const checkLoginStatus = useCallback(async () => {
    const cookie = localStorage.getItem(NETEASE_COOKIE_KEY);
    if (!cookie) return;

    try {
      const profile = await getMyInfo(cookie);
      if (profile) setUser(profile);
    } catch (error) {
      console.error("User info fetch failed:", error);
    }
  }, []);

  useEffect(() => {
    void checkLoginStatus();
    return () => clearTimer();
  }, [checkLoginStatus, clearTimer]);

  const scheduleNextPoll = useCallback((key: string) => {
    if (!pollingRef.current) return;
    timerRef.current = setTimeout(() => {
      void pollStatus(key);
    }, 1600);
  }, []);

  const pollStatus = useCallback(
    async (key: string) => {
      if (!pollingRef.current) return;

      try {
        const res = await checkQrStatus(key);
        if (!pollingRef.current) return;

        const { code, cookie, message } = res;

        switch (code) {
          case 800:
          case 8821:
            setQrStatus("expired");
            clearTimer();
            if (code === 8821) toast.error(message || "登录环境异常");
            return;

          case 801:
            setQrStatus("waiting");
            scheduleNextPoll(key);
            return;

          case 802:
            setQrStatus("scanned");
            scheduleNextPoll(key);
            return;

          case 803:
            setQrStatus("success");
            clearTimer();

            if (!cookie) {
              toast.error("未获取到登录凭证");
              return;
            }

            {
              const profile = await getMyInfo(cookie);
              if (!profile) {
                toast.error("获取用户信息失败");
                return;
              }
              onLoginSuccess(cookie, profile);
            }
            return;

          default:
            scheduleNextPoll(key);
        }
      } catch {
        if (pollingRef.current) scheduleNextPoll(key);
      }
    },
    [clearTimer, onLoginSuccess, scheduleNextPoll],
  );

  const startLogin = useCallback(async () => {
    setShowDialog(true);
    setLoginMode("qr");
    setLoading(true);
    setQrStatus("loading");
    setQrUrl("");
    clearTimer();

    try {
      const key = await getQrKey();
      setQrUrl(`https://music.163.com/login?codekey=${key}`);
      setQrStatus("waiting");
      pollingRef.current = true;
      void pollStatus(key);
    } catch {
      toast.error("获取二维码失败");
      setShowDialog(false);
    } finally {
      setLoading(false);
    }
  }, [clearTimer, pollStatus]);

  const handleCookieLogin = async () => {
    const raw = cookieInput.trim();
    if (!raw) return;

    setLoading(true);
    try {
      const finalCookie = raw.includes("=") ? raw : `MUSIC_U=${raw}`;
      const profile = await getMyInfo(finalCookie);

      if (!profile) {
        toast.error("Cookie 无效或已过期");
        return;
      }

      onLoginSuccess(finalCookie, profile);
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
        subtitle={user ? user.nickname : "登录后可同步歌单"}
        action={
          user ? (
            <Avatar
              className="h-10 w-10 cursor-pointer transition-opacity hover:opacity-80"
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
              {loading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              登录
            </Button>
          )
        }
      />

      <Drawer
        open={showDialog}
        onOpenChange={(open) => {
          setShowDialog(open);
          if (!open) resetDialogState();
        }}
      >
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="mb-2 px-4">
            <DrawerTitle className="text-center text-lg">
              {loginMode === "qr" ? "扫码登录" : "Cookie 登录"}
            </DrawerTitle>
            <DrawerDescription className="text-center text-xs">
              {loginMode === "qr"
                ? "打开网易云音乐 APP 扫一扫"
                : "输入完整 Cookie 或 MUSIC_U"}
            </DrawerDescription>
          </DrawerHeader>

          <div className="flex flex-col items-center space-y-5 overflow-y-auto px-4 pb-5">
            {loginMode === "qr" ? (
              <>
                <div className="relative flex h-[180px] w-[180px] items-center justify-center">
                  {qrStatus === "loading" && (
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" />
                  )}

                  {(qrStatus === "waiting" ||
                    qrStatus === "scanned" ||
                    qrStatus === "success") &&
                    qrUrl && (
                      <div className="h-full w-full rounded-xl bg-white p-2 shadow-sm">
                        <QRCodeSVG
                          value={qrUrl}
                          size={162}
                          level="M"
                          className="h-full w-full"
                        />
                      </div>
                    )}

                  {qrStatus === "scanned" && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-background/65 backdrop-blur-sm">
                      <Check className="mb-2 h-9 w-9 text-primary" />
                      <span className="text-sm font-medium">已扫码</span>
                      <span className="mt-1 text-[11px] text-muted-foreground">
                        请在手机上确认
                      </span>
                    </div>
                  )}

                  {qrStatus === "expired" && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-background/80 backdrop-blur-sm">
                      <ScanLine className="mb-3 h-7 w-7 text-muted-foreground/50" />
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={startLogin}
                        className="h-8 rounded-full px-4 text-xs"
                      >
                        <RefreshCw className="mr-1.5 h-3 w-3" />
                        刷新二维码
                      </Button>
                    </div>
                  )}
                </div>

                <div className="space-y-1 text-center">
                  <p className="text-sm font-medium">{STATUS_MESSAGES[qrStatus]}</p>
                  <p className="text-[11px] text-muted-foreground/70">
                    登录凭证仅保存在本地
                  </p>
                </div>
              </>
            ) : (
              <div className="w-full space-y-3">
                <Textarea
                  wrap="soft"
                  placeholder="粘贴 MUSIC_U 或完整 Cookie 字符串..."
                  value={cookieInput}
                  onChange={(e) => setCookieInput(e.target.value)}
                  className="h-[140px] w-full resize-none overflow-y-auto rounded-xl border-0 bg-muted/20 p-4 font-mono text-[13px] leading-relaxed whitespace-pre-wrap break-all wrap-anywhere placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-primary/20"
                />

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
                    <li>开发者工具 → Application</li>
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
                  className="w-full rounded-full"
                  onClick={handleCookieLogin}
                  disabled={loading || !cookieInput.trim()}
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  验证并登录
                </Button>
              </div>
            )}

            <Button
              variant="link"
              className="h-auto px-0 text-xs text-muted-foreground/70 hover:text-muted-foreground"
              onClick={() =>
                setLoginMode((prev) => (prev === "qr" ? "cookie" : "qr"))
              }
            >
              {loginMode === "qr" ? "改用 Cookie 登录" : "返回扫码登录"}
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
