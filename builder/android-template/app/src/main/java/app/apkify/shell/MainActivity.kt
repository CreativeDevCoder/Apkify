package app.apkify.shell

import android.Manifest
import android.annotation.SuppressLint
import android.app.DownloadManager
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.Message
import android.os.SystemClock
import android.view.Menu
import android.view.View
import android.view.WindowManager
import android.webkit.CookieManager
import android.webkit.GeolocationPermissions
import android.webkit.PermissionRequest
import android.webkit.URLUtil
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.graphics.ColorUtils
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.GravityCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.drawerlayout.widget.DrawerLayout
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import com.google.android.material.appbar.MaterialToolbar
import com.google.android.material.navigation.NavigationView
import com.google.android.material.bottomnavigation.BottomNavigationView
import com.google.android.material.floatingactionbutton.FloatingActionButton
import android.content.res.ColorStateList
import androidx.core.content.pm.ShortcutInfoCompat
import androidx.core.content.pm.ShortcutManagerCompat
import androidx.core.graphics.drawable.IconCompat
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.net.HttpURLConnection
import java.net.URL

class MainActivity : AppCompatActivity() {

    private lateinit var cfg: AppConfig
    private lateinit var web: WebView
    private lateinit var swipe: SwipeRefreshLayout
    private lateinit var progress: ProgressBar
    private lateinit var spinner: ProgressBar
    private lateinit var drawer: DrawerLayout
    private lateinit var toolbar: MaterialToolbar
    private lateinit var assetLoader: WebViewAssetLoader
    private val encrypted by lazy { EncryptedAssets(this) }
    val native by lazy { Native(this) }
    private var pendingShare: String? = null
    private var bottomNav: BottomNavigationView? = null

    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private var pendingGeo: Pair<String, GeolocationPermissions.Callback>? = null
    private var pendingPermission: PermissionRequest? = null
    private var showingOffline = false
    private var docStartScript = false
    private val startedAt = SystemClock.elapsedRealtime()

    private val startHost by lazy { Uri.parse(cfg.startUrl).host.orEmpty() }
    private val errorPage by lazy {
        if (runCatching { assets.open("error.html").close() }.isSuccess) "https://$ASSET_HOST/assets/error.html"
        else "https://$ASSET_HOST/assets/offline.html"
    }

