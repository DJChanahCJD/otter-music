"use client";

import { useState, useEffect, useCallback } from "react";
import { Lock, LogOut, Plus, RefreshCw, Trash2, Copy, Check, KeyRound, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  adminLogin,
  adminLogout,
  adminListKeys,
  adminCreateKey,
  adminDeleteKey,
  type SyncKeyItem,
} from "@/lib/api/admin";

// ================================================================
// 登录表单
// ================================================================

interface LoginFormProps {
  onLoginSuccess: () => void;
}

function LoginForm({ onLoginSuccess }: LoginFormProps) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    setError("");
    try {
      await adminLogin(password);
      onLoginSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败，请检查密码");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{
      background: "linear-gradient(135deg, oklch(0.12 0.02 160) 0%, oklch(0.08 0.01 160) 50%, oklch(0.05 0 0) 100%)"
    }}>
      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, oklch(0.65 0.14 160), transparent)" }} />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full opacity-8"
          style={{ background: "radial-gradient(circle, oklch(0.55 0.12 160), transparent)" }} />
      </div>

      <Card className="w-full max-w-sm relative z-10 border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl">
        <CardHeader className="text-center pb-2 pt-8">
          <div className="mx-auto mb-4 w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: "oklch(0.65 0.14 160)" }}>
            <Lock className="h-7 w-7 text-white" />
          </div>
          <CardTitle className="text-xl font-semibold text-white">管理后台</CardTitle>
          <CardDescription className="text-white/50 text-sm">Otter Music Admin</CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-8">
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <Input
              type="password"
              placeholder="管理密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-white/10 border-white/20 text-white placeholder:text-white/30 focus-visible:ring-primary/60 h-11"
              autoFocus
            />
            {error && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
                {error}
              </p>
            )}
            <Button
              type="submit"
              className="w-full h-11 font-medium"
              disabled={loading || !password.trim()}
              style={{ background: "oklch(0.65 0.14 160)" }}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin" /> 验证中…
                </span>
              ) : "登 录"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ================================================================
// 复制按钮
// ================================================================

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={handleCopy}
      className="ml-1.5 inline-flex items-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
      title="复制"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

// ================================================================
// Key 管理面板
// ================================================================

interface KeyManagerProps {
  onLogout: () => void;
}

function KeyManager({ onLogout }: KeyManagerProps) {
  const [keys, setKeys] = useState<SyncKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [prefix, setPrefix] = useState("");
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  const loadKeys = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await adminListKeys();
      setKeys(res.keys.sort((a, b) => b.lastSyncTime - a.lastSyncTime));
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadKeys(); }, [loadKeys]);

  const handleCreate = async () => {
    setCreating(true);
    setNewKey("");
    try {
      const res = await adminCreateKey(prefix.trim() || undefined);
      setNewKey(res.syncKey);
      setPrefix("");
      await loadKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (key: string) => {
    if (!confirm(`确认删除 Key：${key}？\n此操作不可恢复，该 Key 关联的同步数据将被永久删除。`)) return;
    setDeletingKey(key);
    try {
      await adminDeleteKey(key);
      setKeys((prev) => prev.filter((k) => k.key !== key));
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    } finally {
      setDeletingKey(null);
    }
  };

  const handleLogout = async () => {
    try {
      await adminLogout();
    } finally {
      onLogout();
    }
  };

  const formatTime = (ts: number) => {
    if (!ts) return <span className="text-muted-foreground/50">从未同步</span>;
    return new Date(ts).toLocaleString("zh-CN", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "oklch(0.65 0.14 160)" }}>
              <KeyRound className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-semibold text-base">Sync Key 管理</span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-1.5 text-muted-foreground hover:text-foreground">
            <LogOut className="h-4 w-4" />
            <span className="text-sm">退出</span>
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-5">
        {/* 统计卡片 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-primary/15">
                <Users className="h-4.5 w-4.5 text-primary" style={{ width: 18, height: 18 }} />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">{keys.length}</p>
                <p className="text-xs text-muted-foreground">Key 总数</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-green-500/20 bg-green-500/5">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-green-500/15">
                <RefreshCw className="text-green-500" style={{ width: 18, height: 18 }} />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">
                  {keys.filter((k) => k.lastSyncTime > 0).length}
                </p>
                <p className="text-xs text-muted-foreground">已同步</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 新增 Key 后显示结果 */}
        {newKey && (
          <Card className="border-green-500/30 bg-green-500/5">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-green-600 font-medium mb-1">Key 创建成功，请及时保存</p>
                <code className="font-mono text-sm font-semibold text-green-700 dark:text-green-400 break-all">
                  {newKey}
                </code>
              </div>
              <CopyButton text={newKey} />
            </CardContent>
          </Card>
        )}

        {/* 操作栏 */}
        <Card>
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">创建新 Key</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex gap-2">
              <Input
                placeholder="前缀（可选，如 user_）"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !creating && handleCreate()}
                className="h-9 text-sm"
                maxLength={20}
              />
              <Button onClick={handleCreate} disabled={creating} size="sm" className="h-9 gap-1.5 shrink-0">
                {creating ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                创建
              </Button>
              <Button variant="outline" size="sm" onClick={loadKeys} disabled={loading} className="h-9 w-9 p-0 shrink-0" title="刷新">
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 错误提示 */}
        {error && (
          <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        {/* Key 列表 */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              全部 Key
              {!loading && <Badge variant="secondary" className="ml-2 text-xs">{keys.length}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground gap-2">
                <RefreshCw className="h-4 w-4 animate-spin" /> 加载中…
              </div>
            ) : keys.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-sm text-muted-foreground gap-2">
                <KeyRound className="h-8 w-8 opacity-30" />
                <p>暂无 Sync Key</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-4 w-1/2">Key</TableHead>
                    <TableHead>最后同步</TableHead>
                    <TableHead className="w-16 pr-4 text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keys.map((item) => (
                    <TableRow key={item.key} className="group">
                      <TableCell className="pl-4 font-mono text-xs">
                        <span className="inline-flex items-center">
                          <span className="truncate max-w-[160px] sm:max-w-xs" title={item.key}>
                            {item.key}
                          </span>
                          <CopyButton text={item.key} />
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatTime(item.lastSyncTime)}
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          disabled={deletingKey === item.key}
                          onClick={() => handleDelete(item.key)}
                          title="删除"
                        >
                          {deletingKey === item.key
                            ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            : <Trash2 className="h-3.5 w-3.5" />}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

// ================================================================
// 主页面：登录态切换
// ================================================================

/**
 * 管理后台主页面。
 * 挂载时尝试拉取 Key 列表探测登录态：
 * - 成功 → 展示 KeyManager
 * - 401  → 展示 LoginForm
 */
export function AdminPage() {
  const [authState, setAuthState] = useState<"checking" | "logged-in" | "logged-out">("checking");

  useEffect(() => {
    adminListKeys()
      .then(() => setAuthState("logged-in"))
      .catch(() => setAuthState("logged-out"));
  }, []);

  if (authState === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (authState === "logged-out") {
    return <LoginForm onLoginSuccess={() => setAuthState("logged-in")} />;
  }

  return (
    <KeyManager onLogout={() => setAuthState("logged-out")} />
  );
}
