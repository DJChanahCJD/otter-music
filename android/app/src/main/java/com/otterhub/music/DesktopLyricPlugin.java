package com.otterhub.music;

import android.animation.ValueAnimator;
import android.app.Activity;
import android.app.Application;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.provider.Settings;
import android.text.TextUtils;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 桌面歌词悬浮窗插件（状态栏下方固定歌词条）。
 *
 * 用 WindowManager 添加 TYPE_APPLICATION_OVERLAY 悬浮药丸，水平居中、
 * 默认紧贴系统状态栏下方（适配 Insets / 刘海 / 挖孔），仅允许上下拖动。
 * 逐行歌词由 JS 侧（useDesktopLyric）按与车载歌词相同的时间轴口径推送，
 * 原生只负责窗口的显示、拖动、双击唤起设置与换行动画，不解析 LRC、不起定时器。
 *
 * 交互约定：
 * - 窗口 wrap-content 只包住歌词药丸本身，药丸以外的屏幕触摸自然穿透；
 * - 药丸上快速双击拉起本应用，由 JS 导航到桌面歌词设置项；
 * - 本应用处于前台时自动隐藏（ActivityLifecycleCallbacks 驱动），切后台恢复。
 *
 * 依赖特殊权限 SYSTEM_ALERT_WINDOW（"显示在其他应用上层"），
 * 只能引导用户去系统设置页授予，无法运行时弹窗直接授权。
 */
@CapacitorPlugin(name = "DesktopLyric")
public class DesktopLyricPlugin extends Plugin {

    /** 判定为拖动（而非点击）的手指位移阈值，单位 px */
    private static final int TOUCH_SLOP_PX = 12;
    /** 双击判定：相邻两次点击的最大间隔，单位 ms */
    private static final int DOUBLE_TAP_INTERVAL_MS = 400;
    /** 换行动画：旧字下沉淡出时长 */
    private static final long FADE_OUT_MS = 120;
    /** 换行动画：新字上浮淡入时长 */
    private static final long FADE_IN_MS = 160;
    /** 字号合法范围（sp），JS 侧滑杆为 12-28 */
    private static final float MIN_FONT_SP = 10f;
    private static final float MAX_FONT_SP = 40f;
    /** 药丸最小宽度（dp）：短句时药丸不至于过小，保证观感与可点按区域 */
    private static final int MIN_WIDTH_DP = 100;
    /** 宽度收缩死区（dp）：变窄幅度低于该阈值时保持当前宽度，避免宽度来回小幅抖动 */
    private static final int SHRINK_THRESHOLD_DP = 24;
    /** 双击歌词时随启动 Intent 传递的 extra 标记 */
    private static final String EXTRA_OPEN_SETTINGS = "openDesktopLyricSettings";

    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    private WindowManager windowManager;
    /** 悬浮药丸根布局；null 表示当前未挂载（含因本应用前台而临时隐藏） */
    private LinearLayout overlayView;
    private WindowManager.LayoutParams overlayParams;
    private TextView lyricText;

    /** 用户期望的显示状态（show/hide/三击关闭驱动），与"因本应用前台临时隐藏"解耦 */
    private boolean userVisible;
    /** 本应用是否处于前台 */
    private boolean appForeground;
    /** 当前字号，单位 sp */
    private float fontSp = 15f;
    /** 当前字色（ARGB int），默认白色 */
    private int lyricColor = Color.WHITE;
    /** 最近一次推送的歌词文本，窗口重新挂载时恢复 */
    private String lastText = "";
    /** 状态栏 + 刘海/挖孔的 top inset，单位 px；insets 派发与资源值取 max */
    private int statusBarTop;
    /** 用户在状态栏下方基础上额外下拖的偏移，0 表示默认紧贴状态栏 */
    private int userOffsetY;
    /** 双击检测：上一次点击时间与计数 */
    private long lastTapTime;
    private int tapCount;
    /** 窗口宽度过渡动画；换行/移窗时取消重建 */
    private ValueAnimator widthAnim;
    /** 双击歌词后待 JS 消费的"打开设置"请求 */
    private boolean pendingOpenSettings;

