package com.otterhub.music;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.Intent;
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

@CapacitorPlugin(name = "LocalMusicPlugin", permissions = {
        @Permission(alias = "storage", strings = { Manifest.permission.READ_EXTERNAL_STORAGE }),
        @Permission(alias = "audio", strings = { Manifest.permission.READ_MEDIA_AUDIO }),
        @Permission(alias = "manageStorage", strings = { Manifest.permission.MANAGE_EXTERNAL_STORAGE })
})
public class LocalMusicPlugin extends Plugin {

    private static final String PERMISSION_ALIAS = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU ? "audio" : "storage";
    private static final String[] AUDIO_EXTENSIONS = {".mp3", ".flac", ".wav", ".m4a", ".aac", ".ogg", ".wma", ".ape", ".opus", ".m4b"};
    private static final int MAX_DEPTH = 20;
    private static final int MAX_FILES = 10000;

    private final ExecutorService executor = Executors.newFixedThreadPool(1);
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private volatile boolean isScanning = false;

    // --- 核心扫描方法 ---

    @PluginMethod
    public void scanLocalMusic(PluginCall call) {
        if (hasRequiredPermission()) scanMusicFiles(call);
        else requestPermissionForAlias(PERMISSION_ALIAS, call, "handlePermissionResult");
    }

    @PluginMethod
    public void scanAllStorage(PluginCall call) {
        if (isScanning) {
            resolveError(call, "扫描正在进行中");
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && !Environment.isExternalStorageManager()) {
            JSObject result = new JSObject().put("success", false).put("error", "需要授予\"允许管理所有文件\"权限").put("needManageStorage", true);
            call.resolve(result);
            return;
        } else if (!hasRequiredPermission()) {
            requestPermissionForAlias(PERMISSION_ALIAS, call, "handleAllStoragePermissionResult");
            return;
        }
        executeAllStorageScan(call);
    }

    // --- 权限与设置 ---

