# ============================================================
# Capacitor Core
# ============================================================
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keepclassmembers class * extends com.getcapacitor.Plugin {
    @com.getcapacitor.annotation.CapacitorPlugin *;
    @com.getcapacitor.PluginMethod *;
}
-dontwarn com.getcapacitor.**

# ============================================================
# Capacitor Plugins
# ============================================================

# capacitor-app
-keep class com.capacitorjs.plugins.app.** { *; }

# capacitor-app-launcher
-keep class com.capacitorjs.plugins.applauncher.** { *; }

# capacitor-clipboard
-keep class com.capacitorjs.plugins.clipboard.** { *; }

# capacitor-file-transfer
-keep class com.transistorsoft.capacitor.filetransfer.** { *; }
-keep class com.capacitorjs.plugins.filetransfer.** { *; }

# capacitor-filesystem
-keep class com.capacitorjs.plugins.filesystem.** { *; }

# jofr/capacitor-media-session
-keep class com.jofr.capacitormediasession.** { *; }

# ============================================================
# WebView & JavaScript Bridge
# ============================================================
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes JavascriptInterface

# ============================================================
# Android / AndroidX
# ============================================================
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes Exceptions
-keepattributes SourceFile,LineNumberTable

-keep class androidx.** { *; }
-dontwarn androidx.**

# ============================================================
# Suppress common third-party warnings
# ============================================================
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**
