package com.otterhub.music;

import static androidx.core.view.WindowCompat.enableEdgeToEdge;

import android.content.pm.ActivityInfo;
import android.content.res.Configuration;
import android.os.Build;
import android.os.Bundle;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.PluginHandle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Android 15 enforces edge-to-edge; older versions should let the
        // system keep WebView content above the navigation bar.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.VANILLA_ICE_CREAM) {
            enableEdgeToEdge(getWindow());
        }
        registerPlugin(LocalMusicPlugin.class);
        registerPlugin(BilibiliProxyPlugin.class);
        registerPlugin(AudioRoutePlugin.class);
        registerPlugin(WebViewLoginPlugin.class);
        super.onCreate(savedInstanceState);
        useTransientSystemBars();
    }

    /**
     * 让被隐藏的系统栏以「瞬时」方式显示：用户从边缘下拉时系统栏只是浮层显示并在数秒后自动收回。
     * 默认的 BEHAVIOR_SHOW_BARS_BY_SWIPE 会把系统栏永久显示出来，导致横屏沉浸模式下状态栏常驻。
     */
    private void useTransientSystemBars() {
        WindowInsetsControllerCompat insetsController = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        insetsController.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }

    /**
     * 屏幕方向插件只能锁定为固定方向（"landscape" → SCREEN_ORIENTATION_LANDSCAPE），设备旋转 180° 时不会翻转。
     * 这里把固定横屏改写为「传感器横屏」，允许在两个横屏方向间跟随设备翻转，同时仍然禁止竖屏。
     */
    @Override
    public void setRequestedOrientation(int requestedOrientation) {
        if (requestedOrientation == ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE) {
            requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE;
        }
        super.setRequestedOrientation(requestedOrientation);
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        int nightModeFlags = newConfig.uiMode & Configuration.UI_MODE_NIGHT_MASK;
        boolean isDarkMode = nightModeFlags == Configuration.UI_MODE_NIGHT_YES;
        PluginHandle handle = getBridge().getPlugin("LocalMusicPlugin");
        if (handle != null) {
            ((LocalMusicPlugin) handle.getInstance()).notifyDarkModeChange(isDarkMode);
        }
    }
}
