import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface MarqueeProps {
  children: React.ReactNode;
  className?: string;
  speed?: number; // px/s
  gap?: number; // px
  pauseOnHover?: boolean;
  alwaysScroll?: boolean;
  play?: boolean;
}

export const Marquee: React.FC<MarqueeProps> = ({
  children,
  className,
  speed = 30,
  gap = 40,
  pauseOnHover = true,
  alwaysScroll = false,
  play = true, // 核心控制参数
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [shouldAnimate, setShouldAnimate] = useState(false);
  const [contentWidth, setContentWidth] = useState(0);

  useEffect(() => {
    const calculate = () => {
      if (containerRef.current && contentRef.current) {
        const containerW = containerRef.current.offsetWidth;
        const contentW = contentRef.current.offsetWidth;
        setContentWidth(contentW);
        setShouldAnimate(alwaysScroll || contentW > containerW);
      }
    };

    calculate();
    const observer = new ResizeObserver(calculate);
    if (containerRef.current) observer.observe(containerRef.current);
    if (contentRef.current) observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, [children, alwaysScroll]);

  const duration = (contentWidth + gap) / speed;

  return (
    <div
      ref={containerRef}
      className={cn("relative flex overflow-hidden whitespace-nowrap select-none min-w-0", className)}
    >
      <div
        className={cn("flex items-center", {
          // 只有当 shouldAnimate 为 true 且 play 为 true 时才添加动画类
          "animate-marquee": shouldAnimate && play, 
          "hover:paused": pauseOnHover && shouldAnimate && play,
        })}
        style={
          shouldAnimate && play
            ? ({ "--duration": `${duration}s` } as React.CSSProperties)
            : {}
        }
      >
        <div className="shrink-0 flex items-center" style={{ paddingRight: shouldAnimate ? `${gap}px` : 0 }}>
          <span ref={contentRef}>{children}</span>
        </div>
        
        {/* 只有在动画激活时才渲染副本，节省性能并保持逻辑一致 */}
        {shouldAnimate && play && (
          <div className="shrink-0 flex items-center" style={{ paddingRight: `${gap}px` }}>
            <span>{children}</span>
          </div>
        )}
      </div>
    </div>
  );
};