    @PluginMethod
    public void openManageStorageSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            try {
                Intent intent = new Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION, Uri.parse("package:" + getContext().getPackageName()));
                getActivity().startActivity(intent);
            } catch (Exception e) {
                getActivity().startActivity(new Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION));
            }
        }
        call.resolve();
    }

    @PluginMethod
    public void hasAllStoragePermission(PluginCall call) {
        boolean hasPerm = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R ? Environment.isExternalStorageManager() : hasRequiredPermission();
        call.resolve(new JSObject().put("hasPermission", hasPerm));
    }

    @PermissionCallback
    private void handlePermissionResult(PluginCall call) {
        if (hasRequiredPermission()) scanMusicFiles(call); else resolveError(call, "Permission denied");
    }

    @PermissionCallback
    private void handleAllStoragePermissionResult(PluginCall call) {
        if (hasRequiredPermission()) executeAllStorageScan(call); else resolveError(call, "Permission denied");
    }

    private boolean hasRequiredPermission() {
        return getPermissionState(PERMISSION_ALIAS) == PermissionState.GRANTED;
    }

    // --- 内部扫描逻辑 ---

    private void scanMusicFiles(PluginCall call) {
        executor.execute(() -> {
            JSObject result = performMediaStoreScan();
            mainHandler.post(() -> call.resolve(result));
        });
    }

    private JSObject performMediaStoreScan() {
        JSArray filesArray = new JSArray();
        ContentResolver resolver = getContext().getContentResolver();
        Uri musicUri = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;
        String[] projection = {
                MediaStore.Audio.Media._ID, MediaStore.Audio.Media.TITLE, MediaStore.Audio.Media.ARTIST,
                MediaStore.Audio.Media.ALBUM, MediaStore.Audio.Media.DURATION, MediaStore.Audio.Media.SIZE
        };

        try (Cursor cursor = resolver.query(musicUri, projection, MediaStore.Audio.Media.IS_MUSIC + " != 0", null, MediaStore.Audio.Media.TITLE + " ASC")) {
            if (cursor != null && cursor.moveToFirst()) {
                int idCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID);
                int titleCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.TITLE);
                int artistCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST);
                int albumCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM);
                int durationCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION);
                int sizeCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.SIZE);

                do {
                    long id = cursor.getLong(idCol);
                    filesArray.put(new JSObject()
                            .put("id", String.valueOf(id))
                            .put("name", formatUnknown(cursor.getString(titleCol)))
                            .put("artist", formatUnknown(cursor.getString(artistCol)))
                            .put("album", formatUnknown(cursor.getString(albumCol)))
                            .put("duration", cursor.getLong(durationCol))
                            .put("localPath", ContentUris.withAppendedId(musicUri, id).toString())
                            .put("fileSize", cursor.getLong(sizeCol)));
                } while (cursor.moveToNext());
            }
        } catch (Exception e) {
            return new JSObject().put("success", false).put("error", "Failed: " + e.getMessage()).put("files", new JSArray());
        }
        return new JSObject().put("success", true).put("files", filesArray);
    }

    private void executeAllStorageScan(PluginCall call) {
        isScanning = true;
        executor.execute(() -> {
            List<JSObject> filesList = new ArrayList<>();
            File extStorage = Environment.getExternalStorageDirectory();
            if (extStorage != null && extStorage.canRead()) scanDirectory(extStorage, filesList, 0);

            JSArray filesArray = new JSArray();
            for (JSObject file : filesList) filesArray.put(file);

            isScanning = false;
            mainHandler.post(() -> resolveSuccess(call, "files", filesArray));
        });
    }

    private void scanDirectory(File directory, List<JSObject> filesList, int depth) {
        if (depth > MAX_DEPTH || directory == null || !directory.canRead() || filesList.size() >= MAX_FILES) return;

        File[] children = directory.listFiles();
        if (children == null) {
            android.util.Log.d("LocalMusicPlugin", "Cannot read directory (null): " + directory.getAbsolutePath());
            return;
        }

        for (File file : children) {
            if (filesList.size() >= MAX_FILES) return;
            if (file.isDirectory() && !file.getName().startsWith(".") && !isSystemDirectory(file)) {
                scanDirectory(file, filesList, depth + 1);
            } else if (isAudioFile(file.getName())) {
                JSObject audioFile = extractAudioMetadata(file);
                if (audioFile != null) filesList.add(audioFile);
            }
        }
    }

    private JSObject extractAudioMetadata(File file) {
        if (!file.exists() || !file.canRead()) return null;

        String[] parsed = parseFileName(file.getName());
        JSObject audioFile = new JSObject()
                .put("id", String.valueOf(file.hashCode()))
                .put("localPath", file.getAbsolutePath())
                .put("fileSize", file.length())
                .put("name", parsed[0])
                .put("artist", parsed[1])
                .put("album", null) //  专辑信息暂时忽略
                .put("duration", 0);

        if (isValid(parsed[0]) && isValid(parsed[1])) return audioFile; // 歌手和标题都完整，直接返回跳过 MetadataRetriever

        try (MediaMetadataRetriever retriever = new MediaMetadataRetriever()) {
            retriever.setDataSource(file.getAbsolutePath());
            String mTitle = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_TITLE);
            String mArtist = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ARTIST);
            String mAlbum = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ALBUM);
            String mDuration = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION);

            if (isValid(mTitle)) audioFile.put("name", mTitle);
            if (isValid(mAlbum)) audioFile.put("album", mAlbum);
            if (isValid(mArtist) && !(isOtterMusicDownloadPath(file) && containsArtistDelimiter(parsed[1]) && !containsArtistDelimiter(mArtist))) {
                audioFile.put("artist", mArtist);
            }
            if (isValid(mDuration)) {
                long duration = Long.parseLong(mDuration);
                if (duration < 60000) return null; // 过滤小于1分钟的音频
                audioFile.put("duration", duration);
            }
        } catch (Exception ignored) {}
        
        return audioFile;
    }

    // --- 文件操作 ---

    @PluginMethod
    public void getLocalFileUrl(PluginCall call) {
        String localPath = call.getString("localPath");
        if (!isValid(localPath)) {
            resolveError(call, "localPath is required");
            return;
        }
        if (localPath.startsWith("content://")) {
            resolveSuccess(call, "url", localPath);
            return;
        }
        File file = new File(localPath);
        if (!file.exists()) resolveError(call, "File not found");
        else resolveSuccess(call, "url", Uri.fromFile(file).toString());
    }

    @PluginMethod
    public void deleteLocalMusic(PluginCall call) {
        String localPath = call.getString("localPath");
        if (!isValid(localPath)) {
            resolveError(call, "localPath is required");
            return;
        }

        try {
            boolean deleted = false;
            ContentResolver resolver = getContext().getContentResolver();

            if (localPath.startsWith("content://")) {
                deleted = tryDelete(() -> resolver.delete(Uri.parse(localPath), null, null) > 0);
            }
            if (!deleted) {
                deleted = tryDelete(() -> resolver.delete(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, MediaStore.Audio.Media.DATA + "=?", new String[]{localPath}) > 0);
            }
            if (!deleted) {
                File file = new File(localPath);
                deleted = !file.exists() || file.delete();
            }

            if (deleted) resolveSuccess(call, null, null);
            else resolveError(call, "Failed to delete file");
        } catch (Exception e) {
            resolveError(call, "Error: " + e.getMessage());
        }
    }

    // --- 工具辅助方法 ---

    private boolean isSystemDirectory(File dir) {
        String path = dir.getAbsolutePath();
        File ext = Environment.getExternalStorageDirectory();
        if (ext != null) {
            String root = ext.getAbsolutePath();
            if (path.startsWith(root + "/Android/data") || path.startsWith(root + "/Android/obb")) return true;
        }
        return path.contains("/.trash") || path.contains("/.cache");
    }

    private boolean isAudioFile(String fileName) {
        if (!isValid(fileName)) return false;
        String lower = fileName.toLowerCase();
        for (String ext : AUDIO_EXTENSIONS) if (lower.endsWith(ext)) return true;
        return false;
    }

    private String[] parseFileName(String fileName) {
        if (!isValid(fileName)) return new String[]{"未知歌曲", null};
        int dot = fileName.lastIndexOf('.');
        String name = dot > 0 ? fileName.substring(0, dot) : fileName;
        int dash = name.lastIndexOf(" - ");
        return dash > 0 && dash < name.length() - 3 
                ? new String[]{name.substring(0, dash).trim(), name.substring(dash + 3).trim()} 
                : new String[]{name.trim(), null};
    }

    private boolean isOtterMusicDownloadPath(File file) {
        return file != null && file.getAbsolutePath().contains("Download/OtterMusic");
    }

    private boolean containsArtistDelimiter(String s) {
        return isValid(s) && s.matches(".*[/、,，&＆;；|].*");
    }

    private String formatUnknown(String value) {
        return (value == null || value.isEmpty() || "<unknown>".equals(value)) ? null : value;
    }

    private boolean isValid(String s) {
        return s != null && !s.isEmpty() && !"<unknown>".equals(s) && !"未知歌曲".equals(s);
    }

    private void resolveSuccess(PluginCall call, String key, Object value) {
        JSObject res = new JSObject().put("success", true);
        if (key != null) res.put(key, value);
        call.resolve(res);
    }

    private void resolveError(PluginCall call, String msg) {
        call.resolve(new JSObject().put("success", false).put("error", msg).put("files", new JSArray()));
    }

    private boolean tryDelete(DeleteAction action) {
        try { return action.execute(); } catch (Exception e) { return false; }
    }

    private interface DeleteAction { boolean execute() throws Exception; }
}