package com.otterhub.music;

import android.Manifest;
import android.app.Activity;
import android.app.RecoverableSecurityException;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.Context;
import android.content.Intent;
import android.content.IntentSender;
import android.content.SharedPreferences;
import android.content.res.Configuration;
import android.database.Cursor;
import android.media.MediaMetadataRetriever;
import android.media.MediaExtractor;
import android.media.MediaMuxer;
import android.media.MediaFormat;
import android.media.MediaCodec;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.DocumentsContract;
import android.provider.MediaStore;
import android.provider.Settings;
import android.util.Base64;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.BufferedOutputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.nio.ByteBuffer;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "LocalMusicPlugin", permissions = {
        @Permission(alias = "storage", strings = { Manifest.permission.READ_EXTERNAL_STORAGE }),
        @Permission(alias = "audio", strings = { Manifest.permission.READ_MEDIA_AUDIO }),
        @Permission(alias = "manageStorage", strings = { Manifest.permission.MANAGE_EXTERNAL_STORAGE })
})
public class LocalMusicPlugin extends Plugin {

    private static final String PERMISSION_ALIAS = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU ? "audio" : "storage";
    private static final String[] AUDIO_EXTENSIONS = {".mp3", ".flac", ".wav", ".m4a", ".aac", ".ogg", ".wma", ".ape", ".opus", ".m4b", ".m4s"};
    private static final int MAX_DEPTH = 20;
    private static final int MAX_FILES = 10000;

    private final ExecutorService scanExecutor = Executors.newSingleThreadExecutor();
    private final ExecutorService ioExecutor = Executors.newFixedThreadPool(Runtime.getRuntime().availableProcessors());
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private volatile boolean isScanning = false;
    private PluginCall pendingDeleteCall;
    private String pendingDeletePath;
    private static final int DELETE_PERMISSION_REQUEST = 0x7A33;
    private static final String EXCLUDED_PREFS = "LocalMusicExcluded";
    private static final String EXCLUDED_FOLDERS_KEY = "excluded_folders";
    private static final String SEPARATOR = "\u001F";
    private static final String[] DEFAULT_EXCLUDED_PATH_PATTERNS = {
        // English
        "/recordings/call",
        "/callrecord",
        "/call_record",
        "/callrecording",
        "/call_recording",
        "/call_recorder",
        "/sounds/callrecord",
        "/record/call",

        // Chinese
        "/通话录音",
        "/电话录音",
        "/录音/通话",
        "/录音/电话",
    };
    private Set<String> excludedFolderSet = null;

    private static final String SCHEME_CONTENT = "content://";
    private static final String[] PROJECTION_MUSIC = {
            MediaStore.Audio.Media._ID, MediaStore.Audio.Media.TITLE, MediaStore.Audio.Media.ARTIST,
            MediaStore.Audio.Media.ALBUM, MediaStore.Audio.Media.DURATION, MediaStore.Audio.Media.SIZE,
            MediaStore.Audio.Media.DATE_MODIFIED
    };

    private String cachedStorageRoot;

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

    @PluginMethod
    public void pickDownloadDirectory(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        startActivityForResult(call, intent, "handlePickDirectoryResult");
    }

    // --- 目录选择回调 ---

    @ActivityCallback
    private void handlePickDirectoryResult(PluginCall call, ActivityResult result) {
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.resolve(new JSObject().put("success", false).put("error", "cancelled"));
            return;
        }

        Uri treeUri = result.getData().getData();
        if (treeUri == null) {
            call.resolve(new JSObject().put("success", false).put("error", "No directory selected"));
            return;
        }

        String relativePath = extractPathFromTreeUri(treeUri);
        call.resolve(new JSObject()
            .put("success", true)
            .put("path", relativePath != null ? relativePath : "")
            .put("uri", treeUri.toString()));
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

    @PluginMethod
    public void getSystemDarkMode(PluginCall call) {
        int nightModeFlags = getContext().getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK;
        boolean isDarkMode = nightModeFlags == Configuration.UI_MODE_NIGHT_YES;
        call.resolve(new JSObject().put("isDarkMode", isDarkMode));
    }

    public void notifyDarkModeChange(boolean isDarkMode) {
        notifyListeners("darkModeChange", new JSObject().put("isDarkMode", isDarkMode));
    }

    // --- 内部扫描逻辑 ---

    private void scanMusicFiles(PluginCall call) {
        if (isScanning) {
            resolveError(call, "扫描正在进行中");
            return;
        }
        isScanning = true;
        scanExecutor.execute(() -> {
            try {
                JSObject result = performMediaStoreScan();
                mainHandler.post(() -> call.resolve(result));
            } catch (Exception e) {
                mainHandler.post(() -> resolveError(call, "Scan failed: " + e.getMessage()));
            } finally {
                isScanning = false;
            }
        });
    }

