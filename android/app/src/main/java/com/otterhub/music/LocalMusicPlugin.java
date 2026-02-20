package com.otterhub.music;

import android.Manifest;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.media.MediaMetadataRetriever;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.provider.Settings;

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
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

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
        ),
        @Permission(
            alias = "manageStorage",
            strings = {
                Manifest.permission.MANAGE_EXTERNAL_STORAGE
            }
        )
    }
)
public class LocalMusicPlugin extends Plugin {

    private static final String PERMISSION_ALIAS = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU 
        ? "audio" 
        : "storage";

    private static final String[] AUDIO_EXTENSIONS = {
        ".mp3", ".flac", ".wav", ".m4a", ".aac", 
        ".ogg", ".wma", ".ape", ".opus", ".m4b"
    };

    private static final int MAX_DEPTH = 20;
    private static final int BATCH_SIZE = 100;

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private volatile boolean isScanning = false;

    /**
     * 扫描本地音乐文件（快速扫描，使用 MediaStore）
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
     * 全盘扫描外部存储中的音频文件
     * Android 11+ 需要 MANAGE_EXTERNAL_STORAGE 权限
     */
    @PluginMethod
    public void scanAllStorage(PluginCall call) {
        if (isScanning) {
            JSObject result = new JSObject();
            result.put("success", false);
            result.put("error", "扫描正在进行中");
            result.put("files", new JSArray());
            call.resolve(result);
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            if (!Environment.isExternalStorageManager()) {
                requestManageStoragePermission(call);
                return;
            }
        } else if (!hasRequiredPermission()) {
            requestPermissionForAlias(PERMISSION_ALIAS, call, "handleAllStoragePermissionResult");
            return;
        }

        executeAllStorageScan(call);
    }

    /**
     * 请求 MANAGE_EXTERNAL_STORAGE 权限
     * 需要引导用户到系统设置页面
     */
    private void requestManageStoragePermission(PluginCall call) {
        JSObject result = new JSObject();
        result.put("success", false);
        result.put("error", "需要授予\"允许管理所有文件\"权限");
        result.put("needManageStorage", true);
        call.resolve(result);
    }

