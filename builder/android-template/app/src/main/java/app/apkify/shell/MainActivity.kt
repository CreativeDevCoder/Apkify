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
import android.os.Bundle
import android.os.Environment
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
import com.google.android.material.appbar.MaterialToolbar
import com.google.android.material.navigation.NavigationView

class MainActivity : AppCompatActivity() {

    private lateinit var cfg: AppConfig
    private lateinit var web: WebView
    private lateinit var swipe: SwipeRefreshLayout
    private lateinit var progress: ProgressBar
    private lateinit var drawer: DrawerLayout
    private lateinit var assetLoader: WebViewAssetLoader
    private val encrypted by lazy { EncryptedAssets(this) }

    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private var pendingGeo: Pair<String, GeolocationPermissions.Callback>? = null
    private var pendingPermission: PermissionRequest? = null
    private var showingOffline = false

    private val startHost by lazy { Uri.parse(cfg.startUrl).host.orEmpty() }

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

    private val mediaPerm = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { r ->
        val req = pendingPermission ?: return@registerForActivityResult
        pendingPermission = null
        val allowed = mutableListOf<String>()
        if (r[Manifest.permission.CAMERA] == true && req.resources.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE)) allowed += PermissionRequest.RESOURCE_VIDEO_CAPTURE
        if (r[Manifest.permission.RECORD_AUDIO] == true && req.resources.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE)) allowed += PermissionRequest.RESOURCE_AUDIO_CAPTURE
        if (allowed.isEmpty()) req.deny() else req.grant(allowed.toTypedArray())
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        cfg = AppConfig.get(this)
        setContentView(R.layout.activity_main)

        web = findViewById(R.id.web)
        swipe = findViewById(R.id.swipe)
        progress = findViewById(R.id.progress)
        drawer = findViewById(R.id.drawer)

        setupSystemBars()
        if (cfg.keepAwake) window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        setupSideMenu()
        setupWebView()

        swipe.isEnabled = cfg.pullToRefresh
        swipe.setColorSchemeColors(parse(cfg.primary))
        swipe.setOnRefreshListener { if (showingOffline) reloadStart() else web.reload() }
        swipe.setOnChildScrollUpCallback { _, _ -> web.scrollY > 0 }

        if (cfg.admob) Ads.init(this, findViewById<FrameLayout>(R.id.adContainer), cfg.admobBannerId)
        if (cfg.onesignal) Push.requestPermission()

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                when {
                    drawer.isDrawerOpen(GravityCompat.START) -> drawer.closeDrawer(GravityCompat.START)
                    web.canGoBack() && !showingOffline -> web.goBack()
                    else -> finish()
                }
            }
        })

        if (savedInstanceState != null) web.restoreState(savedInstanceState) else web.loadUrl(cfg.startUrl)
        handleDeepLink(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleDeepLink(intent)
    }

    private fun handleDeepLink(intent: Intent?) {
        // URL dari notifikasi push (OneSignal launchURL) / intent VIEW
        val url = intent?.data?.toString() ?: return
        if (url.startsWith("http")) web.loadUrl(url)
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
            val top = if (cfg.fullscreen) 0 else bars.top
            v.setPadding(bars.left, top, bars.right, maxOf(bars.bottom, ime.bottom))
            insets
        }
    }

    // ---------- Menu samping ----------
    private fun setupSideMenu() {
        if (!cfg.sideMenu) {
            drawer.setDrawerLockMode(DrawerLayout.LOCK_MODE_LOCKED_CLOSED)
            return
        }
        val toolbar = findViewById<MaterialToolbar>(R.id.toolbar)
        toolbar.visibility = View.VISIBLE
        toolbar.title = cfg.name
        toolbar.setTitleTextColor(Color.WHITE)
        toolbar.setNavigationIcon(R.drawable.ic_menu)
        toolbar.navigationIcon?.setTint(Color.WHITE)
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
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            loadWithOverviewMode = true
            useWideViewPort = true
            setSupportZoom(cfg.zoom)
            builtInZoomControls = cfg.zoom
            displayZoomControls = false
            allowFileAccess = false
            allowContentAccess = false
            javaScriptCanOpenWindowsAutomatically = true
            setGeolocationEnabled(cfg.geolocation)
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            // Strategi cache WebView (diatur dari dashboard):
            cacheMode = when (cfg.cacheMode) {
                "cacheElseNetwork" -> WebSettings.LOAD_CACHE_ELSE_NETWORK
                "noCache" -> WebSettings.LOAD_NO_CACHE
                else -> WebSettings.LOAD_DEFAULT
            }
            if (cfg.userAgentSuffix.isNotBlank()) userAgentString = "$userAgentString ${cfg.userAgentSuffix}"
        }
        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true)
        web.addJavascriptInterface(Bridge(this), "ApkifyBridge")

        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
                val u = request.url
                if (cfg.encrypted && u.host == "appassets.androidplatform.net" && (u.path ?: "").startsWith("/assets/www/")) {
                    return encrypted.serve(Uri.decode(u.encodedPath!!.removePrefix("/assets/www/")))
                }
                return assetLoader.shouldInterceptRequest(u)
            }

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean =
                handleUrl(request.url, request.isForMainFrame)

            override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) {
                progress.visibility = View.VISIBLE
            }

            override fun onPageFinished(view: WebView, url: String) {
                progress.visibility = View.GONE
                swipe.isRefreshing = false
                showingOffline = url.endsWith("/assets/offline.html")
                CookieManager.getInstance().flush()
            }

            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (request.isForMainFrame && cfg.offlinePage && !request.url.toString().endsWith("offline.html")) {
                    showingOffline = true
                    view.loadUrl("https://appassets.androidplatform.net/assets/offline.html")
                }
            }
        }

        web.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView, newProgress: Int) {
                progress.progress = newProgress
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
                if (!cfg.camera) return request.deny()
                val need = mutableListOf<String>()
                if (request.resources.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE)) need += Manifest.permission.CAMERA
                if (request.resources.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE)) need += Manifest.permission.RECORD_AUDIO
                if (need.isEmpty()) return request.deny()
                if (need.all { has(it) }) {
                    request.grant(request.resources)
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

    /** true = ditangani di luar WebView */
    private fun handleUrl(uri: Uri, mainFrame: Boolean): Boolean {
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
        if (host == "appassets.androidplatform.net") return false
        val internal = !cfg.local && (host == startHost || host.endsWith(".$startHost") || startHost.endsWith(".$host"))
        if (!internal && cfg.externalLinksInBrowser) {
            openExternal(uri)
            return true
        }
        return false
    }

    private fun openExternal(uri: Uri) {
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
        web.destroy()
        super.onDestroy()
    }
}
