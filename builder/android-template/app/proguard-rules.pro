-keepclassmembers class app.apkify.shell.Bridge {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes JavascriptInterface
-keep class app.apkify.shell.** { *; }
-dontwarn com.onesignal.**