    @Override
    public void load() {
        // 冷启动场景：启动 Intent 可能携带双击歌词的"打开设置"请求
        handleSettingsIntent(bridge.getActivity().getIntent());

        // 监听本应用前后台：前台时隐藏悬浮窗，切后台（边播边用其他 App）恢复。
        // 注意 minSdk 24 < 29，接口的 default 空实现不可用，必须全量覆写
        bridge.getActivity().getApplication()
            .registerActivityLifecycleCallbacks(new Application.ActivityLifecycleCallbacks() {
                @Override
                public void onActivityCreated(Activity activity, Bundle savedInstanceState) {
                }

                @Override
                public void onActivityStarted(Activity activity) {
                }

                @Override
                public void onActivityResumed(Activity activity) {
                    if (activity == bridge.getActivity()) {
                        appForeground = true;
                        onUi(DesktopLyricPlugin.this::applyVisibility);
                    }
                }

                @Override
                public void onActivityPaused(Activity activity) {
                    if (activity == bridge.getActivity()) {
                        appForeground = false;
                        onUi(DesktopLyricPlugin.this::applyVisibility);
                    }
                }

                @Override
                public void onActivityStopped(Activity activity) {
                }

                @Override
                public void onActivitySaveInstanceState(Activity activity, Bundle outState) {
                }

                @Override
                public void onActivityDestroyed(Activity activity) {
                }
            });
    }

