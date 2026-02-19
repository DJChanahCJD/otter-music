package com.otterhub.music;

import android.Manifest;
import android.content.ContentResolver;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.File;

/**
 * Capacitor 插件：扫描设备本地音频文件
 * 使用 MediaStore.Audio API 查询外部存储中的音频文件
 */
@CapacitorPlugin(
    name = "LocalMusicPlugin",
    permissions = {
        @Permission(
            alias = "storage",
            strings = {
                Manifest.permission.READ_EXTERNAL_STORAGE
            }
        ),
        @Permission(
            alias = "audio",
            strings = {
                Manifest.permission.READ_MEDIA_AUDIO
            }
        )
    }
)
public class LocalMusicPlugin extends Plugin {

    private static final String PERMISSION_ALIAS = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU 
        ? "audio" 
        : "storage";

    /**
     * 扫描本地音乐文件
     * 先检查权限，有权限则执行扫描，无权限则请求权限
     */
    @PluginMethod
    public void scanLocalMusic(PluginCall call) {
        if (hasRequiredPermission()) {
            scanMusicFiles(call);
        } else {
            requestPermissionForAlias(PERMISSION_ALIAS, call, "handlePermissionResult");
        }
    }

    /**
     * 权限请求回调
     * 根据权限结果决定是否执行扫描
     */
    @PermissionCallback
    private void handlePermissionResult(PluginCall call) {
        if (hasRequiredPermission()) {
            scanMusicFiles(call);
        } else {
            JSObject result = new JSObject();
            result.put("success", false);
            result.put("error", "Permission denied");
            result.put("files", new JSArray());
            call.resolve(result);
        }
    }

    /**
     * 检查是否拥有所需权限
     * Android 13+ 使用 READ_MEDIA_AUDIO，低版本使用 READ_EXTERNAL_STORAGE
     */
    private boolean hasRequiredPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return getPermissionState("audio") == PermissionState.GRANTED;
        } else {
            return getPermissionState("storage") == PermissionState.GRANTED;
        }
    }

    /**
     * 执行音乐文件扫描
     * 使用 MediaStore.Audio API 查询音频文件信息
     */
    private void scanMusicFiles(PluginCall call) {
        JSArray filesArray = new JSArray();
        ContentResolver resolver = getContext().getContentResolver();
        Uri musicUri = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;

        String[] projection = {
            MediaStore.Audio.Media._ID,
            MediaStore.Audio.Media.TITLE,
            MediaStore.Audio.Media.ARTIST,
            MediaStore.Audio.Media.ALBUM,
            MediaStore.Audio.Media.DURATION,
            MediaStore.Audio.Media.DATA,
            MediaStore.Audio.Media.SIZE
        };

        String selection = MediaStore.Audio.Media.IS_MUSIC + " != 0";
        String sortOrder = MediaStore.Audio.Media.TITLE + " ASC";

        try (Cursor cursor = resolver.query(musicUri, projection, selection, null, sortOrder)) {
            if (cursor != null && cursor.moveToFirst()) {
                int idColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID);
                int titleColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.TITLE);
                int artistColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST);
                int albumColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM);
                int durationColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION);
                int dataColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DATA);
                int sizeColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.SIZE);

                do {
                    JSObject file = new JSObject();
                    file.put("id", cursor.getString(idColumn));
                    file.put("name", cursor.getString(titleColumn));
                    file.put("artist", cursor.getString(artistColumn));
                    file.put("album", cursor.getString(albumColumn));
                    file.put("duration", cursor.getLong(durationColumn));
                    file.put("localPath", cursor.getString(dataColumn));
                    file.put("fileSize", cursor.getLong(sizeColumn));
                    filesArray.put(file);
                } while (cursor.moveToNext());
            }
        } catch (Exception e) {
            JSObject result = new JSObject();
            result.put("success", false);
            result.put("error", "Failed to scan music: " + e.getMessage());
            result.put("files", new JSArray());
            call.resolve(result);
            return;
        }

        JSObject result = new JSObject();
        result.put("success", true);
        result.put("files", filesArray);
        call.resolve(result);
    }

    /**
     * 获取本地文件的播放 URL
     * 将本地文件路径转换为 Capacitor WebView 可访问的 URL
     */
    @PluginMethod
    public void getLocalFileUrl(PluginCall call) {
        String localPath = call.getString("localPath");
        
        if (localPath == null || localPath.isEmpty()) {
            JSObject result = new JSObject();
            result.put("success", false);
            result.put("error", "localPath is required");
            call.resolve(result);
            return;
        }

        try {
            File file = new File(localPath);
            
            if (!file.exists()) {
                JSObject result = new JSObject();
                result.put("success", false);
                result.put("error", "File not found");
                call.resolve(result);
                return;
            }

            // 使用 Capacitor 的 Bridge 获取 WebView 可访问的 URL
            // 对于本地文件，使用 file:// 协议
            Uri fileUri = Uri.fromFile(file);
            String playableUrl = fileUri.toString();

            JSObject result = new JSObject();
            result.put("success", true);
            result.put("url", playableUrl);
            call.resolve(result);
        } catch (Exception e) {
            JSObject result = new JSObject();
            result.put("success", false);
            result.put("error", "Failed to get file URL: " + e.getMessage());
            call.resolve(result);
        }
    }
}