    /**
     * 打开系统设置页面授予 MANAGE_EXTERNAL_STORAGE 权限
     */
    @PluginMethod
    public void openManageStorageSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            try {
                Intent intent = new Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                getActivity().startActivity(intent);
                call.resolve();
            } catch (Exception e) {
                Intent intent = new Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION);
                getActivity().startActivity(intent);
                call.resolve();
            }
        } else {
            call.resolve();
        }
    }

    /**
     * 检查是否有全盘扫描权限
     */
    @PluginMethod
    public void hasAllStoragePermission(PluginCall call) {
        JSObject result = new JSObject();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            result.put("hasPermission", Environment.isExternalStorageManager());
        } else {
            result.put("hasPermission", hasRequiredPermission());
        }
        call.resolve(result);
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
     * 全盘扫描权限回调
     */
    @PermissionCallback
    private void handleAllStoragePermissionResult(PluginCall call) {
        if (hasRequiredPermission()) {
            executeAllStorageScan(call);
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
     * 执行音乐文件扫描（MediaStore 快速扫描）
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
                    String title = cursor.getString(titleColumn);
                    String artist = cursor.getString(artistColumn);
                    String album = cursor.getString(albumColumn);
                    
                    if (title == null || title.isEmpty() || "<unknown>".equals(title)) {
                        title = null;
                    }
                    if (artist == null || artist.isEmpty() || "<unknown>".equals(artist)) {
                        artist = null;
                    }
                    if (album == null || album.isEmpty() || "<unknown>".equals(album)) {
                        album = null;
                    }
                    
                    JSObject file = new JSObject();
                    file.put("id", cursor.getString(idColumn));
                    file.put("name", title);
                    file.put("artist", artist);
                    file.put("album", album);
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
     * 执行全盘扫描
     * 在后台线程中递归遍历外部存储目录
     */
    private void executeAllStorageScan(PluginCall call) {
        isScanning = true;

        executor.execute(() -> {
            List<JSObject> filesList = new ArrayList<>();
            File externalStorage = Environment.getExternalStorageDirectory();

            if (externalStorage != null && externalStorage.canRead()) {
                scanDirectory(externalStorage, filesList, 0);
            }

            JSArray filesArray = new JSArray();
            for (JSObject file : filesList) {
                filesArray.put(file);
            }

            JSObject result = new JSObject();
            result.put("success", true);
            result.put("files", filesArray);

            isScanning = false;
            mainHandler.post(() -> call.resolve(result));
        });
    }

    /**
     * 递归扫描目录
     * @param directory 要扫描的目录
     * @param filesList 结果列表
     * @param depth 当前递归深度
     */
    private void scanDirectory(File directory, List<JSObject> filesList, int depth) {
        if (depth > MAX_DEPTH || directory == null || !directory.canRead()) {
            return;
        }

        File[] children = directory.listFiles();
        if (children == null) {
            return;
        }

        for (File file : children) {
            if (file.isDirectory()) {
                String dirName = file.getName();
                if (!dirName.startsWith(".") && !isSystemDirectory(file)) {
                    scanDirectory(file, filesList, depth + 1);
                }
            } else if (isAudioFile(file.getName())) {
                JSObject audioFile = extractAudioMetadata(file);
                if (audioFile != null) {
                    filesList.add(audioFile);
                }
            }
        }
    }

    /**
     * 判断是否为系统目录（跳过扫描）
     */
    private boolean isSystemDirectory(File dir) {
        String path = dir.getAbsolutePath();
        return path.contains("/Android/data/") ||
               path.contains("/Android/obb/") ||
               path.contains("/.trash") ||
               path.contains("/.cache");
    }

    /**
     * 判断文件是否为音频文件
     */
    private boolean isAudioFile(String fileName) {
        if (fileName == null || fileName.isEmpty()) {
            return false;
        }
        String lowerName = fileName.toLowerCase();
        for (String ext : AUDIO_EXTENSIONS) {
            if (lowerName.endsWith(ext)) {
                return true;
            }
        }
        return false;
    }

    /**
     * 从文件名解析标题和艺术家
     * 支持格式: "标题 - 艺术家", "标题"
     */
    private String[] parseFileName(String fileName) {
        if (fileName == null || fileName.isEmpty()) {
            return new String[]{"未知歌曲", null};
        }

        int dotIndex = fileName.lastIndexOf('.');
        String nameWithoutExt = dotIndex > 0 ? fileName.substring(0, dotIndex) : fileName;

        int dashIndex = nameWithoutExt.indexOf(" - ");
        if (dashIndex > 0 && dashIndex < nameWithoutExt.length() - 3) {
            String title = nameWithoutExt.substring(0, dashIndex).trim();
            String artist = nameWithoutExt.substring(dashIndex + 3).trim();
            return new String[]{title, artist};
        }

        return new String[]{nameWithoutExt.trim(), null};
    }

    /**
     * 从音频文件提取元数据
     */
    private JSObject extractAudioMetadata(File file) {
        if (!file.exists() || !file.canRead()) {
            return null;
        }

        JSObject audioFile = new JSObject();
        audioFile.put("id", String.valueOf(file.hashCode()));
        audioFile.put("localPath", file.getAbsolutePath());
        audioFile.put("fileSize", file.length());

        String fileName = file.getName();
        String[] parsed = parseFileName(fileName);
        audioFile.put("name", parsed[0]);
        audioFile.put("artist", parsed[1]);

        MediaMetadataRetriever retriever = null;
        try {
            retriever = new MediaMetadataRetriever();
            retriever.setDataSource(file.getAbsolutePath());

            String metadataTitle = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_TITLE);
            String artist = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ARTIST);
            String album = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ALBUM);
            String durationStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION);

            if (metadataTitle != null && !metadataTitle.isEmpty()) {
                audioFile.put("name", metadataTitle);
            }
            if (artist != null && !artist.isEmpty() && !"<unknown>".equals(artist)) {
                audioFile.put("artist", artist);
            }
            if (album != null && !album.isEmpty() && !"<unknown>".equals(album)) {
                audioFile.put("album", album);
            } else {
                audioFile.put("album", null);
            }
            if (durationStr != null && !durationStr.isEmpty()) {
                long duration = Long.parseLong(durationStr);
                // 过滤掉小于 1 分钟的音频文件
                if (duration < 60000) {
                    return null;
                }
                audioFile.put("duration", duration);
            } else {
                audioFile.put("duration", 0);
            }
        } catch (Exception e) {
            audioFile.put("album", null);
            audioFile.put("duration", 0);
        } finally {
            if (retriever != null) {
                try {
                    retriever.release();
                } catch (Exception ignored) {}
            }
        }

        return audioFile;
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

    /**
     * 删除本地音乐文件
     * 直接删除文件系统中的音频文件
     */
    @PluginMethod
    public void deleteLocalMusic(PluginCall call) {
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
                result.put("success", true);
                call.resolve(result);
                return;
            }

            boolean deleted = file.delete();
            
            JSObject result = new JSObject();
            result.put("success", deleted);
            if (!deleted) {
                result.put("error", "Failed to delete file");
            }
            call.resolve(result);
        } catch (SecurityException e) {
            JSObject result = new JSObject();
            result.put("success", false);
            result.put("error", "Permission denied: " + e.getMessage());
            call.resolve(result);
        } catch (Exception e) {
            JSObject result = new JSObject();
            result.put("success", false);
            result.put("error", "Failed to delete file: " + e.getMessage());
            call.resolve(result);
        }
    }
}