    // ---------- Activity result launchers ----------
    private val pickFiles = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { res ->
        val cb = fileCallback ?: return@registerForActivityResult
        fileCallback = null
        cb.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(res.resultCode, res.data))
    }

    private val geoPerm = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { r ->
        val granted = r.values.any { it }
        pendingGeo?.let { (origin, cb) -> cb.invoke(origin, granted, false) }
        pendingGeo = null
    }

    private val notifPerm = registerForActivityResult(ActivityResultContracts.RequestPermission()) { }

    private val mediaPerm = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { r ->
        val req = pendingPermission ?: return@registerForActivityResult
        pendingPermission = null
        val allowed = mutableListOf<String>()
        if (r[Manifest.permission.CAMERA] == true && req.resources.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE)) allowed += PermissionRequest.RESOURCE_VIDEO_CAPTURE
        if (r[Manifest.permission.RECORD_AUDIO] == true && req.resources.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE)) allowed += PermissionRequest.RESOURCE_AUDIO_CAPTURE
        if (allowed.isEmpty()) req.deny() else req.grant(allowed.toTypedArray())
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        val splash = installSplashScreen()
        super.onCreate(savedInstanceState)
        cfg = AppConfig.get(this)
        // Durasi splash minimum (ms) sesuai pengaturan
        splash.setKeepOnScreenCondition { SystemClock.elapsedRealtime() - startedAt < cfg.splashDurationMs }
        setContentView(R.layout.activity_main)

        web = findViewById(R.id.web)
        swipe = findViewById(R.id.swipe)
        progress = findViewById(R.id.progress)
        spinner = findViewById(R.id.spinner)
        drawer = findViewById(R.id.drawer)
        toolbar = findViewById(R.id.toolbar)

        if (cfg.disallowScreenshot) window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        if (cfg.keepAwake) window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        setupSystemBars()
        setupToolbar()
        setupSideMenu()
        setupWebView()

        swipe.isEnabled = cfg.pullToRefresh
        swipe.setColorSchemeColors(parse(cfg.accent))
        swipe.setOnRefreshListener { if (showingOffline) reloadStart() else web.reload() }
        swipe.setOnChildScrollUpCallback { _, _ -> web.scrollY > 0 }

        if (cfg.admob) Ads.init(this, findViewById<FrameLayout>(R.id.adContainer), cfg)
        if (cfg.onesignal) Push.requestPermission()
        if (cfg.fcm && Build.VERSION.SDK_INT >= 33 && !has(Manifest.permission.POST_NOTIFICATIONS)) notifPerm.launch(Manifest.permission.POST_NOTIFICATIONS)
        setupBottomNav()
        setupFab()
        setupShortcuts()
        Remote.ping(this)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                when {
                    drawer.isDrawerOpen(GravityCompat.START) -> drawer.closeDrawer(GravityCompat.START)
                    web.canGoBack() && !showingOffline -> web.goBack()
                    cfg.confirmExit -> AlertDialog.Builder(this@MainActivity).setMessage(cfg.exitText)
                        .setPositiveButton("Ya") { _, _ -> finish() }.setNegativeButton("Batal", null).show()
                    else -> finish()
                }
            }
        })

        if (savedInstanceState != null) web.restoreState(savedInstanceState) else web.loadUrl(cfg.startUrl)
        handleDeepLink(intent)
        Remote.check(this)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleDeepLink(intent)
    }

    private fun handleDeepLink(intent: Intent?) {
        intent ?: return
        // Share target: teks/link dibagikan dari aplikasi lain -> event 'apkifyshare' di halaman
        if (cfg.shareTarget && intent.action == Intent.ACTION_SEND) {
            val text = listOfNotNull(intent.getStringExtra(Intent.EXTRA_SUBJECT), intent.getStringExtra(Intent.EXTRA_TEXT)).joinToString("\n")
            if (text.isNotBlank()) { pendingShare = text; web.evaluateJavascript(Scripts.shareEvent(text), null) }
            return
        }
        // URL dari deep link, shortcut, atau notifikasi push
        val url = intent.data?.toString() ?: return
        if (url.startsWith("http") || url.startsWith("https://$ASSET_HOST")) web.loadUrl(url)
    }

    /** Dipanggil plugin native untuk mengirim hasil ke JS */
    fun jsCallback(id: String, json: String) = runOnUiThread {
        if (id == "fab") {
            // hasil scan dari tombol mengambang: URL dibuka, teks lain dikirim sebagai event 'apkifyscan'
            val r = runCatching { JSONObject(json) }.getOrNull() ?: return@runOnUiThread
            val v = r.optString("value")
            if (!r.optBoolean("ok")) return@runOnUiThread
            if (v.startsWith("http")) { if (!handleUrl(Uri.parse(v), true)) web.loadUrl(v) }
            else web.evaluateJavascript("document.dispatchEvent(new CustomEvent('apkifyscan', { detail: { value: ${JSONObject.quote(v)} } }))", null)
            return@runOnUiThread
        }
        web.evaluateJavascript("window.__apkifyCb && window.__apkifyCb(${JSONObject.quote(id)}, $json)", null)
    }

    private fun navIcon(name: String): Int {
        val res = resources.getIdentifier("ic_nav_$name", "drawable", packageName)
        return if (res != 0) res else R.drawable.ic_nav_home
    }

    // ---------- Navigasi bawah (maks. 5 tab) ----------
    private fun setupBottomNav() {
        if (!cfg.bottomNav || cfg.navItems.size < 2) return
        val nav = findViewById<BottomNavigationView>(R.id.bottomNav)
        cfg.navItems.take(5).forEachIndexed { i, item -> nav.menu.add(0, i, i, item.label).setIcon(navIcon(item.icon)) }
        val states = arrayOf(intArrayOf(android.R.attr.state_checked), intArrayOf())
        val tint = ColorStateList(states, intArrayOf(parse(cfg.primary), Color.GRAY))
        nav.itemIconTintList = tint
        nav.itemTextColor = tint
        nav.visibility = View.VISIBLE
        nav.setOnItemSelectedListener { item ->
            val target = cfg.resolve(cfg.navItems[item.itemId].url)
            if (web.url != target) web.loadUrl(target)
            true
        }
        nav.setOnItemReselectedListener { item -> web.loadUrl(cfg.resolve(cfg.navItems[item.itemId].url)) }
        bottomNav = nav
    }

    private fun syncBottomNav(url: String) {
        val nav = bottomNav ?: return
        // tab dengan URL terpanjang yang menjadi awalan URL saat ini
        val best = cfg.navItems.withIndex().filter { url.startsWith(cfg.resolve(it.value.url).trimEnd('/')) }.maxByOrNull { cfg.resolve(it.value.url).length } ?: return
        if (nav.selectedItemId != best.index) nav.menu.findItem(best.index)?.isChecked = true
    }

    // ---------- Tombol mengambang ----------
    private fun setupFab() {
        if (!cfg.fab) return
        val fab = findViewById<FloatingActionButton>(R.id.fab)
        fab.setImageResource(navIcon(cfg.fabIcon))
        fab.backgroundTintList = ColorStateList.valueOf(parse(cfg.accent))
        fab.imageTintList = ColorStateList.valueOf(Color.WHITE)
        fab.visibility = View.VISIBLE
        fab.setOnClickListener {
            when (cfg.fabAction) {
                "share" -> shareText(web.title.orEmpty() + "\n" + web.url.orEmpty())
                "top" -> web.evaluateJavascript("window.scrollTo({top:0,behavior:'smooth'})", null)
                "scan" -> native.handle("scanQR", JSONObject(), "fab")
                else -> {
                    val u = cfg.resolve(cfg.fabUrl)
                    if (!handleUrl(Uri.parse(u), true)) web.loadUrl(u)
                }
            }
        }
    }

    // ---------- Shortcut ikon (tekan lama ikon aplikasi) ----------
    private fun setupShortcuts() {
        if (!cfg.shortcutsOn || cfg.shortcuts.isEmpty()) return
        runCatching {
            val list = cfg.shortcuts.take(4).mapIndexed { i, (label, u) ->
                ShortcutInfoCompat.Builder(this, "s$i").setShortLabel(label.take(25))
                    .setIcon(IconCompat.createWithResource(this, R.mipmap.ic_launcher))
                    .setIntent(Intent(Intent.ACTION_VIEW, Uri.parse(cfg.resolve(u)), this, MainActivity::class.java)).build()
            }
            ShortcutManagerCompat.setDynamicShortcuts(this, list)
        }
    }

    // ---------- Status bar & edge-to-edge (wajib di targetSdk 35+) ----------
    private fun setupSystemBars() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        val root = findViewById<LinearLayout>(R.id.root)
        val barColor = parse(cfg.statusBar)
        root.setBackgroundColor(barColor)
        val ctl = WindowInsetsControllerCompat(window, window.decorView)
        val light = ColorUtils.calculateLuminance(barColor) > 0.5
        ctl.isAppearanceLightStatusBars = light
        ctl.isAppearanceLightNavigationBars = light
        if (cfg.fullscreen) {
            ctl.hide(WindowInsetsCompat.Type.systemBars())
            ctl.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
        ViewCompat.setOnApplyWindowInsetsListener(root) { v, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
            v.setPadding(bars.left, if (cfg.fullscreen) 0 else bars.top, bars.right, maxOf(bars.bottom, ime.bottom))
            insets
        }
    }

    // ---------- Toolbar (judul, judul live, tombol Home) ----------
    private fun setupToolbar() {
        if (!cfg.showToolbar) return
        toolbar.visibility = View.VISIBLE
        toolbar.title = cfg.name
        toolbar.setTitleTextColor(Color.WHITE)
        if (cfg.homeButton) {
            toolbar.menu.add(0, HOME_ID, 0, "Beranda").setIcon(R.drawable.ic_home).setShowAsAction(android.view.MenuItem.SHOW_AS_ACTION_ALWAYS)
            toolbar.setOnMenuItemClickListener { if (it.itemId == HOME_ID) { reloadStart(); true } else false }
        }
    }

    // ---------- Menu samping ----------
    private fun setupSideMenu() {
        if (!cfg.sideMenu) {
            drawer.setDrawerLockMode(DrawerLayout.LOCK_MODE_LOCKED_CLOSED)
            return
        }
        toolbar.setNavigationIcon(R.drawable.ic_menu)
        toolbar.setNavigationOnClickListener { drawer.openDrawer(GravityCompat.START) }
        val nav = findViewById<NavigationView>(R.id.nav)
        val m = nav.menu
        m.add(0, 1, 0, "Beranda")
        if (cfg.about.isNotBlank()) m.add(0, 2, 1, "Tentang")
        if (cfg.contactEmail.isNotBlank()) m.add(0, 3, 2, "Kontak")
        m.add(0, 4, 3, "Bagikan aplikasi")
        cfg.links.forEachIndexed { i, (label, _) -> m.add(1, 100 + i, 10 + i, label) }
        m.add(2, 5, 99, "Muat ulang")
        nav.setNavigationItemSelectedListener { item ->
            drawer.closeDrawer(GravityCompat.START)
            when (item.itemId) {
                1 -> reloadStart()
                2 -> AlertDialog.Builder(this).setTitle(cfg.name).setMessage(cfg.about).setPositiveButton("OK", null).show()
                3 -> openExternal(Uri.parse("mailto:${cfg.contactEmail}"))
                4 -> shareText(cfg.shareText.ifBlank { cfg.name } + "\nhttps://play.google.com/store/apps/details?id=$packageName")
                5 -> web.reload()
                else -> cfg.links.getOrNull(item.itemId - 100)?.let { openExternal(Uri.parse(it.second)) }
            }
            true
        }
    }

    // ---------- User-Agent ----------
    private fun buildUserAgent(base: String): String {
        var ua = base
        if (cfg.desktopMode) {
            val chrome = Regex("Chrome/([\\d.]+)").find(base)?.groupValues?.get(1) ?: "120.0.0.0"
            ua = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/$chrome Safari/537.36"
        } else {
            if (cfg.hideWebViewUA) ua = ua.replace("; wv)", ")").replace(Regex("Version/\\d+(\\.\\d+)* "), "")
            if (cfg.hideMobileUA) ua = ua.replace(" Mobile", "").replace(Regex("\\(Linux; Android [^)]*\\)"), "(X11; Linux x86_64)")
        }
        if (cfg.userAgentSuffix.isNotBlank()) ua = "$ua ${cfg.userAgentSuffix}"
        return ua
    }

    // ---------- WebView ----------
    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .addPathHandler("/res/", WebViewAssetLoader.ResourcesPathHandler(this))
            .build()

        with(web.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            @Suppress("DEPRECATION") databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            loadWithOverviewMode = true
            useWideViewPort = true
            setSupportZoom(cfg.zoom || cfg.zoomButtons || cfg.desktopMode)
            builtInZoomControls = cfg.zoom || cfg.zoomButtons || cfg.desktopMode
            displayZoomControls = cfg.zoomButtons
            allowFileAccess = cfg.allowFileAccess
            allowContentAccess = cfg.allowFileAccess
            javaScriptCanOpenWindowsAutomatically = !cfg.popupBlocker
            setSupportMultipleWindows(!cfg.popupBlocker)
            setGeolocationEnabled(cfg.geolocation)
            mixedContentMode = if (cfg.httpsOnly) WebSettings.MIXED_CONTENT_NEVER_ALLOW else WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            @Suppress("DEPRECATION") saveFormData = cfg.saveFormData
            cacheMode = when (cfg.cacheMode) {
                "cacheElseNetwork" -> WebSettings.LOAD_CACHE_ELSE_NETWORK
                "noCache" -> WebSettings.LOAD_NO_CACHE
                else -> WebSettings.LOAD_DEFAULT
            }
            userAgentString = buildUserAgent(userAgentString)
        }
        web.isVerticalScrollBarEnabled = cfg.scrollbars
        web.isHorizontalScrollBarEnabled = cfg.scrollbars
        if (!cfg.saveFormData && Build.VERSION.SDK_INT >= 26) web.importantForAutofill = View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS
        if (!cfg.textSelection) {
            web.setOnLongClickListener { true }
            web.isLongClickable = false
            web.isHapticFeedbackEnabled = false
        }
        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true)
        web.addJavascriptInterface(Bridge(this), "ApkifyBridge")

        // window.APKIFY / window.Apkify disuntikkan sebelum skrip halaman berjalan (bila didukung WebView)
        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            WebViewCompat.addDocumentStartJavaScript(web, Scripts.apiShim(cfg), setOf("*"))
            docStartScript = true
        }

        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
                val u = request.url
                if (u.host == ASSET_HOST && (u.path ?: "").startsWith("/assets/www/")) {
                    val rel = Uri.decode(u.encodedPath!!.removePrefix("/assets/www/"))
                    Remote.otaDir(this@MainActivity)?.let { dir -> Remote.serveOta(dir, rel)?.let { return it } }
                    if (cfg.encrypted) return encrypted.serve(rel)
                }
                if (u.host == ASSET_HOST) return assetLoader.shouldInterceptRequest(u)
                if (cfg.local && cfg.crossOrigin && request.method == "GET" && !request.isForMainFrame && u.scheme == "https") {
                    return corsProxy(request)
                }
                return null
            }

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean =
                handleUrl(request.url, request.isForMainFrame)

            override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) {
                when (cfg.progressStyle) {
                    "bar" -> progress.visibility = View.VISIBLE
                    "spinner" -> spinner.visibility = View.VISIBLE
                }
                Ads.onNavigation(this@MainActivity)
            }

            override fun onPageFinished(view: WebView, url: String) {
                progress.visibility = View.GONE
                spinner.visibility = View.GONE
                swipe.isRefreshing = false
                showingOffline = url == errorPage
                if (!docStartScript) view.evaluateJavascript(Scripts.apiShim(cfg), null)
                if (!cfg.textSelection) view.evaluateJavascript(Scripts.NO_SELECT, null)
                if (!showingOffline && (cfg.customCss.isNotBlank() || cfg.customJs.isNotBlank())) view.evaluateJavascript(Scripts.custom(cfg), null)
                if (!showingOffline) syncBottomNav(url)
                pendingShare?.let { t -> pendingShare = null; view.evaluateJavascript(Scripts.shareEvent(t), null) }
                if (cfg.tawkPropertyId.isNotBlank() && !showingOffline) view.evaluateJavascript(Scripts.tawk(cfg.tawkPropertyId, cfg.tawkWidgetId), null)
                CookieManager.getInstance().flush()
            }

            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (request.isForMainFrame && cfg.offlinePage && request.url.toString() != errorPage) {
                    showingOffline = true
                    view.loadUrl(errorPage)
                }
            }
        }

        web.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView, newProgress: Int) {
                progress.progress = newProgress
            }

            override fun onReceivedTitle(view: WebView, title: String?) {
                if (cfg.showToolbar && cfg.liveTitle && !title.isNullOrBlank() && !showingOffline && !title.startsWith("http")) toolbar.title = title
            }

            // Pop-up (window.open / target=_blank) dibuka di WebView utama bila pop-up blocker mati
            override fun onCreateWindow(view: WebView, isDialog: Boolean, isUserGesture: Boolean, resultMsg: Message): Boolean {
                if (cfg.popupBlocker) return false
                val temp = WebView(this@MainActivity)
                temp.webViewClient = object : WebViewClient() {
                    override fun shouldOverrideUrlLoading(v: WebView, r: WebResourceRequest): Boolean {
                        if (!handleUrl(r.url, true)) web.loadUrl(r.url.toString())
                        v.destroy()
                        return true
                    }
                }
                (resultMsg.obj as WebView.WebViewTransport).webView = temp
                resultMsg.sendToTarget()
                return true
            }

            override fun onShowFileChooser(view: WebView, callback: ValueCallback<Array<Uri>>, params: FileChooserParams): Boolean {
                if (!cfg.fileUpload) return false
                fileCallback?.onReceiveValue(null)
                fileCallback = callback
                return try {
                    val i = params.createIntent()
                    if (params.mode == FileChooserParams.MODE_OPEN_MULTIPLE) i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
                    pickFiles.launch(i)
                    true
                } catch (e: ActivityNotFoundException) {
                    fileCallback = null
                    false
                }
            }

            override fun onGeolocationPermissionsShowPrompt(origin: String, callback: GeolocationPermissions.Callback) {
                if (!cfg.geolocation) return callback.invoke(origin, false, false)
                if (has(Manifest.permission.ACCESS_FINE_LOCATION) || has(Manifest.permission.ACCESS_COARSE_LOCATION)) {
                    callback.invoke(origin, true, false)
                } else {
                    pendingGeo = origin to callback
                    geoPerm.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
                }
            }

            override fun onPermissionRequest(request: PermissionRequest) {
                val need = mutableListOf<String>()
                if (cfg.camera && request.resources.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE)) need += Manifest.permission.CAMERA
                if (cfg.microphone && request.resources.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE)) need += Manifest.permission.RECORD_AUDIO
                if (need.isEmpty()) return request.deny()
                if (need.all { has(it) }) {
                    request.grant(request.resources.filter {
                        (it == PermissionRequest.RESOURCE_VIDEO_CAPTURE && cfg.camera) || (it == PermissionRequest.RESOURCE_AUDIO_CAPTURE && cfg.microphone)
                    }.toTypedArray())
                } else {
                    pendingPermission = request
                    mediaPerm.launch(need.toTypedArray())
                }
            }
        }

        if (cfg.downloads) {
            web.setDownloadListener { url, userAgent, contentDisposition, mimeType, _ ->
                if (!url.startsWith("http")) {
                    Toast.makeText(this, "Jenis unduhan ini tidak didukung", Toast.LENGTH_SHORT).show()
                    return@setDownloadListener
                }
                try {
                    val name = URLUtil.guessFileName(url, contentDisposition, mimeType)
                    val req = DownloadManager.Request(Uri.parse(url))
                        .setMimeType(mimeType)
                        .addRequestHeader("User-Agent", userAgent)
                        .addRequestHeader("Cookie", CookieManager.getInstance().getCookie(url) ?: "")
                        .setTitle(name)
                        .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                        .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name)
                    (getSystemService(DOWNLOAD_SERVICE) as DownloadManager).enqueue(req)
                    Toast.makeText(this, "Mengunduh $name…", Toast.LENGTH_SHORT).show()
                } catch (e: Exception) {
                    openExternal(Uri.parse(url))
                }
            }
        }
    }

    /**
     * "Allow Cross-Origin" untuk konten lokal: permintaan GET ke API luar diambil secara native
     * lalu dikembalikan dengan header CORS terbuka (berjalan di thread latar WebView).
     */
    private fun corsProxy(request: WebResourceRequest): WebResourceResponse? = try {
        val conn = (URL(request.url.toString()).openConnection() as HttpURLConnection).apply {
            connectTimeout = 15_000; readTimeout = 30_000
            request.requestHeaders.forEach { (k, v) -> if (!k.equals("Origin", true) && !k.equals("Referer", true)) setRequestProperty(k, v) }
            CookieManager.getInstance().getCookie(request.url.toString())?.let { setRequestProperty("Cookie", it) }
        }
        val code = conn.responseCode
        if (code in 300..399 || code < 100 || code > 599) return null // WebResourceResponse menolak kode redirect
        val type = conn.contentType ?: "application/octet-stream"
        val stream = (if (code >= 400) conn.errorStream else conn.inputStream) ?: ByteArrayInputStream(ByteArray(0))
        WebResourceResponse(type.substringBefore(';').trim(), Regex("charset=([\\w-]+)").find(type)?.groupValues?.get(1),
            code, conn.responseMessage?.ifBlank { "OK" } ?: "OK",
            mapOf("Access-Control-Allow-Origin" to "*", "Access-Control-Allow-Headers" to "*"), stream)
    } catch (e: Exception) {
        null
    }

    /** true = ditangani di luar WebView */
    fun handleUrl(uri: Uri, mainFrame: Boolean): Boolean {
        val s = uri.toString()
        // Aturan link kustom (regex) didahulukan
        for (rule in cfg.linkRules) {
            if (rule.regex.containsMatchIn(s)) {
                return when (rule.action) {
                    "internal" -> false
                    "block" -> true
                    else -> { openExternal(uri); true }
                }
            }
        }
        val scheme = uri.scheme?.lowercase().orEmpty()
        if (scheme == "intent") {
            return try {
                val i = Intent.parseUri(uri.toString(), Intent.URI_INTENT_SCHEME)
                i.addCategory(Intent.CATEGORY_BROWSABLE)
                i.component = null
                i.selector = null
                startActivity(i)
                true
            } catch (e: Exception) {
                val fallback = runCatching { Intent.parseUri(uri.toString(), Intent.URI_INTENT_SCHEME).getStringExtra("browser_fallback_url") }.getOrNull()
                if (fallback != null) web.loadUrl(fallback)
                true
            }
        }
        if (scheme != "http" && scheme != "https") {
            openExternal(uri) // tel:, mailto:, whatsapp:, market:, dll.
            return true
        }
        if (!mainFrame) return false
        val host = uri.host.orEmpty()
        if (host == ASSET_HOST) return false
        val internal = !cfg.local && (host == startHost || host.endsWith(".$startHost") || startHost.endsWith(".$host"))
        if (!internal && cfg.externalLinksInBrowser) {
            openExternal(uri)
            return true
        }
        return false
    }

    fun openExternal(uri: Uri) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        } catch (e: ActivityNotFoundException) {
            Toast.makeText(this, "Tidak ada aplikasi untuk membuka tautan ini", Toast.LENGTH_SHORT).show()
        }
    }

    fun shareText(text: String) {
        startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text), null))
    }

    fun reloadStart() {
        showingOffline = false
        web.loadUrl(cfg.startUrl)
    }

    private fun has(p: String) = ContextCompat.checkSelfPermission(this, p) == PackageManager.PERMISSION_GRANTED
    private fun parse(c: String) = runCatching { Color.parseColor(c) }.getOrDefault(Color.DKGRAY)

    override fun onCreateOptionsMenu(menu: Menu): Boolean = false

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web.saveState(outState)
    }

    override fun onResume() { super.onResume(); web.onResume() }
    override fun onPause() { web.onPause(); super.onPause() }

    override fun onDestroy() {
        Ads.destroy()
        native.destroy()
        web.destroy()
        super.onDestroy()
    }

    companion object {
        const val ASSET_HOST = "appassets.androidplatform.net"
        private const val HOME_ID = 9001
    }
}
