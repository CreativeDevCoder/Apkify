import SwiftUI
import WebKit
import LocalAuthentication

struct WebView: UIViewRepresentable {
    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let cfg = AppConfig.shared
        let wc = WKWebViewConfiguration()
        wc.allowsInlineMediaPlayback = true
        wc.mediaTypesRequiringUserActionForPlayback = []
        if !cfg.userAgentSuffix.isEmpty { wc.applicationNameForUserAgent = cfg.userAgentSuffix }
        let ucc = WKUserContentController()
        ucc.addUserScript(WKUserScript(source: Coordinator.bootScript(cfg), injectionTime: .atDocumentStart, forMainFrameOnly: false))
        if !cfg.customCss.isEmpty || !cfg.customJs.isEmpty {
            ucc.addUserScript(WKUserScript(source: Coordinator.customScript(cfg), injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        }
        ucc.add(context.coordinator, name: "apkify")
        wc.userContentController = ucc

        let web = WKWebView(frame: .zero, configuration: wc)
        web.navigationDelegate = context.coordinator
        web.uiDelegate = context.coordinator
        web.allowsBackForwardNavigationGestures = true
        web.scrollView.contentInsetAdjustmentBehavior = .never
        if cfg.pullToRefresh {
            let rc = UIRefreshControl()
            rc.addTarget(context.coordinator, action: #selector(Coordinator.refresh(_:)), for: .valueChanged)
            web.scrollView.refreshControl = rc
        }
        if !cfg.zoom { web.scrollView.pinchGestureRecognizer?.isEnabled = false }
        context.coordinator.web = web
        context.coordinator.loadStart()
        return web
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
        weak var web: WKWebView?
        let cfg = AppConfig.shared
        lazy var rules: [(NSRegularExpression, String)] = cfg.linkRules.compactMap { r in
            (try? NSRegularExpression(pattern: r.pattern)).map { ($0, r.action) }
        }
        lazy var startHost: String = URL(string: cfg.startUrl)?.host ?? ""

        static func bootScript(_ cfg: AppConfig) -> String {
            """
            (function(){
              window.APKIFY = Object.assign(\(cfg.appJson.isEmpty ? "{}" : cfg.appJson), { platform: 'ios' });
              var post = function(m){ try { window.webkit.messageHandlers.apkify.postMessage(m); } catch(e) {} };
              var cbs = {}, n = 0;
              window.__apkifyCb = function(id, res){ var c = cbs[id]; delete cbs[id]; if (c) c(res); };
              var call = function(cmd, data){ return new Promise(function(r){ var id = 'c' + (++n); cbs[id] = r; post(Object.assign({ cmd: cmd, id: id }, data || {})); }); };
              if (\(cfg.jsApi ? "true" : "false")) window.Apkify = {
                toast: function(m){ post({ cmd: 'toast', text: String(m) }); },
                vibrate: function(){ post({ cmd: 'vibrate' }); },
                share: function(t){ post({ cmd: 'share', text: String(t) }); },
                copy: function(t){ post({ cmd: 'copy', text: String(t) }); },
                open: function(u){ post({ cmd: 'open', url: String(u) }); },
                keepScreenOn: function(on){ post({ cmd: 'awake', on: !!on }); },
                biometric: function(reason){ return call('biometric', { reason: String(reason || 'Verifikasi identitas') }); },
                device: function(){ return { platform: 'ios', model: navigator.platform }; },
                app: function(){ return window.APKIFY; },
                exit: function(){}
              };
              document.addEventListener('DOMContentLoaded', function(){ document.dispatchEvent(new Event('apkifyready')); });
            })();
            """
        }

        static func customScript(_ cfg: AppConfig) -> String {
            let css = (try? String(data: JSONEncoder().encode(cfg.customCss), encoding: .utf8)) ?? "\"\""
            return "(function(){ var s=document.createElement('style'); s.textContent=\(css); document.head.appendChild(s); try { \(cfg.customJs) } catch(e) { console.error(e); } })();"
        }

        func loadStart() {
            guard let web = web else { return }
            if cfg.local, let www = Bundle.main.url(forResource: "www", withExtension: nil) {
                web.loadFileURL(www.appendingPathComponent("index.html"), allowingReadAccessTo: www)
            } else if let url = URL(string: cfg.startUrl) {
                web.load(URLRequest(url: url))
            }
        }

        @objc func refresh(_ sender: UIRefreshControl) {
            web?.reload()
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) { sender.endRefreshing() }
        }

        private func openExternal(_ url: URL) {
            UIApplication.shared.open(url, options: [:], completionHandler: nil)
        }

        // ---- Navigasi & link ----
        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = action.request.url else { return decisionHandler(.allow) }
            let s = url.absoluteString
            for (re, act) in rules where re.firstMatch(in: s, range: NSRange(s.startIndex..., in: s)) != nil {
                if act == "internal" { return decisionHandler(.allow) }
                if act == "block" { return decisionHandler(.cancel) }
                openExternal(url); return decisionHandler(.cancel)
            }
            let scheme = (url.scheme ?? "").lowercased()
            if ["file", "about", "data", "blob"].contains(scheme) { return decisionHandler(.allow) }
            if scheme != "http" && scheme != "https" { openExternal(url); return decisionHandler(.cancel) }
            let isMain = action.targetFrame?.isMainFrame ?? true
            let host = url.host ?? ""
            let internal = !cfg.local && (host == startHost || host.hasSuffix("." + startHost) || startHost.hasSuffix("." + host))
            if isMain && !internal && cfg.externalLinksInBrowser && action.navigationType == .linkActivated {
                openExternal(url); return decisionHandler(.cancel)
            }
            decisionHandler(.allow)
        }

        // target=_blank / window.open -> buka di WebView yang sama
        func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
            if action.targetFrame == nil { webView.load(action.request) }
            return nil
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            if (error as NSError).code == NSURLErrorCancelled { return }
            webView.loadHTMLString(cfg.errorHtml, baseURL: nil)
        }

