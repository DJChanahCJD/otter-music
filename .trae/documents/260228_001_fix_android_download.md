# Plan: Fix Android Download Error on Low Versions

The user reported a "Cannot create directory" error on low version Android devices when downloading music. This usually indicates a storage permission issue or directory creation failure.

## Analysis
1.  **Error Message**: `Cannot create directory at/storage/emulated/0/Download/` suggests failure to create the target directory.
2.  **Permissions**: `AndroidManifest.xml` requests `WRITE_EXTERNAL_STORAGE` (maxSdk 32), which is correct for older Android versions.
3.  **Android 10 (API 29)**: Requires `android:requestLegacyExternalStorage="true"` in `AndroidManifest.xml` to allow direct file access to shared storage (like `Download` folder) if the app targets API 29+ but runs on Android 10.
4.  **Code Logic (`download.ts`)**:
    *   `ensureDownloadDir` swallows errors with a `try-catch` block. If `mkdir` fails, it logs to console but returns success.
    *   `downloadNative` continues even if directory creation failed, leading to `FileTransfer` failing with "Cannot create directory" (or similar native error).

## Proposed Changes

### 1. Update `AndroidManifest.xml`
Add `android:requestLegacyExternalStorage="true"` to the `<application>` tag to ensure compatibility with Android 10's storage model.

### 2. Improve `src/lib/utils/download.ts`
Modify `ensureDownloadDir` to be more robust and transparent about errors:
*   Check if the directory exists using `Filesystem.stat`.
*   If it exists, return immediately.
*   If it doesn't exist, call `Filesystem.mkdir` with `recursive: true`.
*   **Remove the silent `try-catch` block** (or rethrow the error) so that `downloadMusicTrack` catches the failure and shows the toast message, and we don't proceed to `FileTransfer` with an invalid state.

## Implementation Steps
1.  Edit `android/app/src/main/AndroidManifest.xml` to add `android:requestLegacyExternalStorage="true"`.
2.  Edit `src/lib/utils/download.ts` to refactor `ensureDownloadDir` and error handling.
3.  Verify the changes (by reviewing the code, as I cannot run on device).

## Verification
*   Check `AndroidManifest.xml` for the new attribute.
*   Check `download.ts` for proper error propagation.