    private JSObject performMediaStoreScan() {
        JSArray filesArray = new JSArray();
        ContentResolver resolver = getContext().getContentResolver();
        Uri musicUri = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;

        try (Cursor cursor = resolver.query(musicUri, PROJECTION_MUSIC, buildMediaStoreMusicSelection(), null, MediaStore.Audio.Media.DATE_MODIFIED + " DESC")) {
            if (cursor != null && cursor.moveToFirst()) {
                int idCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID);
                int titleCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.TITLE);
                int artistCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST);
                int albumCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM);
                int durationCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION);
                int sizeCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.SIZE);
                int modifiedCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DATE_MODIFIED);

                do {
                    long id = cursor.getLong(idCol);
                    filesArray.put(new JSObject()
                            .put("id", String.valueOf(id))
                            .put("name", formatUnknown(cursor.getString(titleCol)))
                            .put("artist", formatUnknown(cursor.getString(artistCol)))
                            .put("album", formatUnknown(cursor.getString(albumCol)))
                            .put("duration", cursor.getLong(durationCol))
                            .put("localPath", ContentUris.withAppendedId(musicUri, id).toString())
                            .put("fileSize", cursor.getLong(sizeCol))
                            .put("modifiedTime", cursor.getLong(modifiedCol) * 1000));
                } while (cursor.moveToNext());
            }
        } catch (Exception e) {
            return new JSObject().put("success", false).put("error", "Failed: " + e.getMessage()).put("files", new JSArray());
        }
        return new JSObject().put("success", true).put("files", filesArray);
    }

    /** 构建保守的 MediaStore 音乐过滤条件，优先用系统用途元数据避免关键词误伤。 */
    private String buildMediaStoreMusicSelection() {
        String selection = MediaStore.Audio.Media.IS_MUSIC + " != 0";
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            selection += " AND " + MediaStore.Audio.Media.IS_RECORDING + " = 0"
                    + " AND " + MediaStore.Audio.Media.IS_PODCAST + " = 0"
                    + " AND " + MediaStore.Audio.Media.IS_RINGTONE + " = 0"
                    + " AND " + MediaStore.Audio.Media.IS_ALARM + " = 0"
                    + " AND " + MediaStore.Audio.Media.IS_NOTIFICATION + " = 0";
        }
        return selection;
    }

    private void executeAllStorageScan(PluginCall call) {
        isScanning = true;
        scanExecutor.execute(() -> {
            try {
                excludedFolderSet = loadExcludedFolders();
                List<JSObject> filesList = new ArrayList<>();
                File extStorage = Environment.getExternalStorageDirectory();
                if (extStorage != null && extStorage.canRead()) scanDirectory(extStorage, filesList, 0);

                JSArray filesArray = new JSArray();
                for (JSObject file : filesList) filesArray.put(file);

                mainHandler.post(() -> resolveSuccess(call, "files", filesArray));
            } catch (Exception e) {
                mainHandler.post(() -> resolveError(call, "Scan failed: " + e.getMessage()));
            } finally {
                excludedFolderSet = null;
                isScanning = false;
            }
        });
    }

    private void scanDirectory(File directory, List<JSObject> filesList, int depth) {
        if (depth > MAX_DEPTH || directory == null || !directory.canRead() || filesList.size() >= MAX_FILES) return;
        if (directory.getName().startsWith(".") || isSystemDirectory(directory)) return;

        File[] children = directory.listFiles();
        if (children == null) {
            android.util.Log.d("LocalMusicPlugin", "Cannot read directory (null): " + directory.getAbsolutePath());
            return;
        }

        for (File file : children) {
            if (filesList.size() >= MAX_FILES) return;
            if (file.isDirectory()) {
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
                .put("modifiedTime", file.lastModified())
                .put("name", parsed[0])
                .put("artist", parsed[1])
                .put("album", (String) null)
                .put("duration", 0);

        try (MediaMetadataRetriever retriever = new MediaMetadataRetriever()) {
            setRetrieverDataSource(retriever, file.getAbsolutePath());
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
                if (duration < 60000) return null;
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
        if (localPath.startsWith(SCHEME_CONTENT)) {
            resolveSuccess(call, "url", localPath);
            return;
        }
        File file = new File(localPath);
        if (!file.exists()) resolveError(call, "File not found");
        else resolveSuccess(call, "url", Uri.fromFile(file).toString());
    }

    /** 读取音频文件内嵌封面，返回可直接用于 img.src 的 data URL。 */
    @PluginMethod
    public void getEmbeddedCover(PluginCall call) {
        String localPath = call.getString("localPath");
        if (!isValid(localPath)) {
            resolveError(call, "localPath is required");
            return;
        }

        ioExecutor.execute(() -> {
            try (MediaMetadataRetriever retriever = new MediaMetadataRetriever()) {
                setRetrieverDataSource(retriever, localPath);
                byte[] picture = retriever.getEmbeddedPicture();
                if (picture == null || picture.length == 0) {
                    mainHandler.post(() -> resolveError(call, "No embedded cover"));
                    return;
                }

                String mimeType = detectImageMimeType(picture);
                String base64 = Base64.encodeToString(picture, Base64.NO_WRAP);
                JSObject result = new JSObject()
                        .put("success", true)
                        .put("dataUrl", "data:" + mimeType + ";base64," + base64);
                mainHandler.post(() -> call.resolve(result));
            } catch (Exception e) {
                mainHandler.post(() -> resolveError(call, "Failed: " + e.getMessage()));
            }
        });
    }

    /** 读取内嵌歌词：MP3 走 ID3v2 USLT 帧，FLAC 走 VORBIS_COMMENT 的 LYRICS 系列键。 */
    @PluginMethod
    public void getEmbeddedLyrics(PluginCall call) {
        String localPath = call.getString("localPath");
        if (!isValid(localPath)) {
            resolveError(call, "localPath is required");
            return;
        }

        ioExecutor.execute(() -> {
            try {
                String[] parts = extractEmbeddedLyrics(localPath);
                if (parts == null || !isValid(parts[0])) {
                    mainHandler.post(() -> resolveError(call, "No embedded lyrics"));
                    return;
                }

                JSObject result = new JSObject()
                        .put("success", true)
                        .put("lyric", parts[0]);
                if (parts.length > 1 && parts[1] != null) {
                    result.put("tlyric", parts[1]);
                }
                mainHandler.post(() -> call.resolve(result));
            } catch (Exception e) {
                mainHandler.post(() -> resolveError(call, "Failed: " + e.getMessage()));
            }
        });
    }

    /**
     * 把歌词写入 FLAC 的 VORBIS_COMMENT 块。
     *
     * 音频帧以流式方式复制到临时文件，内存占用与文件大小无关（只在内存里重建 Comment 条目），
     * 成功后再替换原文件，失败时原文件保持不变。MP3 走 JS 侧 ID3 写入，不走此方法。
     */
    @PluginMethod
    public void writeEmbeddedLyrics(PluginCall call) {
        String localPath = call.getString("localPath");
        String lyric = call.getString("lyric");
        String tlyric = call.getString("tlyric");
        if (!isValid(localPath)) {
            resolveError(call, "localPath is required");
            return;
        }
        if (!isValid(lyric)) {
            resolveError(call, "lyric is required");
            return;
        }

        ioExecutor.execute(() -> {
            try {
                writeFlacLyrics(localPath, lyric, tlyric);
                mainHandler.post(() -> resolveSuccess(call, null, null));
            } catch (Exception e) {
                mainHandler.post(() -> resolveError(call, "Failed: " + e.getMessage()));
            }
        });
    }

    @PluginMethod
    public void deleteLocalMusic(PluginCall call) {
        String localPath = call.getString("localPath");
        if (!isValid(localPath)) {
            resolveError(call, "localPath is required");
            return;
        }

        try {
            if (performDeleteFile(localPath)) resolveSuccess(call, null, null);
            else resolveError(call, "Failed to delete file");
        } catch (SecurityException e) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                handleRecoverableDelete(call, localPath, e);
            } else {
                resolveError(call, "Error: " + e.getMessage());
            }
        } catch (Exception e) {
            resolveError(call, "Error: " + e.getMessage());
        }
    }

    private void handleRecoverableDelete(PluginCall call, String localPath, SecurityException e) {
        if (!(e instanceof RecoverableSecurityException)) {
            resolveError(call, "Delete failed: " + e.getMessage());
            return;
        }
        try {
            RecoverableSecurityException rse = (RecoverableSecurityException) e;
            pendingDeleteCall = call;
            pendingDeletePath = localPath;
            IntentSender sender = rse.getUserAction().getActionIntent().getIntentSender();
            getActivity().startIntentSenderForResult(sender, DELETE_PERMISSION_REQUEST, null, 0, 0, 0);
        } catch (IntentSender.SendIntentException ex) {
            pendingDeleteCall = null;
            pendingDeletePath = null;
            resolveError(call, "Failed to request delete: " + ex.getMessage());
        }
    }

    @Override
    protected void handleOnActivityResult(int requestCode, int resultCode, android.content.Intent data) {
        super.handleOnActivityResult(requestCode, resultCode, data);
        if (requestCode != DELETE_PERMISSION_REQUEST || pendingDeleteCall == null) return;

        if (resultCode == Activity.RESULT_OK) {
            retryDelete(pendingDeleteCall, pendingDeletePath);
        } else {
            resolveError(pendingDeleteCall, "Delete cancelled by user");
        }
        pendingDeleteCall = null;
        pendingDeletePath = null;
    }

    @Override
    protected void handleOnDestroy() {
        if (scanExecutor != null && !scanExecutor.isShutdown()) scanExecutor.shutdownNow();
        if (ioExecutor != null && !ioExecutor.isShutdown()) ioExecutor.shutdownNow();
        super.handleOnDestroy();
    }

    private void retryDelete(PluginCall call, String localPath) {
        try {
            if (performDeleteFile(localPath)) resolveSuccess(call, null, null);
            else resolveError(call, "Failed to delete file");
        } catch (SecurityException e) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && e instanceof RecoverableSecurityException) {
                handleRecoverableDelete(call, localPath, e);
            } else {
                resolveError(call, "Error: " + e.getMessage());
            }
        } catch (Exception e) {
            resolveError(call, "Error: " + e.getMessage());
        }
    }

    private boolean performDeleteFile(String localPath) {
        ContentResolver resolver = getContext().getContentResolver();
        boolean deleted = false;

        if (localPath.startsWith(SCHEME_CONTENT)) {
            deleted = tryDelete(() -> resolver.delete(Uri.parse(localPath), null, null) > 0);
        }
        if (!deleted) {
            deleted = tryDelete(() -> resolver.delete(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, MediaStore.Audio.Media.DATA + "=?", new String[]{localPath}) > 0);
        }
        if (!deleted) {
            File file = new File(localPath);
            deleted = !file.exists() || file.delete();
        }
        return deleted;
    }

    // --- 工具辅助方法 ---

    private boolean isSystemDirectory(File dir) {
        String path = dir.getAbsolutePath().toLowerCase();
        if (cachedStorageRoot == null) {
            File ext = Environment.getExternalStorageDirectory();
            cachedStorageRoot = ext != null ? ext.getAbsolutePath().toLowerCase() : "";
        }
        if (!cachedStorageRoot.isEmpty()
                && (path.startsWith(cachedStorageRoot + "/android/data") || path.startsWith(cachedStorageRoot + "/android/obb"))) {
            return true;
        }
        for (String pattern : DEFAULT_EXCLUDED_PATH_PATTERNS) {
            if (path.contains(pattern)) return true;
        }
        if (excludedFolderSet != null) {
            for (String excluded : excludedFolderSet) {
                if (path.contains(excluded.toLowerCase())) return true;
            }
        }
        return path.contains("/.trash") || path.contains("/.cache")
                || path.contains("/tencent/micromsg")
                || path.contains("/tencent/mobileqq")
                || path.contains("/qq_collection");
    }

    // --- 排除目录管理 ---

    @PluginMethod
    public void getExcludedFolders(PluginCall call) {
        JSArray arr = new JSArray();
        for (String folder : loadExcludedFolders()) arr.put(folder);
        call.resolve(new JSObject().put("success", true).put("folders", arr));
    }

    @PluginMethod
    public void addExcludedFolder(PluginCall call) {
        String folder = call.getString("folder");
        if (folder == null || folder.trim().isEmpty()) {
            call.resolve(new JSObject().put("success", false).put("error", "folder is required"));
            return;
        }
        Set<String> folders = loadExcludedFolders();
        folders.add(normalizeExcludedPath(folder.trim()));
        saveExcludedFolders(folders);
        call.resolve(new JSObject().put("success", true).put("folder", folder));
    }

    @PluginMethod
    public void removeExcludedFolder(PluginCall call) {
        String folder = call.getString("folder");
        if (folder == null || folder.trim().isEmpty()) {
            call.resolve(new JSObject().put("success", false).put("error", "folder is required"));
            return;
        }
        Set<String> folders = loadExcludedFolders();
        folders.remove(folder.trim());
        saveExcludedFolders(folders);
        call.resolve(new JSObject().put("success", true).put("folder", folder));
    }

    @PluginMethod
    public void pickExcludedDirectory(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        startActivityForResult(call, intent, "handlePickExcludedDirectoryResult");
    }

    @ActivityCallback
    private void handlePickExcludedDirectoryResult(PluginCall call, ActivityResult result) {
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.resolve(new JSObject().put("success", false).put("error", "cancelled"));
            return;
        }
        Uri treeUri = result.getData().getData();
        if (treeUri == null) {
            call.resolve(new JSObject().put("success", false).put("error", "No directory selected"));
            return;
        }
        String relativePath = extractPathFromTreeUri(treeUri);
        String path = relativePath != null ? relativePath : "";
        if (!path.isEmpty()) {
            Set<String> folders = loadExcludedFolders();
            folders.add(normalizeExcludedPath(path));
            saveExcludedFolders(folders);
        }
        call.resolve(new JSObject()
                .put("success", !path.isEmpty())
                .put("path", path)
                .put("uri", treeUri.toString()));
    }

    private Set<String> loadExcludedFolders() {
        SharedPreferences prefs = getContext().getSharedPreferences(EXCLUDED_PREFS, Context.MODE_PRIVATE);
        String raw = prefs.getString(EXCLUDED_FOLDERS_KEY, "");
        if (raw.isEmpty()) return new HashSet<>();
        Set<String> set = new HashSet<>();
        for (String part : raw.split(SEPARATOR)) {
            if (!part.isEmpty()) set.add(part);
        }
        return set;
    }

    private void saveExcludedFolders(Set<String> folders) {
        String raw = String.join(SEPARATOR, folders);
        getContext().getSharedPreferences(EXCLUDED_PREFS, Context.MODE_PRIVATE)
                .edit().putString(EXCLUDED_FOLDERS_KEY, raw).apply();
    }

    private String normalizeExcludedPath(String path) {
        String normalized = path.trim();
        if (normalized.startsWith("/")) normalized = normalized.substring(1);
        if (normalized.endsWith("/")) normalized = normalized.substring(0, normalized.length() - 1);
        return normalized;
    }

    private boolean isAudioFile(String fileName) {
        if (!isValid(fileName)) return false;
        String lower = fileName.toLowerCase();
        for (String ext : AUDIO_EXTENSIONS) if (lower.endsWith(ext)) return true;
        return false;
    }

    /** 将 file:// URI 或普通文件路径解析为纯文件系统路径。 */
    private String resolvePlainPath(String localPath) {
        if (localPath.startsWith("file://")) {
            String path = Uri.parse(localPath).getPath();
            return path != null ? path : localPath;
        }
        return localPath;
    }

    /** 为普通文件路径、file URI 和 content URI 设置 MediaMetadataRetriever 数据源。 */
    private void setRetrieverDataSource(MediaMetadataRetriever retriever, String localPath) {
        if (localPath.startsWith(SCHEME_CONTENT)) {
            retriever.setDataSource(getContext(), Uri.parse(localPath));
            return;
        }
        String path = resolvePlainPath(localPath);
        File file = new File(path);
        if (!file.exists()) {
            throw new RuntimeException("File not found: " + path);
        }
        try (FileInputStream fis = new FileInputStream(file)) {
            retriever.setDataSource(fis.getFD());
        } catch (IOException e) {
            try {
                retriever.setDataSource(path);
            } catch (Exception ex) {
                throw new RuntimeException("Cannot open file: " + path, e);
            }
        }
    }

    /** 根据图片魔数识别常见封面 MIME 类型。 */
    private String detectImageMimeType(byte[] data) {
        if (data.length >= 8
                && data[0] == (byte) 0x89
                && data[1] == 0x50
                && data[2] == 0x4E
                && data[3] == 0x47) {
            return "image/png";
        }
        if (data.length >= 12
                && data[0] == 0x52
                && data[1] == 0x49
                && data[2] == 0x46
                && data[3] == 0x46
                && data[8] == 0x57
                && data[9] == 0x45
                && data[10] == 0x42
                && data[11] == 0x50) {
            return "image/webp";
        }
        return "image/jpeg";
    }

    /** 原文与译文的分隔标记，与 id3-embed.ts 中的 TLYRIC_DELIMITER 对应。 */
    private static final String TLYRIC_DELIMITER = "[TLYRIC]";

    /** FLAC metadata block 中 VORBIS_COMMENT 的块类型。 */
    private static final int FLAC_BLOCK_VORBIS_COMMENT = 4;

    /** FLAC metadata block 中 PADDING 的块类型。 */
    private static final int FLAC_BLOCK_PADDING = 1;

    /** 歌词可能出现的 Vorbis Comment 键名，数组顺序即优先级。 */
    private static final String[] FLAC_LYRIC_KEYS = {
            "LYRICS", "UNSYNCEDLYRICS", "UNSYNCED LYRICS", "SYNCEDLYRICS", "LYRIC"
    };

    /** 单个 metadata block / tag 允许读取的上限，避免异常文件申请超大内存。 */
    private static final int MAX_METADATA_BLOCK = 5 * 1024 * 1024;

    /** 写入歌词后保留的 PADDING 块长度，符合 FLAC 惯例。 */
    private static final int FLAC_WRITE_PADDING = 8 * 1024;

    /** 流式复制音频帧的缓冲区大小，保证内存占用与文件大小无关。 */
    private static final int COPY_BUFFER_SIZE = 64 * 1024;

    /** 原文件没有 VORBIS_COMMENT 时使用的 vendor。 */
    private static final String DEFAULT_VORBIS_VENDOR = "Otter Music";

    /** 按文件魔数分派解析器，从内嵌 tag 中提取歌词并拆分为 [lyric, tlyric]。 */
    private String[] extractEmbeddedLyrics(String localPath) throws IOException {
        try (InputStream input = openLocalInputStream(localPath)) {
            if (input == null) return null;

            byte[] magic = readExact(input, 4);
            if (magic == null) return null;

            if (magic[0] == 'f' && magic[1] == 'L' && magic[2] == 'a' && magic[3] == 'C') {
                return splitLyricTranslation(extractFlacLyrics(input));
            }

            if (magic[0] == 'I' && magic[1] == 'D' && magic[2] == '3') {
                byte[] rest = readExact(input, 6);
                if (rest == null) return null;

                byte[] header = new byte[10];
                System.arraycopy(magic, 0, header, 0, 4);
                System.arraycopy(rest, 0, header, 4, 6);
                return splitLyricTranslation(extractId3UsltLyric(header, input));
            }
        }
        return null;
    }

    /** 按 [TLYRIC] 标记拆分原词与译词；无有效歌词返回 null。 */
    private String[] splitLyricTranslation(String lyric) {
        if (!isValid(lyric)) return null;

        int delimIdx = lyric.indexOf(TLYRIC_DELIMITER);
        if (delimIdx < 0) return new String[]{ lyric, null };

        String original = lyric.substring(0, delimIdx).trim();
        String translation = lyric.substring(delimIdx + TLYRIC_DELIMITER.length()).trim();
        return new String[]{ original, isValid(translation) ? translation : null };
    }

    /** 在已读取的 10 字节 ID3v2 头之后，提取首个 USLT 歌词帧正文。 */
    private String extractId3UsltLyric(byte[] header, InputStream input) throws IOException {
        int majorVersion = header[3] & 0xFF;
        int tagSize = readSynchsafeInt(header, 6);
        if (tagSize <= 0 || tagSize > MAX_METADATA_BLOCK) return null;

        byte[] tag = readExact(input, tagSize);
        if (tag == null) return null;

        int offset = skipExtendedHeaderIfNeeded(tag, majorVersion, header[5] & 0xFF);
        while (offset + 10 <= tag.length) {
            String frameId = new String(tag, offset, 4, StandardCharsets.ISO_8859_1);
            if (frameId.trim().isEmpty()) break;

            int frameSize = majorVersion >= 4
                    ? readSynchsafeInt(tag, offset + 4)
                    : readInt(tag, offset + 4);
            if (frameSize <= 0 || offset + 10 + frameSize > tag.length) break;

            if ("USLT".equals(frameId)) {
                return decodeUsltFrame(Arrays.copyOfRange(tag, offset + 10, offset + 10 + frameSize));
            }

            offset += 10 + frameSize;
        }
        return null;
    }

    /** 遍历 FLAC metadata block，返回 VORBIS_COMMENT 中优先级最高的歌词字段。 */
    private String extractFlacLyrics(InputStream input) throws IOException {
        boolean isLast = false;
        while (!isLast) {
            byte[] blockHeader = readExact(input, 4);
            if (blockHeader == null) return null;

            isLast = (blockHeader[0] & 0x80) != 0;
            int blockType = blockHeader[0] & 0x7F;
            int blockLength = ((blockHeader[1] & 0xFF) << 16)
                    | ((blockHeader[2] & 0xFF) << 8)
                    | (blockHeader[3] & 0xFF);

            if (blockType == FLAC_BLOCK_VORBIS_COMMENT
                    && blockLength > 0
                    && blockLength <= MAX_METADATA_BLOCK) {
                byte[] block = readExact(input, blockLength);
                if (block == null) return null;

                String lyric = parseVorbisCommentLyric(block);
                if (isValid(lyric)) return lyric;
                continue;
            }

            if (!skipFully(input, blockLength)) return null;
        }
        return null;
    }

    /** VORBIS_COMMENT 块解析结果。 */
    private static final class VorbisComment {
        final String vendor;
        final List<String> entries;

        VorbisComment(String vendor, List<String> entries) {
            this.vendor = vendor;
            this.entries = entries;
        }
    }

    /** 解析 VORBIS_COMMENT 块正文；结构非法返回 null。 */
    private VorbisComment parseVorbisComment(byte[] block) {
        if (block.length < 4) return null;

        int vendorLength = readLeInt(block, 0);
        if (vendorLength < 0 || vendorLength > block.length - 4) return null;

        int offset = 4;
        String vendor = new String(block, offset, vendorLength, StandardCharsets.UTF_8);
        offset += vendorLength;
        if (offset + 4 > block.length) return null;

        int commentCount = readLeInt(block, offset);
        offset += 4;
        if (commentCount < 0) return null;

        List<String> entries = new ArrayList<>();
        for (int i = 0; i < commentCount; i++) {
            if (offset + 4 > block.length) break;

            int entryLength = readLeInt(block, offset);
            offset += 4;
            if (entryLength < 0 || entryLength > block.length - offset) break;

            entries.add(new String(block, offset, entryLength, StandardCharsets.UTF_8));
            offset += entryLength;
        }
        return new VorbisComment(vendor, entries);
    }

    /** 返回 VORBIS_COMMENT 中优先级最高的歌词值；无匹配键返回 null。 */
    private String parseVorbisCommentLyric(byte[] block) {
        VorbisComment comment = parseVorbisComment(block);
        if (comment == null) return null;

        String best = null;
        int bestRank = Integer.MAX_VALUE;
        for (String entry : comment.entries) {
            int equalsIdx = entry.indexOf('=');
            if (equalsIdx <= 0) continue;

            int rank = flacLyricKeyRank(entry.substring(0, equalsIdx).trim());
            String value = entry.substring(equalsIdx + 1);
            if (rank < 0 || rank >= bestRank || !isValid(value)) continue;

            best = value;
            bestRank = rank;
        }
        return best;
    }

    /** 将歌词（原文 + 可选译文）写入 FLAC 的 VORBIS_COMMENT。 */
    private void writeFlacLyrics(String localPath, String lyric, String tlyric) throws IOException {
        String payload = isValid(tlyric)
                ? lyric + "\n" + TLYRIC_DELIMITER + "\n" + tlyric
                : lyric;

        if (localPath.startsWith(SCHEME_CONTENT)) {
            File cacheTemp = new File(getContext().getCacheDir(), "otter-lyric-" + System.nanoTime() + ".flac");
            try {
                rewriteFlacFile(localPath, cacheTemp, payload);
                try (InputStream in = new FileInputStream(cacheTemp);
                     OutputStream out = getContext().getContentResolver()
                             .openOutputStream(Uri.parse(localPath), "rwt")) {
                    if (out == null) throw new IOException("Cannot open output stream");
                    copyRemaining(in, out);
                }
            } finally {
                cacheTemp.delete();
            }
            return;
        }

        File target = new File(resolvePlainPath(localPath));
        if (!target.exists()) throw new IOException("File not found");

        // 临时文件与目标同目录，renameTo 才是同一文件系统上的替换
        File temp = new File(target.getParentFile(), target.getName() + ".tmp");
        try {
            rewriteFlacFile(target.getAbsolutePath(), temp, payload);
            if (!temp.renameTo(target)) throw new IOException("Failed to replace file");
        } catch (IOException | RuntimeException e) {
            temp.delete();
            throw e;
        }
    }

    /** 重建 FLAC：替换 VORBIS_COMMENT 中的歌词，其余 metadata 块与音频帧原样流式复制。 */
    private void rewriteFlacFile(String sourcePath, File targetFile, String lyric) throws IOException {
        try (InputStream in = openLocalInputStream(sourcePath);
             OutputStream out = new BufferedOutputStream(
                     new FileOutputStream(targetFile), COPY_BUFFER_SIZE)) {
            if (in == null) throw new IOException("Cannot open file");

            byte[] magic = readExact(in, 4);
            if (magic == null || magic[0] != 'f' || magic[1] != 'L' || magic[2] != 'a' || magic[3] != 'C') {
                throw new IOException("Not a FLAC file");
            }
            out.write(magic);

            VorbisComment sourceComment = null;
            boolean isLast = false;
            while (!isLast) {
                byte[] blockHeader = readExact(in, 4);
                if (blockHeader == null) throw new IOException("Truncated FLAC metadata");

                isLast = (blockHeader[0] & 0x80) != 0;
                int blockType = blockHeader[0] & 0x7F;
                int blockLength = ((blockHeader[1] & 0xFF) << 16)
                        | ((blockHeader[2] & 0xFF) << 8)
                        | (blockHeader[3] & 0xFF);

                if (blockType == FLAC_BLOCK_VORBIS_COMMENT) {
                    if (blockLength > MAX_METADATA_BLOCK) throw new IOException("Vorbis comment too large");
                    byte[] block = readExact(in, blockLength);
                    if (block == null) throw new IOException("Truncated vorbis comment");
                    sourceComment = parseVorbisComment(block);
                    continue;
                }

                // 旧 PADDING 丢弃，统一在 metadata 末尾补一个新的
                if (blockType == FLAC_BLOCK_PADDING) {
                    if (!skipFully(in, blockLength)) throw new IOException("Truncated padding");
                    continue;
                }

                writeBlockHeader(out, blockType, blockLength, false);
                if (!copyExact(in, out, blockLength)) throw new IOException("Truncated FLAC block");
            }

            byte[] comment = buildVorbisComment(sourceComment, lyric);
            writeBlockHeader(out, FLAC_BLOCK_VORBIS_COMMENT, comment.length, false);
            out.write(comment);

            writeBlockHeader(out, FLAC_BLOCK_PADDING, FLAC_WRITE_PADDING, true);
            out.write(new byte[FLAC_WRITE_PADDING]);

            copyRemaining(in, out);
        }
    }

    /** 在原有条目基础上替换歌词键，保留 vendor 与其它字段。 */
    private byte[] buildVorbisComment(VorbisComment source, String lyric) throws IOException {
        String vendor = source != null && isValid(source.vendor) ? source.vendor : DEFAULT_VORBIS_VENDOR;

        List<byte[]> entries = new ArrayList<>();
        if (source != null) {
            for (String entry : source.entries) {
                int equalsIdx = entry.indexOf('=');
                if (equalsIdx <= 0) continue;
                if (flacLyricKeyRank(entry.substring(0, equalsIdx).trim()) >= 0) continue;
                entries.add(entry.getBytes(StandardCharsets.UTF_8));
            }
        }
        entries.add(("LYRICS=" + lyric).getBytes(StandardCharsets.UTF_8));

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] vendorBytes = vendor.getBytes(StandardCharsets.UTF_8);
        writeLeInt(out, vendorBytes.length);
        out.write(vendorBytes, 0, vendorBytes.length);
        writeLeInt(out, entries.size());
        for (byte[] entry : entries) {
            writeLeInt(out, entry.length);
            out.write(entry, 0, entry.length);
        }
        return out.toByteArray();
    }

    /** 写出 metadata block 头：last 标志 + 类型 + 24 位大端长度。 */
    private void writeBlockHeader(OutputStream out, int blockType, int length, boolean isLast) throws IOException {
        out.write((isLast ? 0x80 : 0) | (blockType & 0x7F));
        out.write((length >> 16) & 0xFF);
        out.write((length >> 8) & 0xFF);
        out.write(length & 0xFF);
    }

    /** 写出小端 32 位整数。 */
    private void writeLeInt(OutputStream out, int value) throws IOException {
        out.write(value & 0xFF);
        out.write((value >> 8) & 0xFF);
        out.write((value >> 16) & 0xFF);
        out.write((value >> 24) & 0xFF);
    }

    /** 复制指定长度的数据；源数据不足返回 false。 */
    private boolean copyExact(InputStream in, OutputStream out, int length) throws IOException {
        byte[] buffer = new byte[COPY_BUFFER_SIZE];
        int remaining = length;
        while (remaining > 0) {
            int read = in.read(buffer, 0, Math.min(buffer.length, remaining));
            if (read < 0) return false;
            out.write(buffer, 0, read);
            remaining -= read;
        }
        return true;
    }

    /** 复制输入流剩余全部内容。 */
    private void copyRemaining(InputStream in, OutputStream out) throws IOException {
        byte[] buffer = new byte[COPY_BUFFER_SIZE];
        int read;
        while ((read = in.read(buffer)) >= 0) out.write(buffer, 0, read);
    }

    /** 返回歌词键名的优先级，-1 表示不是歌词键。 */
    private int flacLyricKeyRank(String key) {
        for (int i = 0; i < FLAC_LYRIC_KEYS.length; i++) {
            if (FLAC_LYRIC_KEYS[i].equalsIgnoreCase(key)) return i;
        }
        return -1;
    }

    /** 打开普通文件路径、file URI 或 content URI 对应的输入流。 */
    private InputStream openLocalInputStream(String localPath) throws IOException {
        if (localPath.startsWith(SCHEME_CONTENT)) {
            return getContext().getContentResolver().openInputStream(Uri.parse(localPath));
        }
        String path = resolvePlainPath(localPath);
        return new FileInputStream(path);
    }

    /** 读取指定长度字节；流提前结束时返回 null。 */
    private byte[] readExact(InputStream input, int length) throws IOException {
        byte[] data = new byte[length];
        int offset = 0;
        while (offset < length) {
            int read = input.read(data, offset, length - offset);
            if (read < 0) return null;
            offset += read;
        }
        return data;
    }

    /** 跳过指定字节数；流提前结束时返回 false。 */
    private boolean skipFully(InputStream input, int length) throws IOException {
        int remaining = length;
        while (remaining > 0) {
            long skipped = input.skip(remaining);
            if (skipped > 0) {
                remaining -= (int) skipped;
                continue;
            }
            if (input.read() < 0) return false;
            remaining--;
        }
        return true;
    }

    /** 读取 ID3 synchsafe 整数。 */
    private int readSynchsafeInt(byte[] data, int offset) {
        return ((data[offset] & 0x7F) << 21)
                | ((data[offset + 1] & 0x7F) << 14)
                | ((data[offset + 2] & 0x7F) << 7)
                | (data[offset + 3] & 0x7F);
    }

    /** 读取小端 32 位整数（Vorbis Comment 使用小端）。 */
    private int readLeInt(byte[] data, int offset) {
        return (data[offset] & 0xFF)
                | ((data[offset + 1] & 0xFF) << 8)
                | ((data[offset + 2] & 0xFF) << 16)
                | ((data[offset + 3] & 0xFF) << 24);
    }

    /** 读取大端 32 位整数。 */
    private int readInt(byte[] data, int offset) {
        return ((data[offset] & 0xFF) << 24)
                | ((data[offset + 1] & 0xFF) << 16)
                | ((data[offset + 2] & 0xFF) << 8)
                | (data[offset + 3] & 0xFF);
    }

    /** 跳过 ID3v2 扩展头，返回首个 frame offset。 */
    private int skipExtendedHeaderIfNeeded(byte[] tag, int majorVersion, int flags) {
        if ((flags & 0x40) == 0 || tag.length < 4) return 0;

        int size = majorVersion >= 4 ? readSynchsafeInt(tag, 0) : readInt(tag, 0);
        if (size < 0 || size > tag.length) return 0;
        return majorVersion >= 4 ? size : size + 4;
    }

    /** 解码 USLT 帧正文，去除编码、语言和描述字段。 */
    private String decodeUsltFrame(byte[] frame) {
        if (frame.length < 5) return null;

        int encoding = frame[0] & 0xFF;
        Charset charset = getId3Charset(encoding);
        int offset = 4;
        int textStart = findTextStartAfterDescription(frame, offset, encoding);
        if (textStart < 0 || textStart >= frame.length) return null;

        byte[] textBytes = Arrays.copyOfRange(frame, textStart, frame.length);
        return new String(textBytes, charset).replace("\u0000", "").trim();
    }

    /** 获取 ID3 文本编码。 */
    private Charset getId3Charset(int encoding) {
        if (encoding == 1) return StandardCharsets.UTF_16;
        if (encoding == 2) return StandardCharsets.UTF_16BE;
        if (encoding == 3) return StandardCharsets.UTF_8;
        return StandardCharsets.ISO_8859_1;
    }

    /** 定位 USLT 描述字段后的歌词正文起点。 */
    private int findTextStartAfterDescription(byte[] frame, int offset, int encoding) {
        if (encoding == 1 || encoding == 2) {
            for (int i = offset; i + 1 < frame.length; i += 2) {
                if (frame[i] == 0 && frame[i + 1] == 0) return i + 2;
            }
            return -1;
        }

        for (int i = offset; i < frame.length; i++) {
            if (frame[i] == 0) return i + 1;
        }
        return -1;
    }

    private String extractPathFromTreeUri(Uri treeUri) {
        try {
            String docId = DocumentsContract.getTreeDocumentId(treeUri);
            int colonIndex = docId.indexOf(':');
            if (colonIndex >= 0 && colonIndex < docId.length() - 1) {
                return docId.substring(colonIndex + 1);
            }
            return "";
        } catch (Exception e) {
            android.util.Log.w("LocalMusicPlugin", "Failed to parse tree URI: " + treeUri);
            return null;
        }
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