        // ---- Dialog JavaScript (alert/confirm/prompt) ----
        private func topVC() -> UIViewController? {
            let scene = UIApplication.shared.connectedScenes.first { $0.activationState == .foregroundActive } as? UIWindowScene
            var vc = scene?.windows.first { $0.isKeyWindow }?.rootViewController
            while let p = vc?.presentedViewController { vc = p }
            return vc
        }

        func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
            let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
            a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
            if let vc = topVC() { vc.present(a, animated: true) } else { completionHandler() }
        }

        func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
            let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
            a.addAction(UIAlertAction(title: "Batal", style: .cancel) { _ in completionHandler(false) })
            a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) })
            if let vc = topVC() { vc.present(a, animated: true) } else { completionHandler(false) }
        }

        func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
            let a = UIAlertController(title: nil, message: prompt, preferredStyle: .alert)
            a.addTextField { $0.text = defaultText }
            a.addAction(UIAlertAction(title: "Batal", style: .cancel) { _ in completionHandler(nil) })
            a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(a.textFields?.first?.text) })
            if let vc = topVC() { vc.present(a, animated: true) } else { completionHandler(nil) }
        }

        // Kamera/mikrofon untuk getUserMedia (iOS 15+)
        @available(iOS 15.0, *)
        func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType, decisionHandler: @escaping (WKPermissionDecision) -> Void) {
            decisionHandler(.prompt)
        }

        // ---- Jembatan JS (window.Apkify) ----
        func userContentController(_ uc: WKUserContentController, didReceive message: WKScriptMessage) {
            guard let body = message.body as? [String: Any], let cmd = body["cmd"] as? String else { return }
            if cmd == "retry" { loadStart(); return }
            guard cfg.jsApi else { return }
            switch cmd {
            case "toast":
                let a = UIAlertController(title: nil, message: body["text"] as? String, preferredStyle: .alert)
                topVC()?.present(a, animated: true)
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { a.dismiss(animated: true) }
            case "vibrate":
                UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            case "share":
                let vc = UIActivityViewController(activityItems: [body["text"] as? String ?? ""], applicationActivities: nil)
                if let top = topVC() { vc.popoverPresentationController?.sourceView = top.view; top.present(vc, animated: true) }
            case "copy":
                UIPasteboard.general.string = body["text"] as? String
            case "open":
                if let s = body["url"] as? String, let u = URL(string: s) { openExternal(u) }
            case "awake":
                UIApplication.shared.isIdleTimerDisabled = (body["on"] as? Bool) ?? false
            case "biometric":
                let id = body["id"] as? String ?? ""
                let ctx = LAContext()
                var err: NSError?
                guard ctx.canEvaluatePolicy(.deviceOwnerAuthentication, error: &err) else { return reply(id, "{\"ok\":false,\"error\":\"unavailable\"}") }
                ctx.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: body["reason"] as? String ?? "Verifikasi") { ok, _ in
                    DispatchQueue.main.async { self.reply(id, ok ? "{\"ok\":true}" : "{\"ok\":false}") }
                }
            default: break
            }
        }

        private func reply(_ id: String, _ json: String) {
            web?.evaluateJavaScript("window.__apkifyCb && window.__apkifyCb('\(id)', \(json))", completionHandler: nil)
        }
    }
}
