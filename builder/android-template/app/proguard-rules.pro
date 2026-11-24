-keepclassmembers class app.apkify.shell.Bridge {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes JavascriptInterface
-keep class app.apkify.shell.** { *; }
-dontwarn com.onesignal.**
# SDK opsional (iklan / login / cast) — hindari peringatan R8 untuk kelas opsional yang tidak ikut
-dontwarn com.applovin.**
-dontwarn com.unity3d.**
-dontwarn com.facebook.**
-dontwarn com.startapp.**
-dontwarn com.bytedance.**
-dontwarn com.mbridge.**
-dontwarn com.ironsource.**
-dontwarn org.slf4j.**