    /** 当前 SDK 是否支持 TYPE_APPLICATION_OVERLAY（API 26+），低版本回退 TYPE_PHONE */
    private static boolean supportsOverlayType() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.O;
    }

    /** dp 转 px */
    private float dp(float value) {
        return TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            value,
            getContext().getResources().getDisplayMetrics()
        );
    }

    /** 是否已授予"显示在其他应用上层"权限 */
    private boolean canDrawOverlays() {
        return Settings.canDrawOverlays(getContext());
    }

    /** 把 UI 操作切到主线程执行（悬浮窗只允许主线程操作） */
    private void onUi(Runnable action) {
        mainHandler.post(action);
    }

    /** 系统悬浮窗权限授权页（带应用包名直达开关） */
    @PluginMethod
    public void checkOverlayPermission(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", canDrawOverlays());
        call.resolve(result);
    }

    /** 跳转系统"显示在其他应用上层"授权页；需 NEW_TASK 标记（可能从后台调用） */
    @PluginMethod
    public void requestOverlayPermission(PluginCall call) {
        Intent intent = new Intent(
            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            Uri.parse("package:" + getContext().getPackageName())
        );
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    /** JS 消费"双击歌词打开设置"请求：返回并清除 pending 标记 */
    @PluginMethod
    public void consumeOpenSettings(PluginCall call) {
        JSObject result = new JSObject();
        result.put("pending", pendingOpenSettings);
        pendingOpenSettings = false;
        call.resolve(result);
    }

    /** 热启动场景：Activity 复用时系统投递 onNewIntent，检查是否带"打开设置"请求 */
    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        handleSettingsIntent(intent);
    }

    /** 识别 Intent extra 上的"打开设置"请求并置 pending 标记 */
    private void handleSettingsIntent(Intent intent) {
        if (intent != null && intent.getBooleanExtra(EXTRA_OPEN_SETTINGS, false)) {
            pendingOpenSettings = true;
            intent.removeExtra(EXTRA_OPEN_SETTINGS);
        }
    }

    /**
     * 双击歌词：拉起本应用（带 extra 供 JS 导航到桌面歌词设置项）。
     * 不改 userVisible——回前台时悬浮窗由生命周期自动隐藏，退出设置后自动恢复。
     */
    private void openAppForSettings() {
        Context ctx = getContext();
        Intent intent = ctx.getPackageManager()
            .getLaunchIntentForPackage(ctx.getPackageName());
        if (intent == null) return;

        intent.putExtra(EXTRA_OPEN_SETTINGS, true);
        intent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        ctx.startActivity(intent);
    }

    /** 显示悬浮药丸（幂等；本应用前台时仅记录状态，切后台后自动出现） */
    @PluginMethod
    public void show(PluginCall call) {
        if (!canDrawOverlays()) {
            call.reject("overlay permission not granted");
            return;
        }

        onUi(() -> {
            userVisible = true;
            try {
                applyVisibility();
                call.resolve();
            } catch (Exception e) {
                call.reject("show overlay failed: " + e.getMessage());
            }
        });
    }

    /** 隐藏悬浮药丸（未显示则忽略） */
    @PluginMethod
    public void hide(PluginCall call) {
        onUi(() -> {
            userVisible = false;
            applyVisibility();
            call.resolve();
        });
    }

    /** 更新当前歌词行文本；窗口未挂载时仅缓存，挂载后恢复显示 */
    @PluginMethod
    public void setLyric(PluginCall call) {
        String text = call.getString("text", "");
        onUi(() -> {
            lastText = text;
            if (lyricText != null) {
                animateLyricText(text);
            }
            call.resolve();
        });
    }

    /** 调整歌词字号（单位 sp）；窗口未挂载时仅记录，下次显示生效 */
    @PluginMethod
    public void setSize(PluginCall call) {
        Float size = call.getFloat("size");
        if (size == null || size < MIN_FONT_SP || size > MAX_FONT_SP) {
            call.reject("invalid size");
            return;
        }

        onUi(() -> {
            fontSp = size;
            if (lyricText != null) {
                lyricText.setTextSize(TypedValue.COMPLEX_UNIT_SP, size);
            }
            call.resolve();
        });
    }

    /** 调整歌词字色（hex，如 "#FFFFFF"）；窗口未挂载时仅记录，下次显示生效 */
    @PluginMethod
    public void setColor(PluginCall call) {
        String color = call.getString("color", "");
        int parsed;
        try {
            parsed = Color.parseColor(color);
        } catch (IllegalArgumentException e) {
            call.reject("invalid color");
            return;
        }

        onUi(() -> {
            lyricColor = parsed;
            if (lyricText != null) {
                lyricText.setTextColor(parsed);
            }
            call.resolve();
        });
    }

    /** 按用户开关与本应用前后台状态决定是否真正挂载悬浮窗（visibility 状态不被清除） */
    private void applyVisibility() {
        boolean shouldShow = userVisible && canDrawOverlays() && !appForeground;

        if (shouldShow && overlayView == null) {
            buildOverlay();
        } else if (!shouldShow && overlayView != null) {
            removeOverlay();
        }
    }

    /** 移除悬浮药丸并置空视图引用（不动 userVisible，供前台隐藏/恢复复用） */
    private void removeOverlay() {
        if (overlayView == null || windowManager == null) return;

        if (widthAnim != null) {
            widthAnim.cancel();
            widthAnim = null;
        }

        try {
            windowManager.removeView(overlayView);
        } catch (IllegalArgumentException ignored) {
            // view 已 detach，属竞态，忽略
        }
        overlayView = null;
        overlayParams = null;
        lyricText = null;
    }

    /**
     * 纯代码构建悬浮药丸（无布局 XML）：单行省略 + 深色半透明圆角背景，
     * gravity TOP|CENTER_HORIZONTAL 水平锁死居中、宽度随歌词内容自适应；
     * 纵向位置见 insets 监听。
     */
    private void buildOverlay() {
        Context ctx = getContext();
        windowManager = (WindowManager) ctx.getSystemService(Context.WINDOW_SERVICE);

        int type = supportsOverlayType()
            ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            : WindowManager.LayoutParams.TYPE_PHONE;

        overlayParams = new WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT
        );
        overlayParams.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
        overlayParams.x = 0;
        overlayParams.y = statusBarTop + userOffsetY;

        // 深色半透明圆角背景
        GradientDrawable background = new GradientDrawable();
        background.setColor(0x99000000);
        background.setCornerRadius(dp(18));

        LinearLayout root = new LinearLayout(ctx);
        root.setBackground(background);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setPadding((int) dp(14), (int) dp(6), (int) dp(14), (int) dp(6));

        lyricText = new TextView(ctx);
        lyricText.setTextColor(lyricColor);
        lyricText.setGravity(Gravity.CENTER);
        lyricText.setTextSize(TypedValue.COMPLEX_UNIT_SP, fontSp);
        lyricText.setTypeface(Typeface.DEFAULT_BOLD);
        // 阴影描边，保证浅色背景下可读
        lyricText.setShadowLayer(dp(3), dp(1), dp(1), 0xB3000000);
        lyricText.setMaxLines(1);
        lyricText.setEllipsize(TextUtils.TruncateAt.END);
        // 大字号在窄屏不溢出：最宽占屏幕 80%
        lyricText.setMaxWidth((int) (ctx.getResources().getDisplayMetrics().widthPixels * 0.8f));
        lyricText.setText(lastText);
        root.addView(lyricText);

        // 适配状态栏/刘海/挖孔：以系统 insets 与经典资源值取 max 作为 top 基准
        computeStatusBarTopFromResource();
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            int top;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                top = insets.getInsets(
                    WindowInsets.Type.statusBars() | WindowInsets.Type.displayCutout()
                ).top;
            } else {
                top = insets.getSystemWindowInsetTop();
            }
            if (top > statusBarTop) {
                statusBarTop = top;
                applyY();
            }
            return insets;
        });

        setupTouch(root);

        overlayView = root;
        windowManager.addView(root, overlayParams);
    }

    /** 读取系统 status_bar_height 资源值兜底（部分 ROM 对悬浮窗 insets 派发不全） */
    private void computeStatusBarTopFromResource() {
        int resId = getContext().getResources()
            .getIdentifier("status_bar_height", "dimen", "android");
        if (resId > 0) {
            int height = getContext().getResources().getDimensionPixelSize(resId);
            if (height > statusBarTop) {
                statusBarTop = height;
            }
        }
    }

    /** 把窗口 y 应用为 statusBarTop + userOffsetY（不做边界 clamp，允许自由拖放） */
    private void applyY() {
        if (overlayView == null || overlayParams == null) return;

        overlayParams.y = statusBarTop + userOffsetY;
        try {
            windowManager.updateViewLayout(overlayView, overlayParams);
        } catch (IllegalArgumentException ignored) {
        }
    }

    /**
     * 药丸触摸：垂直拖动（x 恒 0 居中锁定，纵向自由无边界限制）+
     * 三击关闭（相邻点击间隔 ≤ 400ms 计一次，满 3 次移除窗口并通知 JS）。
     */
    private void setupTouch(LinearLayout root) {
        root.setOnTouchListener(new View.OnTouchListener() {
            private float downRawY;
            private int startY;
            private boolean dragging;

            @Override
            public boolean onTouch(View v, MotionEvent event) {
                switch (event.getActionMasked()) {
                    case MotionEvent.ACTION_DOWN:
                        downRawY = event.getRawY();
                        startY = overlayParams.y;
                        dragging = false;
                        return true;

                    case MotionEvent.ACTION_MOVE: {
                        float dy = event.getRawY() - downRawY;

                        if (!dragging && Math.abs(dy) < TOUCH_SLOP_PX) {
                            return true;
                        }
                        dragging = true;

                        userOffsetY = startY + (int) dy - statusBarTop;
                        applyY();
                        return true;
                    }

                    case MotionEvent.ACTION_UP: {
                        if (dragging) {
                            dragging = false;
                            return true;
                        }
                        // 点击（位移小于阈值）：双击判定
                        long now = SystemClock.uptimeMillis();
                        if (now - lastTapTime > DOUBLE_TAP_INTERVAL_MS) {
                            tapCount = 0;
                        }
                        lastTapTime = now;
                        tapCount++;
                        if (tapCount >= 2) {
                            tapCount = 0;
                            openAppForSettings();
                        }
                        return true;
                    }

                    default:
                        return dragging;
                }
            }
        });
    }

    /** 更新歌词文本；非空且内容变化时播放"下沉淡出 → 上浮淡入"换行动画 */
    private void animateLyricText(String text) {
        if (text.equals(lyricText.getText().toString())) return;

        if (text.isEmpty()) {
            lyricText.setText(text);
            animateWindowWidth(computeContentWidth(text));
            return;
        }

        lyricText.animate().cancel();
        lyricText.animate()
            .alpha(0f)
            .translationY(dp(6))
            .setDuration(FADE_OUT_MS)
            .withEndAction(() -> {
                if (lyricText == null) return; // 动画期间窗口被移除
                lyricText.setText(text);
                animateWindowWidth(computeContentWidth(text));
                lyricText.setTranslationY(-dp(6));
                lyricText.animate()
                    .alpha(1f)
                    .translationY(0f)
                    .setDuration(FADE_IN_MS)
                    .start();
            })
            .start();
    }

    /** 按文本内容计算药丸目标宽度：min(文本宽, maxWidth) + 左右 padding + 2px 余量 */
    private int computeContentWidth(String text) {
        if (overlayView == null || lyricText == null) {
            return WindowManager.LayoutParams.WRAP_CONTENT;
        }

        float textW = lyricText.getPaint().measureText(text);
        int padH = overlayView.getPaddingLeft() + overlayView.getPaddingRight();
        // 留 2px 余量，避免字体度量误差触发 ellipsize 截尾
        return Math.min((int) Math.ceil(textW), lyricText.getMaxWidth()) + padH + (int) dp(2);
    }

    /**
     * 平滑过渡窗口宽度到目标值。
     * 悬浮窗的 frame 一旦确定，内容测量就会被旧 frame 限制住（wrap_content 不会自动重算），
     * 必须显式驱动 params.width；直接赋值会瞬间跳变 + 重新居中，观感是"抽搐"，
     * 因此用 ValueAnimator 与换行淡入同步过渡。
     *
     * 缩放策略：宽度不小于 MIN_WIDTH_DP；变窄幅度低于 SHRINK_THRESHOLD_DP 时保持
     * 当前宽度（滞后死区），避免逐行歌词长短交替时药丸宽度来回抖动。
     */
    private void animateWindowWidth(int targetW) {
        if (overlayView == null || overlayParams == null || windowManager == null) return;
        if (targetW == WindowManager.LayoutParams.WRAP_CONTENT) return;

        int startW = overlayView.getWidth();
        if (targetW < startW && startW - targetW < dp(SHRINK_THRESHOLD_DP)) {
            return; // 缩幅在死区内，保持当前宽度
        }
        targetW = Math.max(targetW, (int) dp(MIN_WIDTH_DP));
        if (widthAnim != null) {
            widthAnim.cancel();
            widthAnim = null;
        }
        if (targetW == startW) {
            overlayParams.width = targetW;
            return;
        }

        widthAnim = ValueAnimator.ofInt(startW, targetW);
        widthAnim.setDuration(FADE_IN_MS);
        widthAnim.addUpdateListener(animation -> {
            if (overlayParams == null || overlayView == null) {
                animation.cancel();
                return;
            }
            overlayParams.width = (int) animation.getAnimatedValue();
            try {
                windowManager.updateViewLayout(overlayView, overlayParams);
            } catch (IllegalArgumentException ignored) {
                // view 已 detach，属竞态，忽略
            }
        });
        widthAnim.start();
    }
}
