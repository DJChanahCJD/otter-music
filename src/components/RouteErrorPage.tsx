import { useRouteError, isRouteErrorResponse, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function RouteErrorPage() {
  const error = useRouteError();
  const navigate = useNavigate();

  // 1. 状态与展示内容解析
  const is404 = isRouteErrorResponse(error) && error.status === 404;
  const emoji = is404 ? "👽" : "😵";
  const title = is404 ? "页面走丢了" : "出现了一点小问题";
  const message = is404
    ? "您访问的页面可能被外星人抓走了"
    : isRouteErrorResponse(error)
      ? error.data?.message || error.statusText
      : error instanceof Error
        ? error.message
        : String(error || "发生了未知错误");

  return (
    <div className="flex h-dvh w-full flex-col items-center justify-center bg-background px-6">
      <div className="flex w-full max-w-xs flex-col items-center text-center animate-in fade-in zoom-in-95 duration-500">
        
        <div className="mb-8 flex h-24 w-24 select-none items-center justify-center rounded-3xl bg-secondary/40 text-5xl">
          {emoji}
        </div>
        
        <h1 className="mb-2 text-xl font-bold tracking-tight text-foreground">
          {title}
        </h1>
        <p className="mb-10 text-sm leading-relaxed text-muted-foreground">
          {message}
        </p>
        
        <div className="flex w-full gap-3">
          <Button 
            variant="outline" 
            className="flex-1 h-11 rounded-xl" 
            onClick={() => navigate(-1)}
          >
            返回
          </Button>
          <Button 
            className="flex-1 h-11 rounded-xl shadow-lg shadow-primary/20" 
            onClick={() => navigate("/", { replace: true })}
          >
            首页
          </Button>
        </div>
        
      </div>
    </div>
  );
}